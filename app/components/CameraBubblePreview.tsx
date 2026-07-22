"use client";
import { useEffect, useRef } from "react";

import { useRecordingStore } from "@/app/store/recordingStore";

interface CameraBubblePreviewProps {
  /** Position/size utilities. Defaults to a 96px bubble in normal flow. */
  className?: string;
}

/**
 * Live circular self-view of the recorder's webcam (WTM-6.4).
 *
 * Subscribes to the camera stream directly rather than taking a ref from
 * useCameraControls, so several preview surfaces (the pre-recording framing
 * view and the floating one shown while recording) can coexist and remount
 * freely. Renders nothing when the camera is off.
 */
export default function CameraBubblePreview({ className = "" }: CameraBubblePreviewProps) {
  const cameraStream = useRecordingStore((s) => s.cameraStream);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.srcObject = cameraStream;
    return () => {
      element.srcObject = null;
    };
  }, [cameraStream]);

  if (!cameraStream) {
    return null;
  }

  return (
    <div
      className={`overflow-hidden rounded-full border-2 border-[#8A76FC] bg-black shadow-lg ${
        className || "h-24 w-24"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Video-only stream, but muted keeps autoplay policies happy everywhere.
        muted
        className="h-full w-full object-cover"
      />
    </div>
  );
}
