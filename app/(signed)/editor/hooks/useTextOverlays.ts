import React, { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { useTextOverlayStore } from "@/app/store/editor/textOverlayStore";
import { TextOverlayItem } from "../types";
import type { EditorState } from "../apiTypes";
import { useTextOverlayInspector } from "./useTextOverlayInspector";
import { useTextOverlayInteractions } from "./useTextOverlayInteractions";

interface UseTextOverlaysProps {
  editorState: EditorState;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
}

export function useTextOverlays({ editorState, zoomFocusStageRef }: UseTextOverlaysProps) {
  const { currentTime, duration, setTool } = editorState;

  const {
    textOverlays,
    selectedTextOverlayId,
    draggingTextOverlayId,
    resizingTextOverlayId,
    setTextOverlays,
    setSelectedTextOverlayId,
    setDraggingTextOverlayId,
    setResizingTextOverlayId,
  } = useTextOverlayStore(
    useShallow((s) => ({
      textOverlays: s.textOverlays,
      selectedTextOverlayId: s.selectedTextOverlayId,
      draggingTextOverlayId: s.draggingTextOverlayId,
      resizingTextOverlayId: s.resizingTextOverlayId,
      setTextOverlays: s.setTextOverlays,
      setSelectedTextOverlayId: s.setSelectedTextOverlayId,
      setDraggingTextOverlayId: s.setDraggingTextOverlayId,
      setResizingTextOverlayId: s.setResizingTextOverlayId,
    }))
  );

  const inspector = useTextOverlayInspector({
    selectedTextOverlayId,
    setTextOverlays,
    zoomFocusStageRef,
  });

  const setTextOverlaysFromUrl = useCallback(
    (overlays: unknown) => {
      if (!overlays) {
        setTextOverlays([]);
        return;
      }
      if (Array.isArray(overlays)) {
        setTextOverlays(overlays as TextOverlayItem[]);
      }
    },
    [setTextOverlays]
  );

  const handleAddTextOverlay = useCallback(() => {
    const text = inspector.textOverlayInput.trim() || "Add text";
    const start = Math.max(0, currentTime);
    const defaultDuration = 3;
    const end =
      duration > 0 ? Math.min(duration, start + defaultDuration) : start + defaultDuration;

    const stage = zoomFocusStageRef.current;
    const stageW = stage ? stage.getBoundingClientRect().width : 800;
    const stageH = stage ? stage.getBoundingClientRect().height : 450;

    const newOverlay: TextOverlayItem = {
      id: `text-${Date.now()}`,
      text,
      x: 0.5,
      y: 0.5,
      w: 240,
      h: 80,
      startTime: start,
      endTime: Math.max(end, start + 0.1),
      fontFamily: inspector.textOverlayFontFamily,
      fontSize: inspector.textOverlayFontSize,
      color: inspector.textOverlayColor,
      parentW: stageW,
      parentH: stageH,
    };

    setTextOverlays((prev) => [...prev, newOverlay]);
    setSelectedTextOverlayId(newOverlay.id);
    setTool("none");
  }, [
    currentTime,
    duration,
    setTool,
    setTextOverlays,
    setSelectedTextOverlayId,
    inspector.textOverlayColor,
    inspector.textOverlayFontFamily,
    inspector.textOverlayFontSize,
    inspector.textOverlayInput,
    zoomFocusStageRef,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTyping =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;
      if (isTyping) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedTextOverlayId) {
          setTextOverlays((prev) => prev.filter((item) => item.id !== selectedTextOverlayId));
          setSelectedTextOverlayId(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTextOverlayId, setTextOverlays, setSelectedTextOverlayId]);

  const interactions = useTextOverlayInteractions({
    textOverlays,
    setTextOverlays,
    zoomFocusStageRef,
    setSelectedTextOverlayId,
    setTextOverlayInput: inspector.setTextOverlayInput,
    setTextOverlayFontFamily: inspector.setTextOverlayFontFamily,
    setTextOverlayFontSize: inspector.setTextOverlayFontSize,
    setTextOverlayColor: inspector.setTextOverlayColor,
    draggingTextOverlayId,
    setDraggingTextOverlayId,
    resizingTextOverlayId,
    setResizingTextOverlayId,
  });

  return {
    textOverlays,
    setTextOverlays,
    selectedTextOverlayId,
    setSelectedTextOverlayId,
    draggingTextOverlayId,
    resizingTextOverlayId,
    setTextOverlaysFromUrl,
    handleAddTextOverlay,
    ...inspector,
    ...interactions,
  };
}
