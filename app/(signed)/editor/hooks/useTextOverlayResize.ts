import React, { useCallback, useEffect, useRef } from "react";

import { clamp } from "../utils/clamp";
import { TextOverlayItem } from "../types";

interface UseTextOverlayResizeProps {
  textOverlays: TextOverlayItem[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  setSelectedTextOverlayId: (id: string | null) => void;
  setTextOverlayInput: (value: string) => void;
  setTextOverlayFontFamily: (value: string) => void;
  setTextOverlayFontSize: (value: number) => void;
  setTextOverlayColor: (value: string) => void;
  resizingTextOverlayId: string | null;
  setResizingTextOverlayId: (id: string | null) => void;
}

export function useTextOverlayResize({
  textOverlays,
  setTextOverlays,
  zoomFocusStageRef,
  setSelectedTextOverlayId,
  setTextOverlayInput,
  setTextOverlayFontFamily,
  setTextOverlayFontSize,
  setTextOverlayColor,
  resizingTextOverlayId,
  setResizingTextOverlayId,
}: UseTextOverlayResizeProps) {
  const textResizeStartRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  }>({
    startX: 0,
    startY: 0,
    startW: 240,
    startH: 80,
  });

  const handleTextOverlayResizeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, overlayId: string) => {
      const currentOverlay = textOverlays.find((item) => item.id === overlayId);
      if (!currentOverlay) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setSelectedTextOverlayId(overlayId);
      setTextOverlayInput(currentOverlay.text);
      setTextOverlayFontFamily(currentOverlay.fontFamily);
      setTextOverlayFontSize(currentOverlay.fontSize);
      setTextOverlayColor(currentOverlay.color);
      textResizeStartRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startW: currentOverlay.w,
        startH: currentOverlay.h,
      };
      setResizingTextOverlayId(overlayId);
    },
    [
      textOverlays,
      setSelectedTextOverlayId,
      setTextOverlayInput,
      setTextOverlayFontFamily,
      setTextOverlayFontSize,
      setTextOverlayColor,
      setResizingTextOverlayId,
    ]
  );

  useEffect(() => {
    if (!resizingTextOverlayId) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      const deltaX = event.clientX - textResizeStartRef.current.startX;
      const deltaY = event.clientY - textResizeStartRef.current.startY;
      const nextW = clamp(Math.round(textResizeStartRef.current.startW + deltaX), 120, 900);
      const nextH = clamp(Math.round(textResizeStartRef.current.startH + deltaY), 40, 600);

      const stage = zoomFocusStageRef.current;
      const stageW = stage ? stage.getBoundingClientRect().width : 800;
      const stageH = stage ? stage.getBoundingClientRect().height : 450;

      setTextOverlays((prev) =>
        prev.map((item) =>
          item.id === resizingTextOverlayId
            ? { ...item, w: nextW, h: nextH, parentW: stageW, parentH: stageH }
            : item
        )
      );
    };

    const onUp = () => {
      setResizingTextOverlayId(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingTextOverlayId, zoomFocusStageRef, setTextOverlays, setResizingTextOverlayId]);

  return { handleTextOverlayResizeMouseDown };
}
