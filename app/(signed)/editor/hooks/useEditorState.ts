import { useRef } from "react";
import ReactPlayer from "react-player";

import { useEditorStore } from "@/app/store/editor/editorStore";

export interface Segment {
  start: string;
  end: string;
}

export type BrowserFrameMode = "default" | "minimal" | "hidden";

export interface CtaItem {
  id: string;
  label: string;
  url: string;
  placement?: string | null;
  order: number;
}

/**
 * Thin compatibility shim over the editorStore (issue #150).
 *
 * The editor state used to live here as 34 `useState` calls. It now lives in
 * `useEditorStore`; this hook returns the SAME shape (all store fields + setters,
 * plus the three locally-created refs) so existing consumers keep compiling and
 * `EditorState = ReturnType<typeof useEditorState>` keeps resolving.
 *
 * Migrated consumers (EditorClient region components) read from `useEditorStore`
 * via granular selectors directly; this shim stays in place for every consumer
 * that has not been migrated yet (the feature sub-hooks).
 */
export function useEditorState() {
  const store = useEditorStore();

  // Refs stay as refs — never in the store.
  const playerRef = useRef<ReactPlayer>(null!);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  return {
    ...store,
    // Refs
    playerRef,
    canvasRef,
    videoContainerRef,
  };
}
