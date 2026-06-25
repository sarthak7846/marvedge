import React from "react";
import axios from "axios";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { notifyAutosavePending } from "../utils/autosaveHelpers";
import { SubtitleCue, TextOverlayItem } from "../types";
import type { EditorState } from "../apiTypes";

interface UseAutosaveProps {
  editorState: EditorState;
  isDark: boolean;
  isEditorInitializedRef: React.RefObject<boolean>;
  segments: { start: number; end: number }[];
  zoomSegments: ZoomEffect[];
  subtitleCues: SubtitleCue[];
  textOverlays: TextOverlayItem[];
}

export function useAutosave({
  editorState,
  isDark,
  isEditorInitializedRef,
  segments,
  zoomSegments,
  subtitleCues,
  textOverlays,
}: UseAutosaveProps) {
  const {
    savedDemoId,
    selectedBackground,
    backgroundType,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
    sidebarTitle,
    sidebarDescription,
  } = editorState;

  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosavePayloadRef = React.useRef<string>("");
  const autosaveInFlightRef = React.useRef(false);

  const buildEditingPayload = React.useCallback(() => {
    return {
      segments: segments.map((s) => ({
        start: String(s.start),
        end: String(s.end),
      })),
      zoom: zoomSegments,
      background: selectedBackground ?? null,
      backgroundType: backgroundType || "",
      subtitles: subtitleCues || [],
      textOverlays: textOverlays || [],
      aspectRatio: aspectRatio || "native",
      browserFrame: {
        mode: browserFrameMode,
        drawShadow: browserFrameDrawShadow,
        drawBorder: browserFrameDrawBorder,
      },
    };
  }, [
    segments,
    zoomSegments,
    selectedBackground,
    backgroundType,
    subtitleCues,
    textOverlays,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
  ]);

  const flushAutosave = React.useCallback(async () => {
    const demoId = savedDemoId;
    if (!demoId) {
      return;
    }
    if (!isEditorInitializedRef.current) {
      return;
    }
    if (autosaveInFlightRef.current) {
      return;
    }

    const payload = {
      id: demoId,
      title: sidebarTitle || "",
      description: sidebarDescription || "",
      editing: buildEditingPayload(),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastAutosavePayloadRef.current) {
      return;
    }
    lastAutosavePayloadRef.current = serialized;

    autosaveInFlightRef.current = true;
    try {
      await axios.patch("/api/demo", payload);
    } catch (e) {
      console.warn("Autosave failed:", e);
    } finally {
      autosaveInFlightRef.current = false;
    }
  }, [buildEditingPayload, savedDemoId, sidebarTitle, sidebarDescription]);

  React.useEffect(() => {
    if (!savedDemoId) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (isEditorInitializedRef.current) {
      notifyAutosavePending(isDark);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void flushAutosave();
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    savedDemoId,
    segments,
    zoomSegments,
    selectedBackground,
    backgroundType,
    subtitleCues,
    textOverlays,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
    sidebarTitle,
    sidebarDescription,
    flushAutosave,
    isDark,
    isEditorInitializedRef,
  ]);

  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flushAutosave();
      }
    };
    const handleBeforeUnload = () => {
      void flushAutosave();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushAutosave]);

  React.useEffect(() => {
    return () => {
      void flushAutosave();
    };
  }, [flushAutosave]);
}
