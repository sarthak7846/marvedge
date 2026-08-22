import type { Dispatch, SetStateAction } from "react";
import { create } from "zustand";

import {
  MIN_CUE_SECONDS,
  deleteCue,
  findActiveCue,
  insertCue,
  mergeCues,
  normalizeCues,
  splitCueAt,
} from "@/app/lib/subtitles";
import type { SubtitleCue } from "@/app/(signed)/editor/types";

/**
 * Subtitle state store (issue #150). Holds the value state that used to live as
 * `useState` in the `useSubtitles` hook: the generated cue list and the
 * generating-in-progress flag.
 *
 * The `activeSubtitleText` derivation and the async generate/skip handlers stay in
 * the `useSubtitles` shim (they depend on `editorState`); only the serializable
 * subtitle state lives here.
 *
 * Setters mirror React's `useState` signature (`Dispatch<SetStateAction<T>>`) so the
 * `useSubtitles` shim keeps returning the exact same shape (`setSubtitleCues`) and
 * every existing consumer keeps working untouched.
 *
 * SUB PR 2 adds the editing actions the subtitle panel drives. They all delegate
 * their arithmetic to the pure helpers in app/lib/subtitles — nothing here
 * re-derives a split point or an overlap rule — and every one of them ends in
 * `normalizeCues()`. Mutations reach `Demo.editing.subtitles` through the
 * existing autosave, which already serializes this store's `subtitleCues`; there
 * is deliberately no save path here.
 */

/**
 * Default span of a cue created by "Add cue", in seconds. Trimmed shorter when
 * the next cue (or the end of the video) arrives first.
 */
const NEW_CUE_SECONDS = 2;

/**
 * Ceiling on the undo stack.
 *
 * Each entry is a whole cue list, so an unbounded stack grows with every
 * keystroke-committed edit and never shrinks — a long editing session on a
 * long demo would hold thousands of copies of a few hundred cues. Fifty steps
 * is far more than the "I just broke that cue" reach undo actually gets used
 * for, and it bounds the cost at fifty cue lists.
 */
export const SUBTITLE_UNDO_LIMIT = 50;

/** Context a mutation needs beyond the cue list itself. */
export interface SubtitleMutationOptions {
  /**
   * Video length in seconds. Cues are clamped into `[0, durationSeconds]`.
   * Omit it (or pass 0) before the player reports a duration — an unclamped
   * normalize is better than one clamped against a bogus zero-length video.
   */
  durationSeconds?: number;
}

export interface SubtitleStoreState {
  subtitleCues: SubtitleCue[];
  subtitlesLoading: boolean;
  /** Previous cue lists, most recent last. Bounded by `SUBTITLE_UNDO_LIMIT`. */
  subtitleUndoStack: SubtitleCue[][];

  setSubtitleCues: Dispatch<SetStateAction<SubtitleCue[]>>;
  setSubtitlesLoading: Dispatch<SetStateAction<boolean>>;

  /** Replace one cue's text. A blank string is ignored — deleting is `removeCue`. */
  setCueText: (index: number, text: string, options?: SubtitleMutationOptions) => void;
  /** Re-time one cue. Overlaps this creates are resolved by `normalizeCues`. */
  setCueTiming: (
    index: number,
    timing: { start?: number; end?: number },
    options?: SubtitleMutationOptions
  ) => void;
  /** Split the cue at `index` at `atSeconds`. No-op if neither half would fit. */
  splitCue: (index: number, atSeconds: number, options?: SubtitleMutationOptions) => void;
  /** Merge the cue at `index` with the one after it. No-op on the last cue. */
  mergeCueWithNext: (index: number, options?: SubtitleMutationOptions) => void;
  /** Delete the cue at `index`. */
  removeCue: (index: number, options?: SubtitleMutationOptions) => void;
  /** Insert a cue starting at `atSeconds`. No-op unless that instant is free. */
  addCue: (atSeconds: number, options?: SubtitleMutationOptions) => void;
  /** Restore the cue list as it was before the last mutation. */
  undoCueEdit: () => void;

  reset: () => void;
}

/** Resolve a `SetStateAction` against the previous value (supports functional updates). */
const resolve = <T>(value: SetStateAction<T>, prev: T): T =>
  typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

const initialState = {
  subtitleCues: [] as SubtitleCue[],
  subtitlesLoading: false,
  subtitleUndoStack: [] as SubtitleCue[][],
};

/**
 * The one place a mutation lands: normalize the candidate list, and remember the
 * list it replaced.
 *
 * Normalizing here rather than on save is deliberate. The render worker's
 * `remapSubtitleCuesToTrimmedTimeline()` assumes sorted, non-overlapping cues,
 * and two overlapping ASS `Dialogue` lines stack on top of each other. Fixing
 * that up only at save time would mean the panel and the preview spend the whole
 * session showing a cue list the export will silently rewrite.
 */
function commit(
  state: SubtitleStoreState,
  candidate: SubtitleCue[],
  options: SubtitleMutationOptions | undefined
): Partial<Pick<SubtitleStoreState, "subtitleCues" | "subtitleUndoStack">> {
  const duration = options?.durationSeconds;
  const subtitleCues = normalizeCues(
    candidate,
    typeof duration === "number" && duration > 0 ? { durationSeconds: duration } : {}
  );
  // A mutation the normalizer fully undid — dragging a cue's end into its
  // neighbour, say, where the overlap rule truncates it straight back. Nothing
  // changed, so it earns neither a re-render nor an undo step that would look
  // broken when the user spends it and sees nothing happen.
  if (sameCues(subtitleCues, state.subtitleCues)) {
    return {};
  }
  const subtitleUndoStack = [...state.subtitleUndoStack, state.subtitleCues].slice(
    -SUBTITLE_UNDO_LIMIT
  );
  return { subtitleCues, subtitleUndoStack };
}

