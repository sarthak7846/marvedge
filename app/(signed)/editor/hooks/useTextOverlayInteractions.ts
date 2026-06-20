import React from "react";

import { TextOverlayItem } from "../types";
import { useTextOverlayDrag } from "./useTextOverlayDrag";
import { useTextOverlayResize } from "./useTextOverlayResize";

interface UseTextOverlayInteractionsProps {
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
  resizingTextOverlayId: string | null;
  setResizingTextOverlayId: (id: string | null) => void;
}

export function useTextOverlayInteractions(props: UseTextOverlayInteractionsProps) {
  const { handleTextOverlayMouseDown } = useTextOverlayDrag({
    textOverlays: props.textOverlays,
    setTextOverlays: props.setTextOverlays,
    zoomFocusStageRef: props.zoomFocusStageRef,
    setSelectedTextOverlayId: props.setSelectedTextOverlayId,
    setTextOverlayInput: props.setTextOverlayInput,
    setTextOverlayFontFamily: props.setTextOverlayFontFamily,
    setTextOverlayFontSize: props.setTextOverlayFontSize,
    setTextOverlayColor: props.setTextOverlayColor,
    draggingTextOverlayId: props.draggingTextOverlayId,
    setDraggingTextOverlayId: props.setDraggingTextOverlayId,
  });

  const { handleTextOverlayResizeMouseDown } = useTextOverlayResize({
    textOverlays: props.textOverlays,
    setTextOverlays: props.setTextOverlays,
    zoomFocusStageRef: props.zoomFocusStageRef,
    setSelectedTextOverlayId: props.setSelectedTextOverlayId,
    setTextOverlayInput: props.setTextOverlayInput,
    setTextOverlayFontFamily: props.setTextOverlayFontFamily,
    setTextOverlayFontSize: props.setTextOverlayFontSize,
    setTextOverlayColor: props.setTextOverlayColor,
    resizingTextOverlayId: props.resizingTextOverlayId,
    setResizingTextOverlayId: props.setResizingTextOverlayId,
  });

  return { handleTextOverlayMouseDown, handleTextOverlayResizeMouseDown };
}
