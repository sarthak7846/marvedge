import React from "react";
import Image from "next/image";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { DragState, DragZoomState, DragTextState, TextOverlayItem } from "./types";

type TimelineMode = "main" | "trim" | "zoom" | "text";

export function TrimSegmentBlock({
  segment,
  idx,
  activeSegment,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  switchToTrimMode,
  playTrimSegment,
  setDragState,
  trackIdx,
}: {
  segment: { start: number; end: number };
  idx: number;
  activeSegment: number;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  switchToTrimMode: (trimIdx: number) => void;
  playTrimSegment: (
    segment: { start: number; end: number },
    idx: number,
    e?: React.MouseEvent
  ) => void;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  trackIdx: number;
}) {
  const startPosition = ((segment.start - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((segment.end - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = endPosition - startPosition;

  return (
    <div
      className={`absolute h-[32px] group cursor-grab transition-opacity track-red sequence-block-shape width-trim-block ${
        idx === activeSegment && activeSegment != -1
          ? "bg-[#FF3939]/54 opacity-70 z-10 hover:border-2 border-black rounded-md active"
          : "bg-[#FF3939]/35 opacity-50 hover:opacity-65 z-8"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${38 + trackIdx * 36}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        switchToTrimMode(idx);
        playTrimSegment(segment, idx, e);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragState({
          mode: "segment",
          index: idx,
          startX: e.clientX,
          startY: e.clientY,
          startTrack: trackIdx,
          startValue: segment.start,
          endValue: segment.end,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center ">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden">
          <Image
            src="/icons/Violet_scissor.svg"
            alt="Trim"
            width={14.89}
            height={14.89}
            className="select-none"
          />
          <div className="text-base font-bold text-[#8A76FC] select-none track-text">Trim</div>
        </div>
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#FF3939]/54 rounded-l-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#FF3939]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragState({
            mode: "edge",
            index: idx,
            side: "left",
            startX: e.clientX,
            startValue: segment.start,
          });
        }}
        aria-label="Resize start"
        title="Drag to resize start"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#FF3939]/54 rounded-r-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#FF3939]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragState({
            mode: "edge",
            index: idx,
            side: "right",
            startX: e.clientX,
            startValue: segment.end,
          });
        }}
        title="Drag to resize end"
        aria-label="Resize end"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>
    </div>
  );
}

export function ZoomSegmentBlock({
  segment,
  idx,
  activeZoomIdx,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  playZoomSegment,
  setDragZoomState,
  trackIdx,
}: {
  segment: ZoomEffect;
  idx: number;
  activeZoomIdx: number;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  playZoomSegment: (segment: ZoomEffect, idx: number, e?: React.MouseEvent) => void;
  setDragZoomState: React.Dispatch<React.SetStateAction<DragZoomState | null>>;
  trackIdx: number;
}) {
  const startPosition =
    ((segment.startTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((segment.endTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = endPosition - startPosition;

  return (
    <div
      className={`absolute h-[32px] group cursor-grab transition-opacity track-green sequence-block-shape width-zoom-block ${
        idx == activeZoomIdx
          ? "bg-[#36B37E]/40 opacity-80 z-10 hover:border-2 border-[#36B37E] rounded-md active"
          : "bg-[#36B37E]/25 opacity-70 hover:opacity-90 z-8"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${38 + trackIdx * 36}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();

        playZoomSegment(segment, idx, e);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragZoomState({
          mode: "segment",
          index: idx,
          startX: e.clientX,
          startY: e.clientY,
          startTrack: trackIdx,
          startValue: segment.startTime,
          endValue: segment.endTime,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center ">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden">
          <Image
            src="/icons/Violet_scissor.svg"
            alt="Trim"
            width={14.89}
            height={14.89}
            className="select-none"
          />
          <div className="text-base font-bold text-[#8A76FC] select-none track-text">Zoom</div>
        </div>
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#36B37E]/80 rounded-l-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#36B37E]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragZoomState({
            mode: "edge",
            index: idx,
            side: "left",
            startX: e.clientX,
            startValue: segment.startTime,
          });
        }}
        aria-label="Resize start"
        title="Drag to resize start"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#36B37E]/80 rounded-r-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#36B37E]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragZoomState({
            mode: "edge",
            index: idx,
            side: "right",
            startX: e.clientX,
            startValue: segment.endTime,
          });
        }}
        title="Drag to resize end"
        aria-label="Resize end"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>
    </div>
  );
}

export function TextOverlayBlock({
  overlay,
  idx,
  selectedTextOverlayId,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setMode,
  setSelectedTextOverlayId,
  setTextOverlayInspectorValues,
  updateCurrentTimeFromMouse,
  setPlaying,
  setDragTextState,
  trackIdx,
}: {
  overlay: TextOverlayItem;
  idx: number;
  selectedTextOverlayId: string | null;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setMode: React.Dispatch<React.SetStateAction<TimelineMode>>;
  setSelectedTextOverlayId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextOverlayInspectorValues: (overlay: TextOverlayItem) => void;
  updateCurrentTimeFromMouse: (e: MouseEvent | React.MouseEvent) => void;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setDragTextState: React.Dispatch<React.SetStateAction<DragTextState | null>>;
  trackIdx: number;
}) {
  const startPosition =
    ((overlay.startTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((overlay.endTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = Math.max(6, endPosition - startPosition);
  const isSelected = overlay.id === selectedTextOverlayId;
  const label = overlay.text?.trim() ? overlay.text.trim() : `Text ${idx + 1}`;

  return (
    <div
      className={`absolute h-[32px] group cursor-grab transition-opacity track-yellow sequence-block-shape width-text-block ${
        isSelected
          ? "bg-[#FFF4A8]/85 opacity-90 z-10 hover:border-2 border-[#B38700] rounded-md active"
          : "bg-[#FFF4A8]/65 opacity-75 hover:opacity-90 border border-[#D4A017] z-8 rounded-md"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${38 + trackIdx * 36}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        setMode("text");
        setSelectedTextOverlayId(overlay.id);
        setTextOverlayInspectorValues(overlay);
        updateCurrentTimeFromMouse(e);
        setPlaying(false);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragTextState({
          mode: "segment",
          id: overlay.id,
          startX: e.clientX,
          startY: e.clientY,
          startTrack: trackIdx,
          startValue: overlay.startTime,
          endValue: overlay.endTime,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden max-w-full">
          <Image
            src="/icons/Violet_scissor.svg"
            alt="Text"
            width={14.89}
            height={14.89}
            className="select-none"
          />
          <div className="text-base font-bold text-[#8A76FC] select-none track-text">Text</div>
          <div className="text-xs text-[#6B5BB5] select-none truncate max-w-[180px] track-text">
            {label}
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#D4A017]/75 rounded-l-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#B38700]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragTextState({
            mode: "edge",
            id: overlay.id,
            side: "left",
            startX: e.clientX,
            startValue: overlay.startTime,
          });
        }}
        aria-label="Resize text start"
        title="Drag to resize start"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#D4A017]/75 rounded-r-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#B38700]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragTextState({
            mode: "edge",
            id: overlay.id,
            side: "right",
            startX: e.clientX,
            startValue: overlay.endTime,
          });
        }}
        aria-label="Resize text end"
        title="Drag to resize end"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>
    </div>
  );
}
