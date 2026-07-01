import ReactPlayer from "react-player";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import RecorderTopbar from "@/app/components/RecorderTopbar";
import SavePopupForm from "@/app/components/SavePopupForm";
import VideoPlayerSection from "@/app/components/VideoPlayerSection";
import RecordingControls from "@/app/components/RecordingControls";
import { useRecorderStore } from "@/app/store/recorderStore";
import { useBlobStore } from "@/app/store/blobStore";

interface RecorderWorkspaceViewProps {
  initials: string;
  isUploaded: boolean;
  onBack: () => void;
  onEditVideo: () => void;
  videoUrl: string | null;
  screenStream: MediaStream | null;
  recording: boolean;
  recordingDuration: number;
  videoPlayerRef: React.RefObject<ReactPlayer | null>;
  startScreenShare: () => void;
  stopRecording: () => void;
  reset: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPopupDownload: (data: { title: string; format: string }) => void;
  isProcessingRef: React.MutableRefObject<boolean>;
}

// saveMessage was always "" (no setter was ever exposed); kept for parity.
const saveMessage = "";

export default function RecorderWorkspaceView({
  initials,
  isUploaded,
  onBack,
  onEditVideo,
  videoUrl,
  screenStream,
  recording,
  recordingDuration,
  videoPlayerRef,
  startScreenShare,
  stopRecording,
  reset,
  fileInputRef,
  onPopupDownload,
  isProcessingRef,
}: RecorderWorkspaceViewProps) {
  const {
    uploadedFileType,
    uploadedFileUrl,
    videoPlaying,
    setVideoPlaying,
    videoCurrentTime,
    setVideoCurrentTime,
    videoDuration,
    setVideoDuration,
    recordingTimer,
    showSavePopup,
    setShowSavePopup,
    processingDownload,
    setUploadedFileUrl,
    setUploadedFileType,
  } = useRecorderStore(
    useShallow((s) => ({
      uploadedFileType: s.uploadedFileType,
      uploadedFileUrl: s.uploadedFileUrl,
      videoPlaying: s.videoPlaying,
      setVideoPlaying: s.setVideoPlaying,
      videoCurrentTime: s.videoCurrentTime,
      setVideoCurrentTime: s.setVideoCurrentTime,
      videoDuration: s.videoDuration,
      setVideoDuration: s.setVideoDuration,
      recordingTimer: s.recordingTimer,
      showSavePopup: s.showSavePopup,
      setShowSavePopup: s.setShowSavePopup,
      processingDownload: s.processingDownload,
      setUploadedFileUrl: s.setUploadedFileUrl,
      setUploadedFileType: s.setUploadedFileType,
    }))
  );

  const { setBlob, title } = useBlobStore(
    useShallow((s) => ({ setBlob: s.setBlob, title: s.title }))
  );

  return (
    <div
      className="page flex flex-col h-screen w-full overflow-hidden"
      style={{ fontFamily: "var(--font-raleway)" }}
    >
      <RecorderTopbar onBack={onBack} userInitials={initials} />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="header w-full flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-12 py-4 sm:py-6 bg-[#f3f0fc] border-b border-[#ede7fa]">
            <div>
              <div className="text-lg sm:text-2xl font-semibold text-[#1A0033]">New Recording</div>
              <p className="text-xs sm:text-sm text-gray-400">Last saved 2 minutes ago</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="video-wrapper bg-white rounded-2xl shadow p-4 sm:p-8 flex-1 overflow-y-auto ml-4 sm:ml-12 mr-4 sm:mr-12">
              <VideoPlayerSection
                uploadedFileType={uploadedFileType}
                uploadedFileUrl={uploadedFileUrl}
                videoUrl={videoUrl}
                screenStream={screenStream}
                recording={recording}
                videoPlaying={videoPlaying}
                setVideoPlaying={setVideoPlaying}
                videoCurrentTime={videoCurrentTime}
                setVideoCurrentTime={setVideoCurrentTime}
                videoDuration={videoDuration}
                setVideoDuration={setVideoDuration}
                recordingDuration={recordingDuration}
                recordingTimer={recordingTimer}
                videoPlayerRef={videoPlayerRef}
              />
              <RecordingControls
                screenStream={screenStream}
                recording={recording}
                isUploaded={isUploaded}
                videoUrl={videoUrl}
                saveMessage={saveMessage}
                startScreenShare={startScreenShare}
                stopRecording={stopRecording}
                setUploadedFileUrl={setUploadedFileUrl}
                setUploadedFileType={setUploadedFileType}
                setBlob={setBlob}
                reset={reset}
                onEditVideo={onEditVideo}
                fileInputRef={fileInputRef}
              />
            </div>
          </div>
        </main>
      </div>

      <input
        type="file"
        accept="video/mp4,video/webm,video/*"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const fileUrl = URL.createObjectURL(file);
            setUploadedFileUrl(fileUrl);
            setUploadedFileType(file.type);
            setBlob(file);
            toast.success("File uploaded successfully!");
          }
        }}
      />

      <SavePopupForm
        isOpen={showSavePopup}
        onClose={() => {
          setShowSavePopup(false);
          isProcessingRef.current = false;
        }}
        onDownload={onPopupDownload}
        initialTitle={title}
        processing={processingDownload}
      />
    </div>
  );
}
