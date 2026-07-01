import { useRef, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRecorderStore } from "@/app/store/recorderStore";

/**
 * Thin shim over the recorderStore (strangler pattern). Returns the same shape
 * the god-hook used to expose so existing consumers keep working untouched, but
 * the UI state now lives in the Zustand store. Refs stay local to the caller.
 */
export function useRecorderState() {
  const state = useRecorderStore(
    useShallow((s) => ({
      uploadMessage: s.uploadMessage,
      setUploadMessage: s.setUploadMessage,
      uploadedFileUrl: s.uploadedFileUrl,
      setUploadedFileUrl: s.setUploadedFileUrl,
      uploadedFileType: s.uploadedFileType,
      setUploadedFileType: s.setUploadedFileType,
      format: s.format,
      setFormat: s.setFormat,
      recordingTimer: s.recordingTimer,
      setRecordingTimer: s.setRecordingTimer,
      showSavePopup: s.showSavePopup,
      setShowSavePopup: s.setShowSavePopup,
      processingDownload: s.processingDownload,
      setProcessingDownload: s.setProcessingDownload,
      videoPlaying: s.videoPlaying,
      setVideoPlaying: s.setVideoPlaying,
      videoCurrentTime: s.videoCurrentTime,
      setVideoCurrentTime: s.setVideoCurrentTime,
      videoDuration: s.videoDuration,
      setVideoDuration: s.setVideoDuration,
      sidebarOpen: s.sidebarOpen,
      setSidebarOpen: s.setSidebarOpen,
      isSavePublishDisabled: s.isSavePublishDisabled,
      setIsSavePublishDisabled: s.setIsSavePublishDisabled,
    }))
  );

  // saveMessage was always "" (no setter was ever exposed); keep it for parity.
  const saveMessage = "";

  // Refs stay as refs — they do not belong in the store.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  return {
    ...state,
    saveMessage,
    fileInputRef,
    recordingIntervalRef,
  };
}

export function useRecordingTimer(
  recording: boolean,
  recordingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>,
  setRecordingTimer: (value: number | ((prev: number) => number)) => void
) {
  // Enhanced initialization
  useEffect(() => {
    setRecordingTimer(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [recordingIntervalRef, setRecordingTimer]);

  // Improved recording timer logic
  useEffect(() => {
    if (recording) {
      setRecordingTimer(0); // Reset to 0 when recording starts

      // Clear existing interval first
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Start new interval after delay to ensure recording is active
      const timer = setTimeout(() => {
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTimer((prev) => prev + 1);
        }, 1000);
      }, 100);

      return () => {
        clearTimeout(timer);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };
    } else {
      // Stop and reset timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTimer(0);
    }
  }, [recording, recordingIntervalRef, setRecordingTimer]);
}
