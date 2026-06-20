import React from "react";

import { resolveOverlayFontFamily } from "../utils/overlayFont";
import { TextOverlayItem } from "../types";

type EditorMode = "main" | "trim" | "zoom" | "text";

interface TextOverlayItemViewProps {
  overlay: TextOverlayItem;
  isSelected: boolean;
  resizingTextOverlayId: string | null;
  draggingTextOverlayId: string | null;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  setSelectedTextOverlayId: (id: string | null) => void;
  setTextOverlayInput: (value: string) => void;
  setTextOverlayFontFamily: (value: string) => void;
  setTextOverlayFontSize: (value: number) => void;
  setTextOverlayColor: (value: string) => void;
  setMode: React.Dispatch<React.SetStateAction<EditorMode>>;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>, overlayId: string) => void;
  onResizeMouseDown: (event: React.MouseEvent<HTMLButtonElement>, overlayId: string) => void;
}

export default function TextOverlayItemView({
  overlay,
  isSelected,
  resizingTextOverlayId,
  draggingTextOverlayId,
  zoomFocusStageRef,
  setTextOverlays,
  setSelectedTextOverlayId,
  setTextOverlayInput,
  setTextOverlayFontFamily,
  setTextOverlayFontSize,
  setTextOverlayColor,
  setMode,
  onMouseDown,
  onResizeMouseDown,
}: TextOverlayItemViewProps) {
  return (
    <div
      className={`absolute rounded-md ${
        isSelected ? "border border-[#7C5CFC]/80" : "border border-transparent"
      }`}
      style={{
        left: `${overlay.x * 100}%`,
        top: `${overlay.y * 100}%`,
        transform: "translate(-50%, -50%)",
        cursor:
          resizingTextOverlayId === overlay.id
            ? "nwse-resize"
            : draggingTextOverlayId === overlay.id
              ? "grabbing"
              : "grab",
        userSelect: "none",
        padding: "2px 4px",
        width: `${overlay.w}px`,
        height: `${overlay.h}px`,
      }}
      onMouseDown={(event) => onMouseDown(event, overlay.id)}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedTextOverlayId(overlay.id);
        setTextOverlayInput(overlay.text);
        setTextOverlayFontFamily(overlay.fontFamily);
        setTextOverlayFontSize(overlay.fontSize);
        setTextOverlayColor(overlay.color);
        setMode("text");
      }}
    >
      {isSelected && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#7C5CFC] text-white p-1 rounded cursor-grab shadow-md"
          onMouseDown={(e) => {
            onMouseDown(e, overlay.id);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
      )}
      {isSelected ? (
        <textarea
          value={overlay.text}
          rows={Math.max(1, overlay.text.split("\n").length)}
          onChange={(event) => {
            const value = event.target.value;
            const stage = zoomFocusStageRef.current;
            const stageW = stage ? stage.getBoundingClientRect().width : 800;
            const stageH = stage ? stage.getBoundingClientRect().height : 450;
            setTextOverlays((prev) =>
              prev.map((item) =>
                item.id === overlay.id
                  ? {
                      ...item,
                      text: value,
                      parentW: stageW,
                      parentH: stageH,
                    }
                  : item
              )
            );
            setTextOverlayInput(value);
          }}
          className="w-full h-full bg-transparent outline-none border border-dashed border-[#A594F9] text-white resize-none"
          style={{
            fontFamily: resolveOverlayFontFamily(overlay.fontFamily),
            fontSize: `${overlay.fontSize}px`,
            color: overlay.color,
            lineHeight: 1.2,
            textShadow: "0 1px 2px rgba(0,0,0,0.55)",
            overflow: "auto",
            padding: "2px 4px",
          }}
        />
      ) : (
        <div
          className="whitespace-pre-wrap break-words w-full h-full"
          style={{
            fontFamily: resolveOverlayFontFamily(overlay.fontFamily),
            fontSize: `${overlay.fontSize}px`,
            color: overlay.color,
            lineHeight: 1.2,
            textShadow: "0 1px 2px rgba(0,0,0,0.55)",
            overflow: "hidden",
            padding: "2px 4px",
          }}
        >
          {overlay.text}
        </div>
      )}
      {isSelected && (
        <button
          type="button"
          aria-label="Delete text"
          className="absolute -top-7 right-0 h-6 w-6 rounded bg-red-500 text-white shadow hover:bg-red-600 flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTextOverlays((prev) => prev.filter((item) => item.id !== overlay.id));
            setSelectedTextOverlayId(null);
          }}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 7h12M9 7V5h6v2m-7 3v7m4-7v7m4-7v7M8 21h8a1 1 0 001-1V7H7v13a1 1 0 001 1z"
            />
          </svg>
        </button>
      )}
      {isSelected && (
        <button
          type="button"
          aria-label="Resize text"
          className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-[#7C5CFC] shadow"
          onMouseDown={(event) => onResizeMouseDown(event, overlay.id)}
        />
      )}
    </div>
  );
}
