import React, { useCallback, useEffect, useState } from "react";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { clamp } from "../utils/clamp";
import { computeZoomPreview } from "../utils/zoomPreview";
import type { EditorState } from "../apiTypes";

type EditorMode = "main" | "trim" | "zoom" | "text";

interface UseZoomEditorProps {
  editorState: EditorState;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  lastInteractionRef: React.RefObject<number>;
  mode: EditorMode;
}

export function useZoomEditor({
  editorState,
  zoomFocusStageRef,
  lastInteractionRef,
  mode,
}: UseZoomEditorProps) {
  const { currentTime, playerRef } = editorState;

  const [activeZoomIdx, setActiveZoomIdx] = useState<number>(-1);
  const [zoomSegments, setZoomSegments] = useState<ZoomEffect[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDraggingZoomTarget, setIsDraggingZoomTarget] = useState(false);
  const [showZoomModal, setShowZoomModal] = useState(false);

  const preview = computeZoomPreview({ zoomSegments, activeZoomIdx, currentTime });
  const { resolvedZoomIdx, activeEditedZoomSegment, shouldShowZoomFocusBox } = preview;

  const updateZoomTargetFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (resolvedZoomIdx < 0) {
        return;
      }
      if (!shouldShowZoomFocusBox) {
        return;
      }
      const stage = zoomFocusStageRef.current;
      if (!stage) {
        return;
      }

      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const xRaw = (clientX - rect.left) / rect.width;
      const yRaw = (clientY - rect.top) / rect.height;

      const x = clamp(xRaw, 0, 1);
      const y = clamp(yRaw, 0, 1);

      setZoomSegments((prev) =>
        prev.map((segment, index) => (index === resolvedZoomIdx ? { ...segment, x, y } : segment))
      );
    },
    [resolvedZoomIdx, shouldShowZoomFocusBox, zoomFocusStageRef]
  );

  const handleZoomTargetMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!activeEditedZoomSegment) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingZoomTarget(true);
      updateZoomTargetFromPointer(event.clientX, event.clientY);
    },
    [activeEditedZoomSegment, updateZoomTargetFromPointer]
  );

  useEffect(() => {
    if (!isDraggingZoomTarget) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      updateZoomTargetFromPointer(event.clientX, event.clientY);
    };
    const onUp = () => {
      setIsDraggingZoomTarget(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingZoomTarget, updateZoomTargetFromPointer]);

  useEffect(() => {
    if (activeZoomIdx === -1 && zoomSegments.length > 0) {
      setActiveZoomIdx(0);
    }
  }, [activeZoomIdx, zoomSegments.length]);

  useEffect(() => {
    if (!currentTime) {
      return;
    }

    const segment = zoomSegments.find(
      (z) => currentTime >= z.startTime && currentTime <= z.endTime
    );

    if (segment) {
      setZoomLevel(segment.zoomLevel);
    } else {
      setZoomLevel(1);
    }
    if (mode === "zoom" && activeZoomIdx != -1) {
      if (Date.now() - lastInteractionRef.current < 500) {
        return;
      }
      const zoomInfo = zoomSegments[activeZoomIdx];
      if (zoomInfo && currentTime >= zoomInfo.endTime) {
        playerRef.current.seekTo(zoomInfo.startTime, "seconds");
      }
    }
  }, [activeZoomIdx, currentTime, mode, playerRef, zoomSegments, lastInteractionRef]);

  return {
    activeZoomIdx,
    setActiveZoomIdx,
    zoomSegments,
    setZoomSegments,
    zoomLevel,
    isDraggingZoomTarget,
    showZoomModal,
    setShowZoomModal,
    handleZoomTargetMouseDown,
    preview,
  };
}
