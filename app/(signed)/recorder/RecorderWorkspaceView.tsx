import ReactPlayer from "react-player";
import { toast } from "sonner";
import RecorderTopbar from "@/app/components/RecorderTopbar";
import SavePopupForm from "@/app/components/SavePopupForm";
import VideoPlayerSection from "@/app/components/VideoPlayerSection";
import RecordingControls from "@/app/components/RecordingControls";

interface RecorderWorkspaceViewProps {
  initials: string;
  isUploaded: boolean;
  onBack: () => void;
  onEditVideo: () => void;
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
  saveMessage: string;
  startScreenShare: () => void;
  stopRecording: () => void;
  setUploadedFileUrl: (url: string | null) => void;
  setUploadedFileType: (type: string | null) => void;
  setBlob: (blob: Blob | null) => void;
  reset: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  showSavePopup: boolean;
  setShowSavePopup: (open: boolean) => void;
  onPopupDownload: (data: { title: string; format: string }) => void;
  title: string;
  processingDownload: boolean;
  isProcessingRef: React.MutableRefObject<boolean>;
}

export default function RecorderWorkspaceView({
  initials,
  isUploaded,
  onBack,
  onEditVideo,
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
  saveMessage,
  startScreenShare,
  stopRecording,
  setUploadedFileUrl,
  setUploadedFileType,
  setBlob,
  reset,
  fileInputRef,
  showSavePopup,
  setShowSavePopup,
  onPopupDownload,
  title,
  processingDownload,
  isProcessingRef,
}: RecorderWorkspaceViewProps) {
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
