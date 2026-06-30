import ReactPlayer from "react-player";
import SimpleTimeline from "@/app/components/SimpleTimeline";

const readPlayerDuration = (
  videoPlayerRef: React.RefObject<ReactPlayer | null>,
  setVideoDuration: (duration: number) => void
) => {
  const player = videoPlayerRef.current?.getInternalPlayer();
  if (player && player.duration && isFinite(player.duration) && player.duration > 0) {
    setVideoDuration(player.duration);
  }
};

const scheduleDurationReads = (
  videoPlayerRef: React.RefObject<ReactPlayer | null>,
  setVideoDuration: (duration: number) => void
) => {
  setTimeout(() => readPlayerDuration(videoPlayerRef, setVideoDuration), 10);
  setTimeout(() => readPlayerDuration(videoPlayerRef, setVideoDuration), 100);
  setTimeout(() => readPlayerDuration(videoPlayerRef, setVideoDuration), 500);
};

interface PlayerTopBarProps {
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFullscreen: () => void;
}

function PlayerTopBar({ volume, onVolumeChange, onFullscreen }: PlayerTopBarProps) {
  return (
    <div className="absolute top-0 right-0 z-20 flex items-center gap-2 p-4 bg-linear-to-l rounded-bl-2xl">
      <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-2 backdrop-blur-sm">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={onVolumeChange}
          className="w-20 h-1 accent-[#7C5CFC]"
          style={{ cursor: "pointer" }}
        />
      </div>

      <button
        onClick={onFullscreen}
        className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition backdrop-blur-sm"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
    </div>
  );
}

interface RecorderVideoPlayerProps {
  url: string;
  isUploaded?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFullscreen: () => void;
  videoPlaying: boolean;
  setVideoPlaying: (playing: boolean) => void;
  videoCurrentTime: number;
  setVideoCurrentTime: (time: number) => void;
  videoDuration: number;
  setVideoDuration: (duration: number) => void;
  recordingDuration: number;
  videoPlayerRef: React.RefObject<ReactPlayer | null>;
}

export default function RecorderVideoPlayer({
  url,
  isUploaded = false,
  containerRef,
  volume,
  onVolumeChange,
  onFullscreen,
  videoPlaying,
  setVideoPlaying,
  videoCurrentTime,
  setVideoCurrentTime,
  videoDuration,
  setVideoDuration,
  recordingDuration,
  videoPlayerRef,
}: RecorderVideoPlayerProps) {
  return (
    <div className="w-full max-w-[900px] mx-auto">
      <div
        ref={containerRef}
        className="video-box bg-white rounded-2xl shadow-md flex flex-col transition-all duration-300 overflow-hidden"
      >
        <div className="video-top w-full h-8 flex items-center px-4 gap-1.5 bg-[#f5f5f7] border-b border-[#ede7fa]">
          <div className="circle w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="circle w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="circle w-2 h-2 rounded-full bg-gray-300"></div>
        </div>

        <div className="screen relative w-full h-auto aspect-video bg-white overflow-hidden group">
          <PlayerTopBar
            volume={volume}
            onVolumeChange={onVolumeChange}
            onFullscreen={onFullscreen}
          />
          <ReactPlayer
            ref={videoPlayerRef}
            url={url}
            playing={videoPlaying}
            controls={false}
            muted={false}
            width="100%"
            height="100%"
            style={{
              objectFit: "contain",
              borderRadius: "1.25rem",
              background: "#F6F3FF",
            }}
            progressInterval={50}
            onProgress={({ playedSeconds }) => {
              if (playedSeconds === 0) {
                setVideoCurrentTime(0);
              } else {
                setVideoCurrentTime(playedSeconds);
              }

              if (videoDuration > 0 && playedSeconds >= videoDuration - 0.05) {
                setVideoPlaying(false);
              }
            }}
            onDuration={(dur) => {
              if (
                isUploaded &&
                recordingDuration === 0 &&
                isFinite(dur) &&
                !isNaN(dur) &&
                dur > 0
              ) {
                setVideoDuration(dur);
              } else if (!isUploaded && isFinite(dur) && !isNaN(dur) && dur > 0) {
                setVideoDuration(dur);
              }
            }}
            onStart={() => {
              setVideoCurrentTime(0);
            }}
            onPlay={() => {}}
            onEnded={() => setVideoPlaying(false)}
            onReady={() => {
              console.log("Video loaded in recorder");
              if ((isUploaded && recordingDuration === 0) || !isUploaded) {
                scheduleDurationReads(videoPlayerRef, setVideoDuration);
              }
            }}
            config={{
              file: {
                attributes: {
                  preload: "metadata",
                },
              },
            }}
          />

          {!videoPlaying && (
            <button
              onClick={() => {
                const isAtEnd = videoCurrentTime >= videoDuration - 0.1;
                if (isAtEnd && videoPlayerRef.current) {
                  videoPlayerRef.current.seekTo(0, "seconds");
                  setVideoCurrentTime(0);
                }
                setVideoPlaying(true);
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors"
            >
              <div className="play-circle bg-white hover:bg-gray-100 rounded-full p-4 transition-all shadow-lg text-[#7C5CFC]">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
        </div>
        <SimpleTimeline
          videoPlaying={videoPlaying}
          setVideoPlaying={setVideoPlaying}
          videoCurrentTime={videoCurrentTime}
          setVideoCurrentTime={setVideoCurrentTime}
          videoDuration={videoDuration}
          recordingDuration={recordingDuration}
          videoPlayerRef={videoPlayerRef}
        />
      </div>
    </div>
  );
}
