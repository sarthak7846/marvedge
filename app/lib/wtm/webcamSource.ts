"use client";
// Client-side bridge between the recorder's camera capture (WTM-6.4) and the
// editor's persisted WTM state.
//
// The recorder produces a webcam clip; the editor owns `editing.wtm`. Rather
// than thread the URL through the recorder → editor navigation, the clip is
// uploaded and written straight into the editor store's `wtm` slice — the same
// slice the Branding panel edits — from where the existing autosave / local
// draft carries it into `Demo.editing.wtm.webcam` with no migration.

import { toast } from "sonner";

import type { WebcamOverlay, WtmState } from "@/app/types/wtm";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { uploadBlobToGcs } from "@/app/lib/gcsUploadClient";

import { DEFAULT_WEBCAM, sanitizeWebcamConfig } from "./webcam";

/** Merge into `wtm.webcam`, preserving the rest of the WTM state (watermark). */
function updateWebcam(patch: Partial<WebcamOverlay>): void {
  useEditorStore.getState().setWtm((prev) => {
    const base: WtmState = prev ?? {};
    return {
      ...base,
      webcam: { ...DEFAULT_WEBCAM, ...base.webcam, ...patch },
    };
  });
}

/**
 * Called when a camera recording starts. Marks the bubble as wanted and drops
 * any `sourceUrl` left over from a previous take, so a failed or abandoned
 * upload can never leave the new recording pointing at the old clip.
 */
export function beginWebcamCapture(): void {
  useEditorStore.getState().setWtm((prev) => {
    const base: WtmState = prev ?? {};
    const next = { ...DEFAULT_WEBCAM, ...base.webcam, enabled: true };
    delete next.sourceUrl;
    return { ...base, webcam: next };
  });
}

/**
 * Drops the webcam overlay entirely — used when a recording is made without the
 * camera, or discarded, so a stale clip from an earlier take is not inherited.
 * A no-op when there is nothing to clear, so demos that never touched the camera
 * keep their `wtm` state exactly as it was.
 */
export function clearWebcamSource(): void {
  const { wtm, setWtm } = useEditorStore.getState();
  if (!wtm?.webcam) {
    return;
  }
  const next: WtmState = { ...wtm };
  delete next.webcam;
  setWtm(next);
}

/**
 * Uploads a captured webcam clip and persists its URL to `wtm.webcam.sourceUrl`.
 *
 * Deliberately fire-and-forget: it runs alongside the existing save/redirect
 * flow and never blocks it. A failure is a toast, not a hard error — the screen
 * recording is already safe and simply exports without a bubble.
 */
export async function uploadWebcamClip(blob: Blob): Promise<void> {
  try {
    const uploaded = await uploadBlobToGcs({
      blob,
      filename: `webcam-${Date.now()}.webm`,
      kind: "webcam-source",
    });
    // Prefer the https form: `url` is gs://, which the worker cannot fetch.
    const sourceUrl = uploaded.publicUrl || uploaded.url;
    const sanitized = sanitizeWebcamConfig({ ...DEFAULT_WEBCAM, enabled: true, sourceUrl });
    if (!sanitized?.sourceUrl) {
      throw new Error("Upload returned no usable webcam URL");
    }
    updateWebcam({ enabled: true, sourceUrl: sanitized.sourceUrl });
    toast.success("Camera clip saved");
  } catch (error) {
    console.error("Webcam clip upload failed:", error);
    toast.error("Could not save the camera clip. Your recording is unaffected.");
  }
}
