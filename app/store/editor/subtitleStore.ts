import type { Dispatch, SetStateAction } from "react";
import { create } from "zustand";

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
 */
export interface SubtitleStoreState {
  subtitleCues: SubtitleCue[];
  subtitlesLoading: boolean;

  setSubtitleCues: Dispatch<SetStateAction<SubtitleCue[]>>;
  setSubtitlesLoading: Dispatch<SetStateAction<boolean>>;

  reset: () => void;
}

/** Resolve a `SetStateAction` against the previous value (supports functional updates). */
const resolve = <T>(value: SetStateAction<T>, prev: T): T =>
  typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

const initialState = {
  subtitleCues: [] as SubtitleCue[],
  subtitlesLoading: false,
};

export const useSubtitleStore = create<SubtitleStoreState>((set) => ({
  ...initialState,

  setSubtitleCues: (v) => set((s) => ({ subtitleCues: resolve(v, s.subtitleCues) })),
  setSubtitlesLoading: (v) => set((s) => ({ subtitlesLoading: resolve(v, s.subtitlesLoading) })),

  reset: () => set({ ...initialState }),
}));
