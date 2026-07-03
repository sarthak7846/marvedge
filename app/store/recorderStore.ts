import { create } from "zustand";

type RecorderFormat = "webm" | "mp4";

interface RecorderStore {
  // Upload state
  uploadMessage: string;
  uploadedFileUrl: string | null;
  uploadedFileType: string | null;
  format: RecorderFormat;

  // Recording / save flow
  recordingTimer: number;
  showSavePopup: boolean;
  processingDownload: boolean;

  // Video playback
  videoPlaying: boolean;
  videoCurrentTime: number;
  videoDuration: number;

  // Layout
  sidebarOpen: boolean;
  isSavePublishDisabled: boolean;

  // Setters
  setUploadMessage: (uploadMessage: string) => void;
  setUploadedFileUrl: (uploadedFileUrl: string | null) => void;
  setUploadedFileType: (uploadedFileType: string | null) => void;
  setFormat: (format: RecorderFormat) => void;
  setRecordingTimer: (value: number | ((prev: number) => number)) => void;
  setShowSavePopup: (showSavePopup: boolean) => void;
  setProcessingDownload: (processingDownload: boolean) => void;
  setVideoPlaying: (videoPlaying: boolean) => void;
  setVideoCurrentTime: (videoCurrentTime: number) => void;
  setVideoDuration: (videoDuration: number) => void;
  setSidebarOpen: (sidebarOpen: boolean) => void;
  setIsSavePublishDisabled: (isSavePublishDisabled: boolean) => void;
  reset: () => void;
}

const initialState = {
  uploadMessage: "",
  uploadedFileUrl: null,
  uploadedFileType: null,
  format: "webm" as RecorderFormat,
  recordingTimer: 0,
  showSavePopup: false,
  processingDownload: false,
  videoPlaying: false,
  videoCurrentTime: 0,
  videoDuration: 0,
  sidebarOpen: false,
  isSavePublishDisabled: false,
};

export const useRecorderStore = create<RecorderStore>((set) => ({
  ...initialState,
  setUploadMessage: (uploadMessage) => set({ uploadMessage }),
  setUploadedFileUrl: (uploadedFileUrl) => set({ uploadedFileUrl }),
  setUploadedFileType: (uploadedFileType) => set({ uploadedFileType }),
  setFormat: (format) => set({ format }),
  setRecordingTimer: (value) =>
    set((state) => ({
      recordingTimer: typeof value === "function" ? value(state.recordingTimer) : value,
    })),
  setShowSavePopup: (showSavePopup) => set({ showSavePopup }),
  setProcessingDownload: (processingDownload) => set({ processingDownload }),
  setVideoPlaying: (videoPlaying) => set({ videoPlaying }),
  setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime }),
  setVideoDuration: (videoDuration) => set({ videoDuration }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setIsSavePublishDisabled: (isSavePublishDisabled) => set({ isSavePublishDisabled }),
  reset: () => set({ ...initialState }),
}));
