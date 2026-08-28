// Cue-list algebra for the subtitle feature: normalize, split, merge, insert,
// delete, look up.
//
// Pure and isomorphic — no env, no fs, no DOM. The editor panel mutates cues
// with these helpers, the generation route persists what they produce, and the
// export path re-runs `normalizeCues` server-side before the recipe reaches the
// worker (never trust the client's ordering).
//
// THE INVARIANT
// -------------
// `remapSubtitleCuesToTrimmedTimeline()` in the render worker assumes the cue
// list is **sorted and non-overlapping**, and two overlapping ASS `Dialogue`
// lines render stacked on top of each other rather than side by side. Today that
// invariant holds by luck: the worker is the only producer. Once a user can
// drag, resize, split and merge cues, an overlap is one mouse-drag away — PRD §13
// lists it as an explicit edge case.
//
// `normalizeCues()` is the single place that invariant is established. The other
// helpers here are deliberately dumb array operations that do NOT normalize:
// composing `splitCueAt` -> `insertCue` -> `normalizeCues` keeps each step
// predictable, whereas a primitive that quietly re-times its neighbours makes an
// undo stack impossible to reason about. **Run `normalizeCues()` on the result
// before persisting, exporting or rendering.**

import type { SubtitleCue } from "./types";

/** Tolerance for floating-point comparisons on second-scale timings. */
const EPSILON = 1e-6;

/**
 * Floor on a cue's on-screen duration, in seconds.
 *
 * This is a structural floor — it exists to stop zero-width and inverted cues,
 * not to make a cue readable. The readability floor (`max(1.5, words * 0.35)`)
 * is a separate, AVS-specific concern and lives in app/lib/avs/karaoke.ts; do
 * not conflate the two, or every generated cue silently grows by a second.
 */
export const MIN_CUE_SECONDS = 0.2;

export interface NormalizeCuesOptions {
  /** Video length in seconds. Cues are clamped into `[0, durationSeconds]`. */
  durationSeconds?: number;
  /** Override the structural minimum duration. Defaults to `MIN_CUE_SECONDS`. */
  minCueSeconds?: number;
}

// Coerce one raw cue to finite numbers and trimmed text; `null` when unusable.
// Accepts `unknown` because cues arrive from JSON columns, URL params and the
// worker as well as from typed callers.
function coerceCue(raw: unknown): SubtitleCue | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const start = Number(rec.start);
  const end = Number(rec.end);
  const text = String(rec.text ?? "").trim();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
    return null;
  }
  return { start, end, text };
}

/**
 * Establish the sorted, non-overlapping invariant over a cue list: drop unusable
 * cues, clamp into `[0, durationSeconds]`, enforce a minimum duration, sort by
 * start time, and resolve every overlap.
 *
 * THE OVERLAP RULE — decided here so later PRs never have to guess:
 *
 *  1. **Truncate the earlier cue.** When two cues overlap, the later cue's start
 *     wins and the earlier cue ends there. The later start is the newer edit —
 *     it is the edge the user just dragged — and truncating touches exactly one
 *     cue, whereas pushing the later cue cascades down the rest of the timeline
 *     and silently re-times work the user did not touch. A cue fully contained
 *     inside another falls out of this rule correctly: `[0,10]` + `[2,3]`
 *     becomes `[0,2]` + `[2,3]`, leaving a gap rather than a stack.
 *
 *  2. **Push the later cue when truncation would erase the earlier one.** If
 *     truncating leaves the earlier cue shorter than the minimum (the two start
 *     at, or within a hair of, the same instant), there is no earlier cue left
 *     to truncate. The later cue is moved to begin at the earlier one's end
 *     instead, keeping its duration where the timeline has room.
 *
 *  3. **Drop only as a last resort.** A pushed cue with nowhere to live — its
 *     start lands at or past `durationSeconds` — is dropped. Dropping is never
 *     the first answer; it is what is left when a cue has no room at all.
 *
 * Returns a new array; the input is never mutated.
 */
export function normalizeCues(
  cues: readonly unknown[],
  options: NormalizeCuesOptions = {}
): SubtitleCue[] {
  const { durationSeconds } = options;
  const minCue = Math.max(
    0,
    typeof options.minCueSeconds === "number" && Number.isFinite(options.minCueSeconds)
      ? options.minCueSeconds
      : MIN_CUE_SECONDS
  );
  const hasDuration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds);
  const limit = hasDuration ? Math.max(0, durationSeconds) : Number.POSITIVE_INFINITY;

  const prepared: SubtitleCue[] = [];
  for (const raw of cues) {
    const cue = coerceCue(raw);
    if (!cue) {
      continue;
    }

    // Clamp into the video's timeline. A cue that starts at or past the end of
    // the video has nowhere to render.
    const start = Math.min(Math.max(0, cue.start), limit);
    if (hasDuration && start >= limit - EPSILON) {
      continue;
    }

    // Enforce the structural minimum, then let the video's end win: the wall at
    // `durationSeconds` is hard, so a cue near it may legitimately end up
    // shorter than `minCue` rather than being dropped.
    const end = Math.min(Math.max(cue.end, start + minCue), limit);
    if (end - start < EPSILON) {
      continue;
    }

    prepared.push({ start, end, text: cue.text });
  }

  prepared.sort((a, b) => a.start - b.start || a.end - b.end);

  const resolved: SubtitleCue[] = [];
  for (const cue of prepared) {
    const prev = resolved[resolved.length - 1];

    if (!prev || cue.start >= prev.end - EPSILON) {
      resolved.push(cue);
      continue;
    }

    // Rule 1 — truncate the earlier cue at this one's start.
    if (cue.start - prev.start >= minCue - EPSILON) {
      prev.end = cue.start;
      resolved.push(cue);
      continue;
    }

    // Rule 2 — the two are effectively simultaneous; move this one after it.
    const start = prev.end;
    if (hasDuration && start >= limit - EPSILON) {
      continue; // Rule 3 — no room left before the end of the video.
    }
    const end = Math.min(Math.max(cue.end, start + minCue), limit);
    if (end - start < EPSILON) {
      continue; // Rule 3.
    }
    resolved.push({ start, end, text: cue.text });
  }

  return resolved;
}

