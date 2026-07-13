import React from "react";
import axios from "axios";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { notifyAutosavePending } from "../utils/autosaveHelpers";
import { buildEditingPayload } from "../utils/editingDraft";
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
    avs,
    sidebarTitle,
    sidebarDescription,
  } = editorState;

  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosavePayloadRef = React.useRef<string>("");
  const autosaveInFlightRef = React.useRef(false);

  const buildPayload = React.useCallback(() => {
    return buildEditingPayload({
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
      avs,
    });
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
    avs,
  ]);

  const flushAutosave = React.useCallback(async () => {
    const demoId = savedDemoId;
    if (!demoId) {
      return;
    }
    if (autosaveInFlightRef.current) {
      return;
    }

    const payload = {
      id: demoId,
      title: sidebarTitle || "",
      description: sidebarDescription || "",
      editing: buildPayload(),
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
  }, [buildPayload, savedDemoId, sidebarTitle, sidebarDescription]);

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
    avs,
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
