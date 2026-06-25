import React from "react";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";

interface ZoomFocusOverlayProps {
  activeEditedZoomSegment: ZoomEffect;
  isDraggingZoomTarget: boolean;
  zoomFocusSizePct: number;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export default function ZoomFocusOverlay({
  activeEditedZoomSegment,
  isDraggingZoomTarget,
  zoomFocusSizePct,
  onMouseDown,
}: ZoomFocusOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-50"
      onMouseDown={onMouseDown}
      style={{
        cursor: isDraggingZoomTarget ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      <div
        className="absolute rounded-lg pointer-events-none"
        style={{
          width: `${zoomFocusSizePct}%`,
          height: `${zoomFocusSizePct}%`,
          left: `${activeEditedZoomSegment.x * 100}%`,
          top: `${activeEditedZoomSegment.y * 100}%`,
          transform: "translate(-50%, -50%)",
          border: "2px solid #ef4444",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.55) inset",
          background: "rgba(239,68,68,0.08)",
          transition: isDraggingZoomTarget ? "none" : "left 0.12s ease, top 0.12s ease",
        }}
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium pointer-events-none backdrop-blur-sm">
        Drag to adjust zoom
      </div>
    </div>
  );
}
