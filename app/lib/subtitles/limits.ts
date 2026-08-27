// Input limits for the subtitle feature: what a user may upload, and how long a
// video we will transcribe (PRD §6.1 and §13).
//
// Pure and isomorphic, like the rest of app/lib/subtitles — no fs, no env, no
// DOM. That matters more here than anywhere else in the library, because these
// numbers have to be enforced in THREE places at once and disagreeing copies are
// the whole failure mode:
//
//   1. the file input's `accept` attribute and its change handler (a fast, local
//      rejection with a message the user can act on);
//   2. app/api/gcs/upload/route.ts, which mints the signed URL (the browser check
//      is a convenience — anyone can POST this route directly); and
//   3. app/api/subtitles/create/route.ts, which decides whether a video is short
//      enough to transcribe at all.
//
// WHY WEBM IS ALLOWED WHEN THE PRD DOES NOT LIST IT
// ------------------------------------------------
// PRD §6.1 names MP4, MOV, AVI and MKV — that list describes files a user picks
// off their disk. Marvedge is recording-first: `MediaRecorder` produces WEBM, and
// every recorded demo, webcam clip and subtitle source in the product is a
// `.webm` blob going through this same upload route. Enforcing the PRD's list
// literally would reject the product's primary path on the way in. So webm is a
// first-class member of the accepted set and is deliberately NOT offered in the
// picker's file-type hint, which stays the PRD's four.

/**
 * Ceiling on an uploaded video, in bytes (PRD §6.1: 2 GB).
 *
 * Binary GB, matching how a file manager reports a file's size — a user looking
 * at "2.0 GB" in Explorer and getting told 2 GB is too large would be right to
 * be confused.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Longest video we will transcribe, in seconds (PRD §13: 2 hours).
 *
 * This is a ceiling on the SOURCE, checked before a job is created. Deepgram
 * itself is happy with far longer, but the worker holds the whole file and the
 * extracted WAV on a Cloud Run instance's local disk, and the Next route that
 * awaits it has a 300s `maxDuration`. Two hours is where those two stop being
 * comfortable — past it the honest answer is a clear refusal, not a job that
 * dies halfway with a timeout the user cannot interpret.
 */
export const MAX_SUBTITLE_DURATION_SECONDS = 2 * 60 * 60;

/**
 * Video containers accepted on upload: the PRD's four, plus the webm the
 * recorder itself produces (see the module header).
 */
export const UPLOAD_VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm"] as const;

/**
 * The `accept` attribute for a video file input.
 *
 * Extensions AND MIME types, on purpose. Browsers disagree about what they
 * report for the less common containers — Windows hands back an empty string for
 * `.mkv` fairly often, and `.avi` arrives as anything from `video/x-msvideo` to
 * `video/avi` — so an extension-only or MIME-only list greys out files that are
 * perfectly valid. `accept` is a filter for the file picker, not a security
 * control; `validateVideoUpload` is the check that actually decides.
 */
export const UPLOAD_VIDEO_ACCEPT =
  ".mp4,.mov,.avi,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm";

/**
 * MIME types that map onto the accepted containers. Several spellings per
 * container because browsers and operating systems do not agree; a type absent
 * from this list is not fatal on its own — the extension gets the deciding vote.
 */
const ACCEPTED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/avi",
  "video/msvideo",
  "video/x-matroska", // .mkv
  "video/webm",
]);

/**
 * Upload kinds whose payload is a video, and so are subject to the container and
 * size rules. The kinds NOT listed here (a watermark PNG, a background image)
 * carry something else entirely and must not be measured against a video's
 * limits — see app/lib/gcsUploadClient.ts for the full set.
 */
const VIDEO_UPLOAD_KINDS = new Set([
  "demo-source",
  "export-source",
  "webcam-source",
  "subtitle-source",
]);

/** Whether an upload of this `kind` carries a video. Unknown kinds do not. */
export function isVideoUploadKind(kind: string): boolean {
  return VIDEO_UPLOAD_KINDS.has(kind.trim().toLowerCase());
}

