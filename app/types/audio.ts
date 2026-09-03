// Shared types for the audio upload & trim feature (GitHub #285).
// Used by the API routes (server), the background jobs (worker) and the editor
// UI (client). Pure types only — safe to import anywhere.

export type AudioClipStatus = "UPLOADING" | "PROCESSING" | "READY" | "TRIM_PROCESSING" | "FAILED";

/** A serialized AudioClip as returned by the audio API routes. */
export interface AudioClipDto {
  id: string;
  fileName: string;
  mimeType: string;
  durationSec: number | null;
  trimStartSec: number;
  trimEndSec: number | null;
  order: number;
  status: AudioClipStatus;
  error: string | null;
  originalUrl: string;
  trimmedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The raw AudioClip row as stored in the DB (worker + service layer). */
export interface AudioClipRecord {
  id: string;
  demoId: string;
  originalKey: string;
  trimmedKey: string | null;
  fileName: string;
  mimeType: string;
  durationSec: number | null;
  trimStartSec: number;
  trimEndSec: number | null;
  order: number;
  status: AudioClipStatus;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}
