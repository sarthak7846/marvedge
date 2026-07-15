// Subtitle stabilization for AVS (AVS-2.3, "Karaoke fix").
//
// Captions transcribed from the AI voiceover can flicker: a single-word cue that
// is only a few hundred milliseconds long snaps on and off the screen too fast to
// read. This module implements the PRD pipeline as PURE, deterministic functions
// over `Cue[]`:
//
//   1. Token clustering — normalize, sort, and de-overlap the raw cues so each
//      one is a clean, non-overlapping cluster of words.
//   2. Karaoke fix — guarantee every cue stays on screen for at least
//      `T_min = max(1.5, wordCount * 0.35)` seconds by extending a too-short cue
//      into the gap after it, or merging it with the next cue when there is no
//      room — never producing an overlap.
//
// It also exposes a word-level view (`cuesToWords`) and a WebVTT serializer
// (`cuesToVtt`). Everything here is free of DOM/network side effects so it can be
// unit-tested directly; the browser download lives in the AVS panel hook.

/** A single caption: `text` shown from `start` to `end` (both in seconds). */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** One word with an estimated on-screen span, distributed evenly within a cue. */
export interface Word {
  word: string;
  start: number;
  end: number;
}

/** Floor on a cue's on-screen duration, in seconds (the `1.5` in the formula). */
export const MIN_CUE_SECONDS = 1.5;

/** Extra on-screen time granted per word, in seconds (the `0.35` in the formula). */
export const PER_WORD_SECONDS = 0.35;

// Tolerance for floating-point comparisons on second-scale durations.
const EPSILON = 1e-6;

/** Count whitespace-delimited words in a caption's text. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Minimum on-screen duration for a cue with `wordCount` words:
 * `T_min = max(1.5, wordCount * 0.35)` seconds. Longer cues get more time so
 * viewers can actually read them.
 */
export function minCueDuration(wordCount: number): number {
  return Math.max(MIN_CUE_SECONDS, wordCount * PER_WORD_SECONDS);
}

// Coerce a raw cue to finite numbers and trimmed text; `null` if unusable.
function normalizeCue(cue: Cue): Cue | null {
  const start = Number(cue.start);
  const end = Number(cue.end);
  const text = String(cue.text ?? "").trim();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
    return null;
  }
  return { start: Math.max(0, start), end: Math.max(0, end), text };
}

/**
 * Token clustering: drop unusable cues, sort by start time, and remove overlaps
 * so the result is a clean, strictly non-overlapping, increasing sequence. When
 * two cues overlap, the earlier one is clamped to the later one's start; a cue
 * that starts at (or before) the previous one is folded into it instead of
 * creating a zero-width sliver.
 */
export function clusterCues(cues: Cue[]): Cue[] {
  const sorted = cues
    .map(normalizeCue)
    .filter((c): c is Cue => c !== null && c.end - c.start > EPSILON)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const clustered: Cue[] = [];
  for (const cue of sorted) {
    const prev = clustered[clustered.length - 1];
    if (!prev || cue.start >= prev.end - EPSILON) {
      clustered.push({ ...cue });
      continue;
    }
    // Overlap with the previous cue.
    if (cue.start > prev.start + EPSILON) {
      prev.end = cue.start; // clamp the earlier cue so the boundary is clean
      clustered.push({ ...cue });
    } else {
      // Same start (or earlier): merge the text into the previous cue.
      prev.end = Math.max(prev.end, cue.end);
      prev.text = `${prev.text} ${cue.text}`.trim();
    }
  }
  return clustered;
}

/**
 * Stabilize cues so none flickers: after token clustering, every cue is
 * guaranteed to last at least `minCueDuration(wordCount)` seconds. A too-short
 * cue is first extended into the gap before the next cue; if that is still not
 * enough it is merged with the next cue (whose words then raise the threshold),
 * repeating until the floor is met. The last cue is simply extended.
 *
 * Pure and deterministic. Given non-overlapping input it produces
 * non-overlapping output (it only extends into gaps or consumes the next cue).
 */
export function stabilizeCues(cues: Cue[]): Cue[] {
  const clustered = clusterCues(cues);
  const result: Cue[] = [];

  let i = 0;
  while (i < clustered.length) {
    let cur: Cue = { ...clustered[i] };
    i += 1;

    // Karaoke fix: grow `cur` until it meets its minimum on-screen duration.
    for (;;) {
      const need = minCueDuration(countWords(cur.text));
      if (cur.end - cur.start >= need - EPSILON) {
        break;
      }
      const next = clustered[i];
      const desiredEnd = cur.start + need;
      if (!next) {
        cur.end = desiredEnd; // last cue: nothing to overlap, just extend
        break;
      }
      if (desiredEnd <= next.start + EPSILON) {
        cur.end = desiredEnd; // room in the gap — extend without overlapping
        break;
      }
      // Not enough room: merge with the next cue and re-evaluate.
      cur = {
        start: cur.start,
        end: Math.max(cur.end, next.end),
        text: `${cur.text} ${next.text}`.trim(),
      };
      i += 1;
    }

    result.push(cur);
  }

  return result;
}

/**
 * Word-level view of the cues: each cue's text is split into words and its
 * timespan is distributed evenly across them. Deterministic — handy for a
 * karaoke highlight or a word-timed JSON export. Run on stabilized cues to
 * inherit the flicker-free timing.
 */
export function cuesToWords(cues: Cue[]): Word[] {
  const words: Word[] = [];
  for (const cue of cues) {
    const tokens = cue.text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }
    const span = Math.max(0, cue.end - cue.start);
    const per = span / tokens.length;
    tokens.forEach((word, idx) => {
      words.push({
        word,
        start: cue.start + per * idx,
        end: idx === tokens.length - 1 ? cue.end : cue.start + per * (idx + 1),
      });
    });
  }
  return words;
}

/** Format `seconds` as a WebVTT timestamp: `HH:MM:SS.mmm`. */
export function formatVttTimestamp(seconds: number): string {
  const total = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const ms = Math.round(total * 1000);
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}.${pad(millis, 3)}`;
}

/**
 * Serialize cues to a valid WebVTT string. Cues are clustered first so the
 * output is ordered and non-overlapping regardless of input order.
 */
export function cuesToVtt(cues: Cue[]): string {
  const ordered = clusterCues(cues);
  const blocks = ordered.map(
    (cue, i) =>
      `${i + 1}\n${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}`
  );
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}
