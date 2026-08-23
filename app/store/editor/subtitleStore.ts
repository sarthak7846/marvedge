import type { Dispatch, SetStateAction } from "react";
import { create } from "zustand";

import {
  DEFAULT_SUBTITLE_STYLE,
  MIN_CUE_SECONDS,
  deleteCue,
  findActiveCue,
  insertCue,
  mergeCues,
  normalizeCues,
  sanitizeSubtitleStyle,
  splitCueAt,
} from "@/app/lib/subtitles";
import type { SubtitleStyle } from "@/app/lib/subtitles";
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
 *
 * SUB PR 3 adds the two things the timeline subtitle track needs from shared
 * state: the selected cue (so the track and the sidebar list highlight the same
 * one, in both directions) and a drag-scoped mutation path — `beginCueDrag` /
 * `dragCues` / `endCueDrag` — so a drag lands as ONE undo step instead of one
 * per mousemove.
 *
 * SUB PR 4 adds `subtitleStyle`: the appearance the preview overlay and the
 * burned-in export both read, through the one mapping in app/lib/subtitles/style.
 * It stays `null` until the user actually changes something, because "no style
 * config" is what makes an untouched demo export byte-identically to master.
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
  /**
   * The cue the user is working on, shared by the timeline track and the
   * sidebar list so selecting in either highlights the other. `null` when
   * nothing is selected.
   */
  selectedCueIndex: number | null;
  /**
   * Bumped on every `selectCue`, including a re-selection of the cue that is
   * already selected. The sidebar list scrolls the selected row into view off
   * this rather than off the index, so clicking the same timeline block twice
   * still brings the row back into view.
   */
  cueFocusNonce: number;
  /**
   * The cue list as it stood when the current timeline drag began; `null` when
   * no drag is in flight. Every frame of a drag is resolved against THIS, not
   * against the previous frame — see `dragCues`.
   */
  subtitleDragOrigin: SubtitleCue[] | null;
  /**
   * User-chosen appearance, persisted to `editing.subtitleStyle`. `null` means
   * the demo has never opened the style panel, which is what keeps the export
   * byte-identical to master — the worker then falls back to its own hardcoded
   * style rather than being handed one. Never default this to an object.
   */
  subtitleStyle: SubtitleStyle | null;

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

  /** Select a cue (or clear the selection). Out-of-range indexes clear it. */
  selectCue: (index: number | null) => void;

  /**
   * Replace the subtitle style. Sanitized on the way in so the preview can only
   * ever render a style the export can also produce; `null` clears it back to
   * "no style config", restoring master's burn-in exactly.
   *
   * A partial patch is merged onto the current style (or onto the defaults, the
   * first time a knob is touched), so the panel's controls can each set one
   * field without restating the rest.
   */
  setSubtitleStyle: (patch: Partial<SubtitleStyle> | null) => void;

  /**
   * Open a continuous re-timing gesture (a timeline drag), snapshotting the cue
   * list so the whole gesture costs one undo step. Idempotent: a second call
   * while a drag is already open keeps the original snapshot.
   */
  beginCueDrag: () => void;
  /**
   * Apply an in-flight gesture's candidate list. Normalizes like every other
   * mutation, but records NO undo step — sixty mousemoves must not spend sixty
   * of the fifty the stack holds. The caller recomputes `candidate` from
   * `subtitleDragOrigin` each frame, so this is idempotent and reversible.
   */
  dragCues: (candidate: readonly SubtitleCue[], options?: SubtitleMutationOptions) => void;
  /**
   * Close the gesture, recording one undo step for everything it changed — or
   * none at all if the cues ended up where they started.
   */
  endCueDrag: () => void;

  reset: () => void;
}

/** Resolve a `SetStateAction` against the previous value (supports functional updates). */
const resolve = <T>(value: SetStateAction<T>, prev: T): T =>
  typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

const initialState = {
  subtitleCues: [] as SubtitleCue[],
  subtitlesLoading: false,
  subtitleUndoStack: [] as SubtitleCue[][],
  selectedCueIndex: null as number | null,
  cueFocusNonce: 0,
  subtitleDragOrigin: null as SubtitleCue[] | null,
  subtitleStyle: null as SubtitleStyle | null,
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
  candidate: readonly SubtitleCue[],
  options: SubtitleMutationOptions | undefined
): Partial<Pick<SubtitleStoreState, "subtitleCues" | "subtitleUndoStack" | "selectedCueIndex">> {
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
  return { subtitleCues, subtitleUndoStack, ...clampSelection(state, subtitleCues) };
}

