"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { useRecordingStore } from "@/app/store/recordingStore";
import { isWtmPanelEnabled } from "@/app/lib/wtm/flags";

/**
 * Owns the recorder's optional webcam stream (WTM-6.4).
 *
 * The stream itself lives in the recording store next to `screenStream`, so
 * useScreenRecorder can attach its second, video-only MediaRecorder to it and
 * any number of preview surfaces can render it without the ref being threaded
 * through the tree.
 *
 * Camera capture is deliberately free for everyone — the PRO gate sits at export
 * time, where the bubble is actually composited in. The whole thing is still
 * behind NEXT_PUBLIC_WTM_ENABLED, so with the flag off the camera never starts
 * and the recorder behaves exactly as it did before.
 */
export function useCameraControls() {
  const { cameraEnabled, cameraStream, setCameraEnabled, setCameraStream } = useRecordingStore(
    useShallow((s) => ({
      cameraEnabled: s.cameraEnabled,
      cameraStream: s.cameraStream,
      setCameraEnabled: s.setCameraEnabled,
      setCameraStream: s.setCameraStream,
    }))
  );

  // True while the browser permission prompt is up, so the toggle can't be
  // double-fired into two concurrent getUserMedia calls.
  const [cameraStarting, setCameraStarting] = useState(false);

  const stopCamera = useCallback(() => {
    const { cameraStream: current } = useRecordingStore.getState();
    current?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraEnabled(false);
  }, [setCameraEnabled, setCameraStream]);

  const startCamera = useCallback(async () => {
    if (!isWtmPanelEnabled() || useRecordingStore.getState().cameraStream) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera is not available in this browser.");
      return;
    }

    setCameraStarting(true);
    try {
      // Video only, always: the screen recording already carries mic/tab audio,
      // and muxing the webcam's mic on top would double it in the export.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      setCameraStream(stream);
      setCameraEnabled(true);
    } catch (error) {
      console.error("Camera access denied or not available:", error);
      const denied =
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      toast.error(
        denied
          ? "Camera permission denied. Recording will continue without the camera."
          : "Could not start the camera. Recording will continue without it."
      );
      // Degrade to no camera — the screen recording is unaffected.
      setCameraStream(null);
      setCameraEnabled(false);
    } finally {
      setCameraStarting(false);
    }
  }, [setCameraEnabled, setCameraStream]);

  const toggleCamera = useCallback(() => {
    if (cameraStarting) {
      return;
    }
    if (useRecordingStore.getState().cameraStream) {
      stopCamera();
    } else {
      void startCamera();
    }
  }, [cameraStarting, startCamera, stopCamera]);

  // Release the camera when the recorder unmounts, so the hardware indicator
  // doesn't stay lit after the user leaves the page.
  useEffect(() => {
    return () => {
      const { cameraStream: current } = useRecordingStore.getState();
      current?.getTracks().forEach((track) => track.stop());
      useRecordingStore.setState({ cameraStream: null, cameraEnabled: false });
    };
  }, []);

  return {
    cameraStream,
    cameraEnabled,
    cameraStarting,
    startCamera,
    stopCamera,
    toggleCamera,
  };
}
