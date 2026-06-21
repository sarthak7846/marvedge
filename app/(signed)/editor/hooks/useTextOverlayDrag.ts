import React, { useCallback, useEffect, useRef } from "react";

import { clamp } from "../utils/clamp";
import { TextOverlayItem } from "../types";

interface UseTextOverlayDragProps {
  textOverlays: TextOverlayItem[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  setSelectedTextOverlayId: (id: string | null) => void;
  setTextOverlayInput: (value: string) => void;
  setTextOverlayFontFamily: (value: string) => void;
  setTextOverlayFontSize: (value: number) => void;
  setTextOverlayColor: (value: string) => void;
  draggingTextOverlayId: string | null;
  setDraggingTextOverlayId: (id: string | null) => void;
}

export function useTextOverlayDrag({
  textOverlays,
  setTextOverlays,
  zoomFocusStageRef,
  setSelectedTextOverlayId,
  setTextOverlayInput,
  setTextOverlayFontFamily,
  setTextOverlayFontSize,
  setTextOverlayColor,
  draggingTextOverlayId,
  setDraggingTextOverlayId,
}: UseTextOverlayDragProps) {
  const textDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTextOverlayMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, overlayId: string) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      const stage = zoomFocusStageRef.current;
      if (!stage) {
        return;
      }

      const currentOverlay = textOverlays.find((item) => item.id === overlayId);
      if (!currentOverlay) {
        return;
      }

      const rect = stage.getBoundingClientRect();
      textDragOffsetRef.current = {
        x: event.clientX - rect.left - currentOverlay.x * rect.width,
        y: event.clientY - rect.top - currentOverlay.y * rect.height,
      };

      event.preventDefault();
      event.stopPropagation();
      setSelectedTextOverlayId(overlayId);
      setTextOverlayInput(currentOverlay.text);
      setTextOverlayFontFamily(currentOverlay.fontFamily);
      setTextOverlayFontSize(currentOverlay.fontSize);
      setTextOverlayColor(currentOverlay.color);
      setDraggingTextOverlayId(overlayId);
    },
    [
      textOverlays,
      zoomFocusStageRef,
      setSelectedTextOverlayId,
      setTextOverlayInput,
      setTextOverlayFontFamily,
      setTextOverlayFontSize,
      setTextOverlayColor,
      setDraggingTextOverlayId,
    ]
  );

  useEffect(() => {
    if (!draggingTextOverlayId) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      const stage = zoomFocusStageRef.current;
      if (!stage) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const x = clamp((event.clientX - rect.left - textDragOffsetRef.current.x) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top - textDragOffsetRef.current.y) / rect.height, 0, 1);

      setTextOverlays((prev) =>
        prev.map((item) =>
          item.id === draggingTextOverlayId
            ? { ...item, x, y, parentW: rect.width, parentH: rect.height }
            : item
        )
      );
    };

    const onUp = () => {
      setDraggingTextOverlayId(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingTextOverlayId, zoomFocusStageRef, setTextOverlays, setDraggingTextOverlayId]);

  return { handleTextOverlayMouseDown };
}
