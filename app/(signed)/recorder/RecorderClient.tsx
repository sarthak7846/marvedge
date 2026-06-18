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

import InitialRecorderView from "@/app/components/InitialRecorderView";
import RecorderWorkspaceView from "./RecorderWorkspaceView";

export default function RecorderPage() {
  const videoPlayerRef = useRef<ReactPlayer>(null);

  const {
    uploadMessage,
    setUploadMessage,
    uploadedFileUrl,
    setUploadedFileUrl,
    uploadedFileType,
    setUploadedFileType,
    saveMessage,
    recordingTimer,
    setRecordingTimer,
    showSavePopup,
    setShowSavePopup,
    processingDownload,
    setProcessingDownload,
    videoPlaying,
    setVideoPlaying,
    videoCurrentTime,
    setVideoCurrentTime,
    videoDuration,
    setVideoDuration,
    sidebarOpen,
    setSidebarOpen,

    fileInputRef,
    recordingIntervalRef,
  } = useRecorderState();

  const { setBlob, blob, title, setTitle } = useBlobStore();

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
        saveMessage={saveMessage}
        startScreenShare={startScreenShare}
        stopRecording={stopRecording}
        setUploadedFileUrl={setUploadedFileUrl}
        setUploadedFileType={setUploadedFileType}
        setBlob={setBlob}
        reset={reset}
        fileInputRef={fileInputRef}
        showSavePopup={showSavePopup}
        setShowSavePopup={setShowSavePopup}
        onPopupDownload={handlePopupDownload}
        title={title}
        processingDownload={processingDownload}
        isProcessingRef={isProcessingRef}
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
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        title={title}
        setTitle={setTitle}
        uploadedFileUrl={uploadedFileUrl}
        setUploadedFileUrl={setUploadedFileUrl}
        setUploadedFileType={setUploadedFileType}
        setUploadMessage={setUploadMessage}
        uploadMessage={uploadMessage}
        fileInputRef={fileInputRef}
        startScreenShare={startScreenShare}
        toggleMic={toggleMic}
        micEnabled={micEnabled}
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
