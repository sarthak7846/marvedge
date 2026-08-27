// Subtitle file formats: SubRip (.srt), WebVTT (.vtt) and plain text (.txt).
//
// Pure and isomorphic — no fs, no Blob, no download. The browser save lives in
// the panel that calls these; the route handler just sets a Content-Type.
//
// THERE IS ONE VTT SERIALIZER AND IT IS HERE. `cuesToVtt` and
// `formatVttTimestamp` used to live in app/lib/avs/karaoke.ts, wired to the AVS
// captions editor; that file now re-exports them from this module so AVS keeps
// working untouched and the two halves of the app cannot drift into two
// different notions of a valid cue block.
//
// SRT and VTT differ in exactly two ways, which is why they share everything
// below: SRT separates the fractional second with a comma instead of a dot, and
// has no `WEBVTT` header. (The leading sequence number is optional in VTT, but
// this serializer emits it for both — the AVS output has always carried it and
// every player accepts it.)
//
// The serializers write the cues they are handed, in the order they are handed
// them. Ordering and overlap resolution are a separate, explicit step:
// `normalizeCues()` in ./cues. A serializer that quietly re-times its input is a
// serializer you cannot use to round-trip a file.

import { AUTO_DETECT_LANGUAGE } from "./languages";
import type { SubtitleCue } from "./types";