/**
 * Drop a selection that a mutation has left pointing past the end of the list —
 * a deleted or merged cue. Deliberately only a range check: after a split every
 * index past the split point shifts by one and there is no honest way to follow
 * the user's intent, so the selection stays where it is rather than guessing.
 */
function clampSelection(
  state: SubtitleStoreState,
  cues: readonly SubtitleCue[]
): Partial<Pick<SubtitleStoreState, "selectedCueIndex">> {
  if (state.selectedCueIndex !== null && state.selectedCueIndex >= cues.length) {
    return { selectedCueIndex: null };
  }
  return {};
}

/** `true` when `index` addresses a cue in `cues`. */
const inRange = (cues: readonly SubtitleCue[], index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < cues.length;

/**
 * Merge a style patch onto the current style.
 *
 * `null` clears the style entirely, which is the state that makes an export
 * byte-identical to master — it is not the same as writing the defaults. Any
 * other patch is merged onto the current style, or onto the defaults the first
 * time a knob is touched, so what gets persisted is a complete, self-describing
 * object rather than one field the reader would have to guess the rest of.
 *
 * Sanitizing here rather than at save time means the preview can only ever show
 * a style the renderer can also produce.
 */
function applySubtitleStylePatch(
  current: SubtitleStyle | null,
  patch: Partial<SubtitleStyle> | null
): Partial<Pick<SubtitleStoreState, "subtitleStyle">> {
  if (patch === null) {
    return current === null ? {} : { subtitleStyle: null };
  }
  return {
    subtitleStyle:
      sanitizeSubtitleStyle({ ...(current ?? DEFAULT_SUBTITLE_STYLE), ...patch }) ?? null,
  };
}

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
    set((s) => ({
      subtitleCues: resolve(v, s.subtitleCues),
      subtitleUndoStack: [],
      // The selection and any in-flight drag address cues from the list being
      // replaced; carrying either across would point at a different demo's cue.
      selectedCueIndex: null,
      subtitleDragOrigin: null,
    })),
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
      return {
        subtitleCues: previous,
        subtitleUndoStack: stack,
        ...clampSelection(s, previous),
      };
    }),

  selectCue: (index) =>
    set((s) => {
      const next = index === null || !inRange(s.subtitleCues, index) ? null : index;
      // Clearing an already-empty selection is what every click on an empty
      // stretch of ruler does; it must not churn the store or fire the
      // focus listeners.
      if (next === null && s.selectedCueIndex === null) {
        return {};
      }
      return { selectedCueIndex: next, cueFocusNonce: s.cueFocusNonce + 1 };
    }),

  setSubtitleStyle: (patch) => set((s) => applySubtitleStylePatch(s.subtitleStyle, patch)),

  beginCueDrag: () =>
    set((s) =>
      // Idempotent: a mid-gesture re-subscribe (the zoom level changing under a
      // drag, say) must not re-snapshot, or the origin becomes the half-dragged
      // list and dragging back no longer restores what was there.
      s.subtitleDragOrigin ? {} : { subtitleDragOrigin: s.subtitleCues }
    ),

  dragCues: (candidate, options) =>
    set((s) => {
      if (!s.subtitleDragOrigin) {
        return {}; // No gesture open — a stray move event after the mouse came up.
      }
      const duration = options?.durationSeconds;
      const subtitleCues = normalizeCues(
        candidate,
        typeof duration === "number" && duration > 0 ? { durationSeconds: duration } : {}
      );
      if (sameCues(subtitleCues, s.subtitleCues)) {
        return {}; // The pointer moved less than a cue boundary; no re-render.
      }
      return { subtitleCues, ...clampSelection(s, subtitleCues) };
    }),

  endCueDrag: () =>
    set((s) => {
      const origin = s.subtitleDragOrigin;
      if (!origin) {
        return {};
      }
      if (sameCues(origin, s.subtitleCues)) {
        return { subtitleDragOrigin: null }; // Nothing moved: no undo step to spend.
      }
      return {
        subtitleDragOrigin: null,
        subtitleUndoStack: [...s.subtitleUndoStack, origin].slice(-SUBTITLE_UNDO_LIMIT),
      };
    }),

  reset: () => set({ ...initialState }),
}));
