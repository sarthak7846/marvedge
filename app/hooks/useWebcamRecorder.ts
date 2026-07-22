"use client";
import { useRef } from "react";

import { useRecordingStore } from "../store/recordingStore";
import { isWtmPanelEnabled } from "../lib/wtm/flags";
import { beginWebcamCapture, clearWebcamSource, uploadWebcamClip } from "../lib/wtm/webcamSource";

// The webcam is recorded by a SECOND MediaRecorder with no audio codec at all:
// the screen recording already carries the mic and tab audio, so muxing the
// webcam's own audio would double it in the export.
const pickCameraRecorderMimeType = (): string =>
  MediaRecorder.isTypeSupported("video/webm; codecs=vp8")
    ? "video/webm; codecs=vp8"
    : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";

const createCameraRecorder = (stream: MediaStream): MediaRecorder => {
  const mimeType = pickCameraRecorderMimeType();
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
};

/**
 * The camera-bubble half of recording (WTM-6.4), kept entirely separate from
 * useScreenRecorder's own recorder so the screen path is never affected by what
 * the camera does. Every failure here degrades to "no bubble this take".
 *
 * The camera stream comes from the recording store (see useCameraControls); if
 * there is none, or the WTM flag is off, all three methods are no-ops and the
 * recorder behaves exactly as it did before the feature existed.
 */
export function useWebcamRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("video/webm");

  // Builds the webcam clip out of whatever was captured and hands it to the
  // (fire-and-forget) upload. The camera's live tracks are NOT stopped here —
  // they belong to useCameraControls and keep feeding the preview.
  const finalize = () => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    recorderRef.current = null;
    if (chunks.length === 0) {
      return;
    }
    void uploadWebcamClip(new Blob(chunks, { type: mimeTypeRef.current }));
  };

  /**
   * Arms the camera recorder for this take, or clears any stale webcam config
   * when there is no camera. Returns a start thunk the caller fires in the same
   * tick as the screen recorder, so the two clips stay in lockstep; null means
   * "no camera this take", and every failure path lands there so the screen
   * recording is never blocked.
   */
  const prepare = (): (() => void) | null => {
    recorderRef.current = null;
    chunksRef.current = [];

    if (!isWtmPanelEnabled()) {
      return null;
    }

    const videoTracks = useRecordingStore.getState().cameraStream?.getVideoTracks() ?? [];
    if (videoTracks.length === 0) {
      // Recorded without the camera: make sure a previous take's clip is not
      // inherited by this one.
      clearWebcamSource();
      return null;
    }

    try {
      // Video tracks only — the camera stream is captured without audio in the
      // first place (see useCameraControls), and this makes that explicit.
      const recorder = createCameraRecorder(new MediaStream(videoTracks));
      mimeTypeRef.current = recorder.mimeType || "video/webm";
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        finalize();
      };
      recorder.onerror = (event) => {
        console.warn("Camera recording failed:", event);
      };
      recorderRef.current = recorder;
      beginWebcamCapture();
      return () => {
        try {
          recorder.start(250);
        } catch (err) {
          // A camera that refuses to start must never fail the screen recording.
          console.warn("Camera recording failed to start:", err);
        }
      };
    } catch (err) {
      console.warn("Could not record the camera:", err);
      clearWebcamSource();
      return null;
    }
  };

  /** Stops the camera recorder in lockstep with the screen one, then uploads. */
  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // → onstop → finalize
    } else {
      finalize();
    }
  };

  /** The take was discarded: its clip must not survive into the next one. */
  const discard = () => {
    chunksRef.current = [];
    if (isWtmPanelEnabled()) {
      clearWebcamSource();
    }
  };

  return { prepare, stop, discard };
}