// Split seconds into the clock parts every timestamp format needs.
function clockParts(seconds: number): { hh: string; mm: string; ss: string; millis: string } {
  const total = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const ms = Math.round(total * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return {
    hh: pad(Math.floor(ms / 3_600_000)),
    mm: pad(Math.floor((ms % 3_600_000) / 60_000)),
    ss: pad(Math.floor((ms % 60_000) / 1000)),
    millis: pad(ms % 1000, 3),
  };
}

/** Format `seconds` as a WebVTT timestamp: `HH:MM:SS.mmm`. */
export function formatVttTimestamp(seconds: number): string {
  const { hh, mm, ss, millis } = clockParts(seconds);
  return `${hh}:${mm}:${ss}.${millis}`;
}

/** Format `seconds` as a SubRip timestamp: `HH:MM:SS,mmm` (comma, not dot). */
export function formatSrtTimestamp(seconds: number): string {
  const { hh, mm, ss, millis } = clockParts(seconds);
  return `${hh}:${mm}:${ss},${millis}`;
}

// Both formats are a sequence number, a timing line, then the text.
function toBlocks(cues: readonly SubtitleCue[], format: (s: number) => string): string {
  return cues
    .map((cue, i) => `${i + 1}\n${format(cue.start)} --> ${format(cue.end)}\n${cue.text}`)
    .join("\n\n");
}

/**
 * Serialize cues to a WebVTT document. Cues are written in the order given —
 * run them through `normalizeCues()` first.
 */
export function cuesToVtt(cues: readonly SubtitleCue[]): string {
  // A header-only document is still valid WebVTT, and is what an empty track
  // should produce — not a header followed by a stray blank block.
  return cues.length ? `WEBVTT\n\n${toBlocks(cues, formatVttTimestamp)}\n` : "WEBVTT\n";
}

/**
 * Serialize cues to a SubRip document. Cues are written in the order given —
 * run them through `normalizeCues()` first.
 */
export function cuesToSrt(cues: readonly SubtitleCue[]): string {
  return cues.length ? `${toBlocks(cues, formatSrtTimestamp)}\n` : "";
}

/**
 * Serialize cues to a plain-text transcript: one cue per line, no timings and no
 * sequence numbers. This is the read-it-later artefact, not a subtitle file —
 * nothing parses it back.
 */
export function cuesToTxt(cues: readonly SubtitleCue[]): string {
  return cues.length ? `${cues.map((cue) => cue.text).join("\n")}\n` : "";
}

// `HH:MM:SS,mmm` / `HH:MM:SS.mmm`, and the two-part `MM:SS.mmm` that VTT allows.
const TIMESTAMP = /(\d{1,3}):(\d{2})(?::(\d{2}))?[.,](\d{1,3})/;
// A timing line: two timestamps around `-->`, plus optional VTT cue settings.
const TIMING_LINE = new RegExp(`^\\s*${TIMESTAMP.source}\\s*-->\\s*${TIMESTAMP.source}(.*)$`);

function parseTimestamp(a: string, b: string, c: string | undefined, ms: string): number {
  // Two-part timestamps (`MM:SS.mmm`) shift left: the first group is minutes.
  const hours = c === undefined ? 0 : Number(a);
  const minutes = c === undefined ? Number(a) : Number(b);
  const seconds = c === undefined ? Number(b) : Number(c);
  const millis = Number(ms.padEnd(3, "0"));
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

/**
 * Parse a SubRip or WebVTT document into cues.
 *
 * Deliberately tolerant, because these files come from users and from other
 * tools: it accepts either decimal separator, an optional `WEBVTT` header, an
 * optional sequence number or cue identifier above the timing line, VTT cue
 * settings after the end timestamp, CRLF line endings, and a BOM. Multi-line cue
 * text is preserved with its newlines. Blocks without a parsable timing line, or
 * with no text, are skipped rather than failing the whole document.
 *
 * The result is NOT normalized — the caller decides whether an imported file's
 * overlaps should be resolved against a particular video duration.
 */
export function parseSubtitleFile(input: string): SubtitleCue[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cues: SubtitleCue[] = [];

  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const timingAt = lines.findIndex((line) => TIMING_LINE.test(line));
    if (timingAt === -1) {
      continue; // header block, NOTE/STYLE block, or junk
    }

    const match = lines[timingAt].match(TIMING_LINE);
    if (!match) {
      continue;
    }
    const start = parseTimestamp(match[1], match[2], match[3], match[4]);
    const end = parseTimestamp(match[5], match[6], match[7], match[8]);

    const body = lines
      .slice(timingAt + 1)
      .join("\n")
      .trim();
    if (!body) {
      continue;
    }

    cues.push({ start, end, text: body });
  }

  return cues;
}

/** Parse a SubRip document. See `parseSubtitleFile` — the grammars overlap. */
export function parseSrt(input: string): SubtitleCue[] {
  return parseSubtitleFile(input);
}

/** Parse a WebVTT document. See `parseSubtitleFile` — the grammars overlap. */
export function parseVtt(input: string): SubtitleCue[] {
  return parseSubtitleFile(input);
}

// ---------------------------------------------------------------------------
// Download metadata (SUB PR 6 / US-5, PRD §6.8)
//
// The MIME type and the filename belong next to the serializers rather than in
// the route: the route sets a `Content-Type` header, the browser panel sets a
// `Blob` type, and the share page sets a `<track>` src — three callers that must
// agree on what an `.srt` is. Still pure: naming a file is string work.
// ---------------------------------------------------------------------------

/** A downloadable subtitle format. */
export type SubtitleFormat = "srt" | "vtt" | "txt";

/** Every format the export route and the panel offer, in the order they appear. */
export const SUBTITLE_FORMATS: readonly SubtitleFormat[] = ["srt", "vtt", "txt"];

/**
 * MIME type for each format, without a charset.
 *
 * `application/x-subrip` is the registered type for SubRip; `text/vtt` is
 * required by the `<track>` element (a VTT served as `text/plain` is silently
 * ignored by every browser). Callers that write an HTTP header should append
 * `; charset=utf-8` — these files carry translated text, so the encoding is not
 * something to leave to a receiver's guess.
 */
export const SUBTITLE_FORMAT_MIME: Record<SubtitleFormat, string> = {
  srt: "application/x-subrip",
  vtt: "text/vtt",
  txt: "text/plain",
};

/** `true` when `value` names a format this module can serialize. */
export function isSubtitleFormat(value: unknown): value is SubtitleFormat {
  return typeof value === "string" && (SUBTITLE_FORMATS as readonly string[]).includes(value);
}

/**
 * Serialize cues in the named format. The one place the format string is turned
 * into a serializer, so a new format is added in exactly one switch.
 */
export function serializeCues(cues: readonly SubtitleCue[], format: SubtitleFormat): string {
  switch (format) {
    case "srt":
      return cuesToSrt(cues);
    case "vtt":
      return cuesToVtt(cues);
    case "txt":
      return cuesToTxt(cues);
  }
}

/** Longest slug taken from a demo title, so a long title cannot produce a long path. */
const FILENAME_SLUG_MAX = 60;

/** Used when a title slugs down to nothing — an emoji-only title, or no title. */
const FILENAME_FALLBACK = "subtitles";

/**
 * Filename for a downloaded subtitle file: `<demo-title>-<language>.<format>`.
 *
 * Deliberately ASCII-only and path-free. This string is interpolated into a
 * `Content-Disposition` header, where a stray quote, newline or slash is a
 * header-injection bug rather than a cosmetic one — so everything outside
 * `[a-z0-9]` collapses to a hyphen instead of being escaped.
 *
 * The language is omitted for an auto-detected track, whose code (`multi`) names
 * nothing a user would recognise in their downloads folder.
 */
export function subtitleFileName(
  title: string | null | undefined,
  language: string | null | undefined,
  format: SubtitleFormat
): string {
  const base = slugForFilename(title) || FILENAME_FALLBACK;
  const code = language && language !== AUTO_DETECT_LANGUAGE ? slugForFilename(language) : "";
  return code ? `${base}-${code}.${format}` : `${base}.${format}`;
}

/** Lowercase, hyphenated, ASCII-only. Never empty-ish enough to become a dotfile. */
function slugForFilename(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FILENAME_SLUG_MAX)
    .replace(/-+$/g, "");
}
