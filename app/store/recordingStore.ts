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
  // WTM-6.4 camera bubble: the live webcam stream and whether the user asked for
  // it. Kept here (like screenStream) so useScreenRecorder can pick the stream up
  // without useCameraControls having to be threaded through it.
  cameraEnabled: boolean;
  cameraStream: MediaStream | null;
  setRecording: (recording: boolean) => void;
  setVideoUrl: (videoUrl: string | null) => void;
  setMicEnabled: (micEnabled: boolean) => void;
  toggleMic: () => void;
  setScreenStream: (screenStream: MediaStream | null) => void;
  setRecordingDuration: (seconds: number) => void;
  setShowScreenShareModal: (show: boolean) => void;
  setCameraEnabled: (cameraEnabled: boolean) => void;
  setCameraStream: (cameraStream: MediaStream | null) => void;
  reset: () => void;
}>((set) => ({
  recording: false,
  videoUrl: null,
  micEnabled: false,
  screenStream: null,
  recordingDuration: 0,
  showScreenShareModal: false,
  cameraEnabled: false,
  cameraStream: null,
  setRecording: (recording) => set({ recording }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  toggleMic: () => set((state) => ({ micEnabled: !state.micEnabled })),
  setScreenStream: (screenStream) => set({ screenStream }),
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
  setShowScreenShareModal: (showScreenShareModal) => set({ showScreenShareModal }),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  setCameraStream: (cameraStream) => set({ cameraStream }),
  reset: () => set({ videoUrl: null, screenStream: null, recordingDuration: 0 }),
}));