/**
 * Split `cue` in two at `t` seconds, apportioning the text by where `t` falls in
 * the cue's span and snapping to the nearest word boundary so a word is never
 * cut in half.
 *
 * Returns `null` when `t` is not far enough inside the cue for both halves to
 * clear `MIN_CUE_SECONDS` — an unsplittable cue is left alone rather than
 * silently producing a sliver the normalizer would then eat.
 */
export function splitCueAt(cue: SubtitleCue, t: number): [SubtitleCue, SubtitleCue] | null {
  if (!Number.isFinite(t)) {
    return null;
  }
  if (t - cue.start < MIN_CUE_SECONDS || cue.end - t < MIN_CUE_SECONDS) {
    return null;
  }

  const words = cue.text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    // A single word cannot be divided; both halves carry the same text so the
    // user can retype one of them.
    return [
      { start: cue.start, end: t, text: cue.text },
      { start: t, end: cue.end, text: cue.text },
    ];
  }

  const span = cue.end - cue.start;
  const ratio = span > 0 ? (t - cue.start) / span : 0.5;
  // Keep at least one word on each side of the split.
  const cut = Math.min(words.length - 1, Math.max(1, Math.round(words.length * ratio)));

  return [
    { start: cue.start, end: t, text: words.slice(0, cut).join(" ") },
    { start: t, end: cue.end, text: words.slice(cut).join(" ") },
  ];
}

/**
 * Merge two cues into one spanning both: the outer timings and both texts,
 * joined in chronological order. Argument order does not matter.
 */
export function mergeCues(a: SubtitleCue, b: SubtitleCue): SubtitleCue {
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  return {
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
    text: `${first.text} ${second.text}`.trim(),
  };
}

/**
 * Insert `cue` at its chronological position. Does not resolve overlaps — run
 * `normalizeCues()` on the result before persisting (see the module header).
 */
export function insertCue(cues: readonly SubtitleCue[], cue: SubtitleCue): SubtitleCue[] {
  const next = cues.slice();
  const at = next.findIndex((c) => c.start > cue.start);
  if (at === -1) {
    next.push(cue);
  } else {
    next.splice(at, 0, cue);
  }
  return next;
}

/**
 * Remove the cue at `index`. An out-of-range index is a no-op (a copy is still
 * returned, so callers can treat the result as new state unconditionally).
 */
export function deleteCue(cues: readonly SubtitleCue[], index: number): SubtitleCue[] {
  const next = cues.slice();
  if (!Number.isInteger(index) || index < 0 || index >= cues.length) {
    return next;
  }
  next.splice(index, 1);
  return next;
}

/**
 * The cue on screen at `t` seconds, or `null` in a gap. Binary search — this
 * runs on every frame of the preview, so it must not be a linear scan.
 *
 * Both ends are inclusive, matching the preview behaviour this replaces. Where
 * two cues share a boundary (`prev.end === next.start`, which `normalizeCues`
 * produces routinely) the **later** cue wins: at that instant it has taken over
 * the screen. Assumes a sorted list — feed it `normalizeCues()` output.
 */
export function findActiveCue(cues: readonly SubtitleCue[], t: number): SubtitleCue | null {
  if (!cues.length || !Number.isFinite(t)) {
    return null;
  }

  // Find the last cue that has already started at `t`.
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (found === -1) {
    return null; // `t` is before the first cue.
  }
  const cue = cues[found];
  return t <= cue.end ? cue : null; // otherwise `t` is in the gap after it.
}

/**
 * Read a cue array out of a persisted JSON value, tolerating both shapes the
 * `Demo.subtitles` column has been written in: a bare array (what
 * `/api/subtitles/create` writes now) and the legacy
 * `{ provider, language, cues }` wrapper written before it.
 *
 * The render worker already reads the column both ways
 * (cloudrun-worker/render.js, `subtitleList`); this is the same tolerance for
 * the Next side, so demos generated by the old code keep working.
 */
export function readCueList(raw: unknown): SubtitleCue[] {
  if (Array.isArray(raw)) {
    return raw.map(coerceCue).filter((c): c is SubtitleCue => c !== null);
  }
  if (raw && typeof raw === "object") {
    const cues = (raw as { cues?: unknown }).cues;
    if (Array.isArray(cues)) {
      return cues.map(coerceCue).filter((c): c is SubtitleCue => c !== null);
    }
  }
  return [];
}

/**
 * Flatten a persisted `Demo.subtitles` value into one searchable string.
 *
 * The customer hub advertises "Search demos, tags, subtitles…" and matches
 * against this. It used to inline `Array.isArray(d.subtitles)`, which was always
 * false against the `{ cues }` object the generation route wrote — so subtitle
 * search matched nothing at all. Going through `readCueList` fixes it for both
 * shapes at once.
 */
export function cuesToSearchText(raw: unknown): string {
  return readCueList(raw)
    .map((cue) => cue.text)
    .join(" ");
}
