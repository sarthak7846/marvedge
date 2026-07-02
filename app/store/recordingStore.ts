import { create } from "zustand";

// Recording-engine value/boolean state extracted from useScreenRecorder.
// MediaRecorder instances and other refs stay in the hook; only the
// serializable UI/value state lives here.
export const useRecordingStore = create<{
  recording: boolean;
  videoUrl: string | null;
  micEnabled: boolean;
  screenStream: MediaStream | null;
  recordingDuration: number;
  showScreenShareModal: boolean;
  setRecording: (recording: boolean) => void;
  setVideoUrl: (videoUrl: string | null) => void;
  setMicEnabled: (micEnabled: boolean) => void;
  toggleMic: () => void;
  setScreenStream: (screenStream: MediaStream | null) => void;
  setRecordingDuration: (seconds: number) => void;
  setShowScreenShareModal: (show: boolean) => void;
  reset: () => void;
}>((set) => ({
  recording: false,
  videoUrl: null,
  micEnabled: false,
  screenStream: null,
  recordingDuration: 0,
  showScreenShareModal: false,
  setRecording: (recording) => set({ recording }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  toggleMic: () => set((state) => ({ micEnabled: !state.micEnabled })),
  setScreenStream: (screenStream) => set({ screenStream }),
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
  setShowScreenShareModal: (showScreenShareModal) => set({ showScreenShareModal }),
  reset: () => set({ videoUrl: null, screenStream: null, recordingDuration: 0 }),
}));
