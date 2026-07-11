import type { Dispatch, SetStateAction } from "react";
import { create } from "zustand";

import type { ZoomEffect } from "@/app/types/editor/zoom-effect";

/**
 * A raw click event captured by the Marvedge Chrome Extension and forwarded to
 * the editor for auto-zoom suggestions. Mirrors the payload posted by the
 * extension content script.
 */
export interface ExtensionClickEvent {
  timestamp_ms: number;
  event_type: string;
  coordinates: {
    x: number;
    y: number;
  };
  screenshot_scale: number;
  target_element: string;
}

/**
 * Zoom editor state store (issue #150). Holds the local state that used to live
 * in the `useZoomEditor` hook as `useState` calls. `useZoomEditor` is now a thin
 * shim over this store (strangler pattern) and keeps returning the exact same
 * shape, so `EditorClient` and every downstream consumer stay untouched.
 *
 * Setters mirror React's `useState` signature (`Dispatch<SetStateAction<T>>`) so
 * that functional updates like `setZoomSegments(prev => ...)` — used throughout
 * the timeline-ruler hooks and `ZoomModal` — keep working unchanged.
 */
export interface ZoomStoreState {
  activeZoomIdx: number;
  zoomSegments: ZoomEffect[];
  zoomLevel: number;
  isDraggingZoomTarget: boolean;
  showZoomModal: boolean;

  // Chrome Extension click events → auto-zoom suggestions
  extensionEvents: ExtensionClickEvent[];
  hasAppliedAutoZoom: boolean;

  setActiveZoomIdx: Dispatch<SetStateAction<number>>;
  setZoomSegments: Dispatch<SetStateAction<ZoomEffect[]>>;
  setZoomLevel: Dispatch<SetStateAction<number>>;
  setIsDraggingZoomTarget: Dispatch<SetStateAction<boolean>>;
  setShowZoomModal: Dispatch<SetStateAction<boolean>>;
  setExtensionEvents: Dispatch<SetStateAction<ExtensionClickEvent[]>>;
  setHasAppliedAutoZoom: Dispatch<SetStateAction<boolean>>;

  reset: () => void;
}

/** Resolve a `SetStateAction` against the previous value (supports functional updates). */
const resolve = <T>(value: SetStateAction<T>, prev: T): T =>
  typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

const initialState = {
  activeZoomIdx: -1,
  zoomSegments: [] as ZoomEffect[],
  zoomLevel: 1,
  isDraggingZoomTarget: false,
  showZoomModal: false,
  extensionEvents: [] as ExtensionClickEvent[],
  hasAppliedAutoZoom: false,
};

export const useZoomStore = create<ZoomStoreState>((set) => ({
  ...initialState,

  setActiveZoomIdx: (v) => set((s) => ({ activeZoomIdx: resolve(v, s.activeZoomIdx) })),
  setZoomSegments: (v) => set((s) => ({ zoomSegments: resolve(v, s.zoomSegments) })),
  setZoomLevel: (v) => set((s) => ({ zoomLevel: resolve(v, s.zoomLevel) })),
  setIsDraggingZoomTarget: (v) =>
    set((s) => ({ isDraggingZoomTarget: resolve(v, s.isDraggingZoomTarget) })),
  setShowZoomModal: (v) => set((s) => ({ showZoomModal: resolve(v, s.showZoomModal) })),
  setExtensionEvents: (v) => set((s) => ({ extensionEvents: resolve(v, s.extensionEvents) })),
  setHasAppliedAutoZoom: (v) =>
    set((s) => ({ hasAppliedAutoZoom: resolve(v, s.hasAppliedAutoZoom) })),

  reset: () => set({ ...initialState }),
}));
