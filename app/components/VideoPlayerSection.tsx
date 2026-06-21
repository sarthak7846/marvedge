import ReactPlayer from "react-player";
import Image from "next/image";
import VideoPreview from "@/app/components/VideoPreview";
import RecordingTimeline from "@/app/components/RecordingTimeline";
import RecorderVideoPlayer from "@/app/components/RecorderVideoPlayer";
import { useRef, useState } from "react";

interface VideoPlayerSectionProps {
  uploadedFileType: string | null;
  uploadedFileUrl: string | null;
  videoUrl: string | null;
  screenStream: MediaStream | null;
  recording: boolean;
  videoPlaying: boolean;
  setVideoPlaying: (playing: boolean) => void;
  videoCurrentTime: number;
  setVideoCurrentTime: (time: number) => void;
  videoDuration: number;
  setVideoDuration: (duration: number) => void;
  recordingDuration: number;
  recordingTimer: number;
  videoPlayerRef: React.RefObject<ReactPlayer | null>;
}

export default function VideoPlayerSection({
  uploadedFileType,
  uploadedFileUrl,
  videoUrl,
  screenStream,
  recording,
  videoPlaying,
  setVideoPlaying,
  videoCurrentTime,
  setVideoCurrentTime,
  videoDuration,
  setVideoDuration,
  recordingDuration,
  recordingTimer,
  videoPlayerRef,
}: VideoPlayerSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {
          console.log("Fullscreen request failed");
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (videoPlayerRef.current) {
      const player = videoPlayerRef.current.getInternalPlayer();
      if (player && player.volume !== undefined) {
        player.volume = newVolume;
      }
    }
  };

  const renderVideoPlayer = (url: string, isUploaded: boolean = false) => (
    <RecorderVideoPlayer
      url={url}
      isUploaded={isUploaded}
      containerRef={containerRef}
      volume={volume}
      onVolumeChange={handleVolumeChange}
      onFullscreen={handleFullscreen}
      videoPlaying={videoPlaying}
      setVideoPlaying={setVideoPlaying}
      videoCurrentTime={videoCurrentTime}
      setVideoCurrentTime={setVideoCurrentTime}
      videoDuration={videoDuration}
      setVideoDuration={setVideoDuration}
      recordingDuration={recordingDuration}
      videoPlayerRef={videoPlayerRef}
    />
  );

  return (
    <div className="flex flex-col items-center mb-4 sm:mb-8 w-full max-w-[900px] mx-auto">
      <div className="w-full">
        {uploadedFileType?.startsWith("image/") ? (
          <div className="rounded-2xl mx-auto" style={{ maxWidth: 900, background: "#000" }}>
            <Image
              src={uploadedFileUrl!}
              alt="Uploaded preview"
              style={{
                width: "100%",
                height: "auto",
                objectFit: "contain",
                background: "#000",
              }}
              width={900}
              height={500}
            />
          </div>
        ) : uploadedFileUrl && uploadedFileType?.startsWith("video/") ? (
          renderVideoPlayer(uploadedFileUrl, true)
        ) : videoUrl ? (
          renderVideoPlayer(videoUrl, false)
        ) : screenStream ? (
          <div className="w-full max-w-[900px] mx-auto">
            <div className="video-box bg-white rounded-2xl shadow-md flex flex-col transition-all duration-300 overflow-hidden">
              <div className="video-top w-full h-8 flex items-center px-4 gap-1.5 bg-[#f5f5f7] border-b border-[#ede7fa]">
                <div className="circle w-2 h-2 rounded-full bg-gray-300"></div>
                <div className="circle w-2 h-2 rounded-full bg-gray-300"></div>
                <div className="circle w-2 h-2 rounded-full bg-gray-300"></div>
              </div>
              <div className="screen w-full h-auto aspect-video bg-white overflow-hidden">
                <VideoPreview
                  videoUrl={null}
                  isRecording={recording}
                  screenStream={screenStream}
                  className="w-full h-full"
                  showControls={false}
                />
              </div>
              {recording && <RecordingTimeline recordingTimer={recordingTimer} />}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl">
            No preview available. Start screen sharing or upload a video to see the preview.
          </div>
        )}
      </div>
    </div>
  );
}