/** `true` when `index` addresses a cue in `cues`. */
const inRange = (cues: readonly SubtitleCue[], index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < cues.length;

/** Cue-by-cue equality, to spot a mutation the normalizer undid. */
const sameCues = (a: readonly SubtitleCue[], b: readonly SubtitleCue[]): boolean =>
  a.length === b.length &&
  a.every((cue, i) => cue.start === b[i].start && cue.end === b[i].end && cue.text === b[i].text);

export const useSubtitleStore = create<SubtitleStoreState>((set) => ({
  ...initialState,

  // Wholesale replacements — generation, a demo load, a local draft restore, the
  // `?subtitles=` URL param, "Skip Subtitles". The undo stack is dropped with
  // them: it holds edits to a cue list that no longer exists, and replaying one
  // onto the new list would restore cues from a different demo.
  setSubtitleCues: (v) =>
    set((s) => ({ subtitleCues: resolve(v, s.subtitleCues), subtitleUndoStack: [] })),
  setSubtitlesLoading: (v) => set((s) => ({ subtitlesLoading: resolve(v, s.subtitlesLoading) })),

  setCueText: (index, text, options) =>
    set((s) => {
      if (!inRange(s.subtitleCues, index)) {
        return {};
      }
      const next = text.trim();
      // An empty box is a half-finished edit, not a delete. `normalizeCues`
      // drops textless cues, so committing one here would make a cue vanish
      // mid-retype.
      if (!next || next === s.subtitleCues[index].text) {
        return {};
      }
      const candidate = s.subtitleCues.slice();
      candidate[index] = { ...candidate[index], text: next };
      return commit(s, candidate, options);
    }),

  setCueTiming: (index, timing, options) =>
    set((s) => {
      if (!inRange(s.subtitleCues, index)) {
        return {};
      }
      const cue = s.subtitleCues[index];
      const start = Number.isFinite(timing.start) ? (timing.start as number) : cue.start;
      const end = Number.isFinite(timing.end) ? (timing.end as number) : cue.end;
      if (start === cue.start && end === cue.end) {
        return {};
      }
      const candidate = s.subtitleCues.slice();
      candidate[index] = { ...cue, start, end };
      return commit(s, candidate, options);
    }),

  splitCue: (index, atSeconds, options) =>
    set((s) => {
      if (!inRange(s.subtitleCues, index)) {
        return {};
      }
      const halves = splitCueAt(s.subtitleCues[index], atSeconds);
      if (!halves) {
        return {}; // The playhead is outside the cue, or too close to an edge.
      }
      const candidate = s.subtitleCues.slice();
      candidate.splice(index, 1, halves[0], halves[1]);
      return commit(s, candidate, options);
    }),

  mergeCueWithNext: (index, options) =>
    set((s) => {
      if (!inRange(s.subtitleCues, index) || index + 1 >= s.subtitleCues.length) {
        return {};
      }
      const merged = mergeCues(s.subtitleCues[index], s.subtitleCues[index + 1]);
      const candidate = s.subtitleCues.slice();
      candidate.splice(index, 2, merged);
      return commit(s, candidate, options);
    }),

  removeCue: (index, options) =>
    set((s) => {
      if (!inRange(s.subtitleCues, index)) {
        return {};
      }
      return commit(s, deleteCue(s.subtitleCues, index), options);
    }),

  addCue: (atSeconds, options) =>
    set((s) => {
      if (!Number.isFinite(atSeconds) || atSeconds < 0) {
        return {};
      }
      // Only into a gap. Inserting under an existing cue is legal — the overlap
      // rule would truncate that cue at the playhead — but silently shortening
      // a cue the user did not touch is not what "add" should mean. Splitting
      // is the action for a covered instant.
      if (findActiveCue(s.subtitleCues, atSeconds)) {
        return {};
      }
      const duration = options?.durationSeconds;
      const nextStart = s.subtitleCues.find((c) => c.start > atSeconds)?.start;
      const ceiling = Math.min(
        nextStart ?? Number.POSITIVE_INFINITY,
        typeof duration === "number" && duration > 0 ? duration : Number.POSITIVE_INFINITY
      );
      const end = Math.min(atSeconds + NEW_CUE_SECONDS, ceiling);
      if (end - atSeconds < MIN_CUE_SECONDS) {
        return {}; // No room before the next cue or the end of the video.
      }
      const cue: SubtitleCue = { start: atSeconds, end, text: "New subtitle" };
      return commit(s, insertCue(s.subtitleCues, cue), options);
    }),

  undoCueEdit: () =>
    set((s) => {
      if (s.subtitleUndoStack.length === 0) {
        return {};
      }
      const stack = s.subtitleUndoStack.slice();
      const previous = stack.pop() as SubtitleCue[];
      // Restored as it was recorded, not re-normalized: undo owes the user the
      // list they had, including one a generator produced un-normalized.
      return { subtitleCues: previous, subtitleUndoStack: stack };
    }),

  reset: () => set({ ...initialState }),
}));
