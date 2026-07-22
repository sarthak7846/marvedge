"use client";
import { useRef } from "react";
import ReactPlayer from "react-player";
import { useBlobStore } from "@/app/store/blobStore";
import { useScreenRecorder } from "@/app/hooks/useScreenRecorder";
import RecorderTopbar from "@/app/components/RecorderTopbar";

import { Toaster } from "sonner";
import { useSession } from "next-auth/react";
import SavePopupForm from "@/app/components/SavePopupForm";

import { useRecorderState, useRecordingTimer } from "./hooks/useRecorderState";
import { useVideoDuration } from "./hooks/useVideoDuration";
import { useRecorderActions, getUserInitials } from "./hooks/useRecorderActions";
import { useCameraControls } from "./hooks/useCameraControls";
import { isWtmPanelEnabled } from "@/app/lib/wtm/flags";

import InitialRecorderView from "@/app/components/InitialRecorderView";
import RecorderWorkspaceView from "./RecorderWorkspaceView";

export default function RecorderPage() {
  const videoPlayerRef = useRef<ReactPlayer>(null);

  const {
    uploadedFileUrl,
    setRecordingTimer,
    showSavePopup,
    setShowSavePopup,
    processingDownload,
    setProcessingDownload,
    videoDuration,
    setVideoDuration,
    fileInputRef,
    recordingIntervalRef,
  } = useRecorderState();

  const { blob, title } = useBlobStore();

  const {
    stopRecording,
    toggleMic,
    micEnabled,
    recording,
    videoUrl,
    screenStream,
    startScreenShare,
    recordingDuration,
    reset,
  } = useScreenRecorder();

  // WTM-6.4: optional webcam capture. The stream lands in the recording store,
  // where useScreenRecorder picks it up for its second (video-only) recorder.
  const cameraAvailable = isWtmPanelEnabled();
  const { cameraEnabled, cameraStarting, toggleCamera } = useCameraControls();

  const { data: session } = useSession();
  const initials = getUserInitials(session);

  const { handleBack, handleEditVideo, handlePopupDownload, isProcessingRef } = useRecorderActions({
    blob,
    setProcessingDownload,
    setShowSavePopup,
  });

  useRecordingTimer(recording, recordingIntervalRef, setRecordingTimer);
  useVideoDuration({
    videoUrl,
    uploadedFileUrl,
    videoDuration,
    recordingDuration,
    setVideoDuration,
    videoPlayerRef,
  });

  if (screenStream || uploadedFileUrl || videoUrl) {
    const isUploaded = !!uploadedFileUrl && !screenStream && !videoUrl;
    return (
      <RecorderWorkspaceView
        initials={initials}
        isUploaded={isUploaded}
        onBack={handleBack}
        onEditVideo={handleEditVideo}
        videoUrl={videoUrl}
        screenStream={screenStream}
        recording={recording}
        recordingDuration={recordingDuration}
        videoPlayerRef={videoPlayerRef}
        startScreenShare={startScreenShare}
        stopRecording={stopRecording}
        reset={reset}
        fileInputRef={fileInputRef}
        onPopupDownload={handlePopupDownload}
        isProcessingRef={isProcessingRef}
        cameraAvailable={cameraAvailable}
      />
    );
  }

  return (
    <div
      className="page flex flex-col h-screen w-full overflow-hidden"
      style={{ fontFamily: "var(--font-raleway)" }}
    >
      <Toaster position="top-right" />
      <RecorderTopbar onBack={handleBack} userInitials={initials} />

      <InitialRecorderView
        fileInputRef={fileInputRef}
        startScreenShare={startScreenShare}
        toggleMic={toggleMic}
        micEnabled={micEnabled}
        cameraAvailable={cameraAvailable}
        toggleCamera={toggleCamera}
        cameraEnabled={cameraEnabled}
        cameraStarting={cameraStarting}
      />

      <SavePopupForm
        isOpen={showSavePopup}
        onClose={() => {
          setShowSavePopup(false);
          isProcessingRef.current = false;
        }}
        onDownload={handlePopupDownload}
        initialTitle={title}
        processing={processingDownload}
      />
    </div>
  );
}
