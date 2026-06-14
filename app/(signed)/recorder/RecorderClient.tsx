"use client";
import { useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import { useRouter } from "next/navigation";
import { useBlobStore } from "@/app/store/blobStore";
import { useScreenRecorder } from "@/app/hooks/useScreenRecorder";
import RecorderTopbar from "@/app/components/RecorderTopbar";
import { videoToMP4 } from "@/app/lib/ffmpeg";

import { toast, Toaster } from "sonner";
import { useSession } from "next-auth/react";
import SavePopupForm from "@/app/components/SavePopupForm";
import { sanitizeFilename } from "@/app/lib/constants";

import { useRecorderState, useRecordingTimer } from "./hooks/useRecorderState";
import { useVideoDuration } from "./hooks/useVideoDuration";

import VideoPlayerSection from "@/app/components/VideoPlayerSection";
import RecordingControls from "@/app/components/RecordingControls";
import InitialRecorderView from "@/app/components/InitialRecorderView";

export default function RecorderPage() {
  const videoPlayerRef = useRef<ReactPlayer>(null);
  const router = useRouter();

  const isProcessingRef = useRef(false);

  const handleBack = useCallback(() => {
    try {
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  const handleEditVideo = useCallback(() => {
    try {
      router.push("/editor");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

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

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session?.user?.email?.[0]?.toUpperCase() || "U";

  useRecordingTimer(recording, recordingIntervalRef, setRecordingTimer);
  useVideoDuration({
    videoUrl,
    uploadedFileUrl,
    videoDuration,
    recordingDuration,
    setVideoDuration,
    videoPlayerRef,
  });

  const handlePopupDownload = async (data: { title: string; format: string }) => {
    if (!blob) {
      isProcessingRef.current = false;
      return;
    }

    setProcessingDownload(true);
    try {
      if (data.format === "mp4") {
        const outputBlob = await videoToMP4(blob);
        const url = URL.createObjectURL(outputBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sanitizeFilename(data.title) || "recording"}.mp4`;
        a.click();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sanitizeFilename(data.title) || "recording"}.webm`;
        a.click();
      }
      toast.success("Video downloaded successfully!");
      setShowSavePopup(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to download video.");

      isProcessingRef.current = false;
    } finally {
      setProcessingDownload(false);
    }
  };

  if (screenStream || uploadedFileUrl || videoUrl) {
    const isUploaded = !!uploadedFileUrl && !screenStream && !videoUrl;
    return (
      <div
        className="page flex flex-col h-screen w-full overflow-hidden"
        style={{ fontFamily: "var(--font-raleway)" }}
      >
        <RecorderTopbar onBack={handleBack} userInitials={initials} />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="header w-full flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-12 py-4 sm:py-6 bg-[#f3f0fc] border-b border-[#ede7fa]">
              <div>
                <div className="text-lg sm:text-2xl font-semibold text-[#1A0033]">
                  New Recording
                </div>
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
                  onEditVideo={handleEditVideo}
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
          onDownload={handlePopupDownload}
          initialTitle={title}
          processing={processingDownload}
        />
      </div>
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
