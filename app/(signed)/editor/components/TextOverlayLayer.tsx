import React from "react";

import TextOverlayItemView from "./TextOverlayItemView";
import type { TextOverlaysApi } from "../apiTypes";

type EditorMode = "main" | "trim" | "zoom" | "text";

interface TextOverlayLayerProps {
  text: TextOverlaysApi;
  currentTime: number;
  videoUrl: string | null;
  tool: string;
  shouldShowZoomFocusBox: boolean;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  setMode: React.Dispatch<React.SetStateAction<EditorMode>>;
}

export default function TextOverlayLayer({
  text,
  currentTime,
  videoUrl,
  tool,
  shouldShowZoomFocusBox,
  zoomFocusStageRef,
  setMode,
}: TextOverlayLayerProps) {
  return (
    <div
      className="absolute inset-0 z-50"
      style={{
        pointerEvents: !videoUrl
          ? "none"
          : (tool === "none" || tool === "text") && !shouldShowZoomFocusBox
            ? "auto"
            : "none",
      }}
    >
      {text.textOverlays
        .filter((overlay) => currentTime >= overlay.startTime && currentTime <= overlay.endTime)
        .map((overlay) => (
          <TextOverlayItemView
            key={overlay.id}
            overlay={overlay}
            isSelected={text.selectedTextOverlayId === overlay.id}
            resizingTextOverlayId={text.resizingTextOverlayId}
            draggingTextOverlayId={text.draggingTextOverlayId}
            zoomFocusStageRef={zoomFocusStageRef}
            setTextOverlays={text.setTextOverlays}
            setSelectedTextOverlayId={text.setSelectedTextOverlayId}
            setTextOverlayInput={text.setTextOverlayInput}
            setTextOverlayFontFamily={text.setTextOverlayFontFamily}
            setTextOverlayFontSize={text.setTextOverlayFontSize}
            setTextOverlayColor={text.setTextOverlayColor}
            setMode={setMode}
            onMouseDown={text.handleTextOverlayMouseDown}
            onResizeMouseDown={text.handleTextOverlayResizeMouseDown}
          />
        ))}
    </div>
  );
}
