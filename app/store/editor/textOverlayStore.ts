import type { Dispatch, SetStateAction } from "react";
import { create } from "zustand";

import type { TextOverlayItem } from "@/app/(signed)/editor/types";

/**
 * Text-overlay state store (issue #150). Holds the value state that used to live
 * as `useState` in the `useTextOverlays` hook: the overlay list plus the ids of
 * the currently selected / dragging / resizing overlays.
 *
 * The transient drag/resize geometry (offset + start refs) intentionally stays as
 * React refs inside `useTextOverlayDrag` / `useTextOverlayResize`; the inspector's
 * input/font/colour draft state stays local to `useTextOverlayInspector`. Only the
 * serializable overlay state lives here.
 *
 * Setters mirror React's `useState` signature (`Dispatch<SetStateAction<T>>`) so the
 * `useTextOverlays` shim keeps returning the exact same shape and every existing
 * consumer — including functional updates like `setTextOverlays(prev => ...)` used
 * by the drag/resize sub-hooks — keeps working untouched.
 */
export interface TextOverlayStoreState {
  textOverlays: TextOverlayItem[];
  selectedTextOverlayId: string | null;
  draggingTextOverlayId: string | null;
  resizingTextOverlayId: string | null;

  setTextOverlays: Dispatch<SetStateAction<TextOverlayItem[]>>;
  setSelectedTextOverlayId: Dispatch<SetStateAction<string | null>>;
  setDraggingTextOverlayId: Dispatch<SetStateAction<string | null>>;
  setResizingTextOverlayId: Dispatch<SetStateAction<string | null>>;

  reset: () => void;
}

/** Resolve a `SetStateAction` against the previous value (supports functional updates). */
const resolve = <T>(value: SetStateAction<T>, prev: T): T =>
  typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

const initialState = {
  textOverlays: [] as TextOverlayItem[],
  selectedTextOverlayId: null as string | null,
  draggingTextOverlayId: null as string | null,
  resizingTextOverlayId: null as string | null,
};

export const useTextOverlayStore = create<TextOverlayStoreState>((set) => ({
  ...initialState,

  setTextOverlays: (v) => set((s) => ({ textOverlays: resolve(v, s.textOverlays) })),
  setSelectedTextOverlayId: (v) =>
    set((s) => ({ selectedTextOverlayId: resolve(v, s.selectedTextOverlayId) })),
  setDraggingTextOverlayId: (v) =>
    set((s) => ({ draggingTextOverlayId: resolve(v, s.draggingTextOverlayId) })),
  setResizingTextOverlayId: (v) =>
    set((s) => ({ resizingTextOverlayId: resolve(v, s.resizingTextOverlayId) })),

  reset: () => set({ ...initialState }),
}));
