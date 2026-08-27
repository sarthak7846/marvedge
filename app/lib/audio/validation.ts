// Validation + detection rules for audio uploads & trims (GitHub #285).
//
// Pure module — no I/O, no network, no server-only imports — so it can be
// shared by the API routes, the background worker and the unit tests.

/** Hard server-side cap: 50MB per file (mirrored client-side for UX). */
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

/** Allowed audio extensions for this feature. */
export const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg"] as const;

/** MIME types we accept (both what the client reports AND what magic-byte
 *  sniffing resolves to). Never trust the client header — `detectAudioMime`
 *  must resolve to one of these too. */
export const ALLOWED_AUDIO_MIME_TYPES: ReadonlySet<string> = new Set([
  "audio/mpeg", // mp3
  "audio/wav", // wav
  "audio/x-wav", // wav (alternative)
  "audio/mp4", // m4a (MP4 container)
  "audio/aac", // m4a (raw AAC — accepted for lenient clients)
  "audio/x-m4a", // m4a (alternative)
  "audio/ogg", // ogg
  "audio/opus", // ogg (opus stream)
]);

/** MIME the R2 object will be stored as, per file extension. */
const MIME_FOR_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};

export interface TrimRange {
  trimStartSec: number;
  trimEndSec: number;
  /** Original (pre-trim) clip duration, when known. Optional — the range is
   *  still validated as start ≥ 0 / end > start without it. */
  durationSec?: number | null;
}

export type TrimRangeResult = { ok: true } | { ok: false; error: string };

/**
 * Validate a trim time-range. `trimEndSec` may exceed the source duration (the
 * trim job clamps at EOF), so only reject ranges that are malformed or that
 * start beyond the end of the source.
 */
export function validateTrimRange({
  trimStartSec,
  trimEndSec,
  durationSec,
}: TrimRange): TrimRangeResult {
  if (!Number.isFinite(trimStartSec) || !Number.isFinite(trimEndSec)) {
    return { ok: false, error: "Trim times must be numbers" };
  }
  if (trimStartSec < 0) {
    return { ok: false, error: "Trim start cannot be negative" };
  }
  if (trimEndSec <= trimStartSec) {
    return { ok: false, error: "Trim end must be after the trim start" };
  }
  if (typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0) {
    if (trimStartSec >= durationSec) {
      return { ok: false, error: "Trim start is beyond the end of the audio" };
    }
  }
  return { ok: true };
}

export type UploadValidationResult =
  | { ok: true; fileName: string; ext: string; mimeType: string }
  | { ok: false; error: string };

/**
 * Sanitize a client-supplied filename into a safe, short object name.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export function extFromFilename(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  return name.slice(idx + 1).toLowerCase();
}

export function isAllowedAudioExtension(ext: string): boolean {
  return (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

export function mimeForExt(ext: string): string {
  return MIME_FOR_EXT[ext] ?? "application/octet-stream";
}

/**
 * Validate the client's declared upload (extension + reported MIME + size).
 * This is a first gate for honest clients; the real enforcement happens in the
 * metadata job, which re-checks size and sniff the actual bytes.
 */
export function validateUploadRequest(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): UploadValidationResult {
  const fileName = sanitizeFilename(input.fileName || "");
  if (!fileName) {
    return { ok: false, error: "A file name is required" };
  }

  const ext = extFromFilename(fileName);
  if (!isAllowedAudioExtension(ext)) {
    return { ok: false, error: "Unsupported file type — upload an MP3, WAV, M4A or OGG file" };
  }

  if (typeof input.size !== "number" || !Number.isFinite(input.size)) {
    return { ok: false, error: "Invalid file size" };
  }
  if (input.size <= 0) {
    return { ok: false, error: "The file is empty" };
  }
  if (input.size > AUDIO_MAX_BYTES) {
    return { ok: false, error: "File is larger than the 50MB limit" };
  }

  // The reported MIME is informational only — the stored type is derived from
  // the extension, and the metadata job re-sniffs the actual bytes.
  return { ok: true, fileName, ext, mimeType: mimeForExt(ext) };
}

/**
 * Sniff the real audio type from magic bytes — never trust the client's
 * Content-Type. Returns one of the allowed MIME types, or null when the bytes
 * do not look like an allowed audio container.
 */
export function detectAudioMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }
  const head = (start: number, end: number) => buffer.subarray(start, end).toString("ascii");

  // Ogg Vorbis / Opus.
  if (head(0, 4) === "OggS") {
    return "audio/ogg";
  }
  // MP3: ID3v2 tag, or an MPEG audio frame sync (0xFFEx / 0xFFFx).
  if (head(0, 3) === "ID3") {
    return "audio/mpeg";
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  // WAV: RIFF....WAVE.
  if (head(0, 4) === "RIFF" && head(8, 12) === "WAVE") {
    return "audio/wav";
  }
  // MP4/M4A family (isom-style ISO BMFF container).
  if (head(4, 8) === "ftyp") {
    return "audio/mp4";
  }
  return null;
}
