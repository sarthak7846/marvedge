// AudioClip status transitions (GitHub #285).
//
// The AudioClip lifecycle is: UPLOADING → (metadata job) PROCESSING → READY,
// then READY → (trim request) TRIM_PROCESSING → (trim job) READY. Any job can
// fail into FAILED, and a FAILED clip may be retried into TRIM_PROCESSING (a
// re-trim). These helpers are shared by the API routes (which enforce them on
// user-initiated actions) and are unit-tested in status.test.ts.

import type { AudioClipStatus } from "../../types/audio";

export const AUDIO_CLIP_STATUSES: readonly AudioClipStatus[] = [
  "UPLOADING",
  "PROCESSING",
  "READY",
  "TRIM_PROCESSING",
  "FAILED",
];

const ALLOWED_TRANSITIONS: Record<AudioClipStatus, readonly AudioClipStatus[]> = {
  UPLOADING: ["PROCESSING"],
  PROCESSING: ["READY", "FAILED"],
  TRIM_PROCESSING: ["READY", "FAILED"],
  READY: ["TRIM_PROCESSING"],
  FAILED: ["TRIM_PROCESSING"],
};

/** Statuses a clip must be in before the user can request a trim. */
export const TRIMABLE_STATUSES: readonly AudioClipStatus[] = ["READY", "FAILED"];

/** Statuses that mean "a background job is still working on this clip". */
export const PROCESSING_STATUSES: readonly AudioClipStatus[] = [
  "UPLOADING",
  "PROCESSING",
  "TRIM_PROCESSING",
];

export function isProcessingStatus(status: AudioClipStatus): boolean {
  return PROCESSING_STATUSES.includes(status);
}

export function canTransition(from: AudioClipStatus, to: AudioClipStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Throws if `from → to` is not an allowed transition. Used by the service layer
 * for user-initiated transitions so a stray/duplicate request can never move a
 * clip backwards or forwards through an invalid path.
 */
export function assertTransition(from: AudioClipStatus, to: AudioClipStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid AudioClip status transition: ${from} → ${to}`);
  }
}