/** Lowercased extension of `filename`, without the dot; `""` when it has none. */
export function fileExtension(filename: string): string {
  const name = filename.trim();
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return "";
  }
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Render a byte count the way a user would say it. Used in the rejection
 * messages, so "2.4 GB" comes back rather than a raw 2576980378.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 MB";
  }
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Render a duration the way a user would say it ("2h 14m", "9m 30s"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

/** The container list as a user-facing phrase: "MP4, MOV, AVI or MKV". */
export const UPLOAD_FORMAT_HINT = "MP4, MOV, AVI or MKV";

export interface UploadCandidate {
  /** Original filename, used for the extension. */
  filename?: string | null;
  /** Browser-reported MIME type. Frequently empty or wrong — see the notes above. */
  contentType?: string | null;
  /** Size in bytes. Omit when it is genuinely unknown, not to skip the check. */
  size?: number | null;
}

export type UploadValidation = { ok: true } | { ok: false; error: string };

/**
 * Decide whether a video upload is acceptable, returning a message a user can
 * act on rather than a boolean.
 *
 * THE EXTENSION GETS THE DECIDING VOTE. A browser's MIME type for `.mkv` and
 * `.avi` is unreliable enough that trusting it rejects real files, so the rule
 * is: a recognised extension passes; an unrecognised extension passes only if
 * the MIME type is one we recognise (covering a file that genuinely has no
 * extension); anything else is refused. This is a usability guard and a sanity
 * check on the size, not a content inspection — neither half proves the bytes
 * are really a video, and the worker's ffmpeg probe is what ultimately decides
 * (see the corrupted-file path in cloudrun-worker/server.js).
 */
export function validateVideoUpload(candidate: UploadCandidate): UploadValidation {
  const ext = fileExtension(candidate.filename ?? "");
  const type = (candidate.contentType ?? "").trim().toLowerCase().split(";")[0];

  const extAccepted = (UPLOAD_VIDEO_EXTENSIONS as readonly string[]).includes(ext);
  const typeAccepted = ACCEPTED_VIDEO_MIME_TYPES.has(type);

  if (!extAccepted && !typeAccepted) {
    const named = ext ? `.${ext} files are` : "That file type is";
    return {
      ok: false,
      error: `${named} not supported. Upload a ${UPLOAD_FORMAT_HINT} video.`,
    };
  }

  const size = candidate.size;
  if (typeof size === "number" && Number.isFinite(size)) {
    if (size <= 0) {
      return { ok: false, error: "That file is empty. Choose a video with content in it." };
    }
    if (size > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `That video is ${formatBytes(size)}. The limit is ${formatBytes(
          MAX_UPLOAD_BYTES
        )} — trim it or export it at a lower quality first.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Decide whether a video is short enough to transcribe.
 *
 * An unknown duration passes: the editor only learns a video's length once the
 * player has loaded metadata, and refusing to caption a video because we have
 * not measured it yet would break generation on a slow connection. The ceiling
 * is a guard against the case we CAN see, not a requirement to have measured.
 */
export function validateSubtitleDuration(seconds: number | null | undefined): UploadValidation {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return { ok: true };
  }
  if (seconds > MAX_SUBTITLE_DURATION_SECONDS) {
    return {
      ok: false,
      error: `This video is ${formatDuration(seconds)}. Subtitles are limited to ${formatDuration(
        MAX_SUBTITLE_DURATION_SECONDS
      )} — split it into shorter demos and caption each one.`,
    };
  }
  return { ok: true };
}

/**
 * How long to let the worker run for a source of this length.
 *
 * `invokeGcpWorker` defaults to 180s, which is generous for the short demos the
 * feature was built on and far too tight for a 90-minute recording: download,
 * ffmpeg extract and Deepgram all scale with the input, so a fixed timeout turns
 * a long video into a spurious "aborted" rather than a slow success. The floor
 * stays the existing default so nothing about a short video changes, and the
 * ceiling matches the 15 minutes `invokeGcpSync` already uses for its heaviest
 * ffmpeg round-trip.
 */
export function subtitleWorkerTimeoutMs(durationSeconds: number | null | undefined): number {
  const floorMs = 180_000;
  const ceilingMs = 15 * 60 * 1000;
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds)) {
    return floorMs;
  }
  // Roughly a quarter of real time, which leaves several times the headroom the
  // worker's own timing log shows it needs, plus a fixed minute for the fetch
  // and the container's cold start.
  const estimateMs = 60_000 + Math.max(0, durationSeconds) * 250;
  return Math.min(ceilingMs, Math.max(floorMs, Math.round(estimateMs)));
}
