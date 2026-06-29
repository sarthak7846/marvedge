import React from "react";
import Image from "next/image";
import Linepage from "../Linepage";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { DragState, DragZoomState, DragTextState, TextOverlayItem } from "./types";
import { TrimSegmentBlock, ZoomSegmentBlock, TextOverlayBlock } from "./TimelineBlocks";
import {
  useScissorDrag,
  useSegmentDrag,
  useZoomSegmentDrag,
  useTextOverlayDrag,
} from "./useTimelineDrags";

type TimelineMode = "main" | "trim" | "zoom" | "text";
type NumberSetter = React.Dispatch<React.SetStateAction<number>>;

function SliceHandle({ side, onMouseDown }: { side: "left" | "right"; onMouseDown: () => void }) {
  const lr = side === "left" ? "l" : "r";
  const imageStyle: React.CSSProperties =
    side === "left"
      ? { filter: "brightness(0) invert(1)" }
      : { filter: "brightness(0) invert(1)", transform: "scaleX(-1)" };

  return (
    <div
      className={`flex-none flex flex-col items-center justify-between bg-[#8A76FC] rounded-${lr}-lg cursor-ew-resize z-30 shrink-0 select-none py-3 slice-handle slice-handle-${side}`}
      style={{ width: "32px", height: "100%" }}
      onMouseDown={onMouseDown}
    >
      <div
        className={`flex flex-col items-center justify-between bg-[#8A76FC] rounded-${lr}-lg cursor-ew-resize z-30 shrink-0 select-none slice-handle slice-handle-${side}`}
        style={{ width: "20px", height: "100%" }}
      >
        <div className="flex-1 w-px bg-white/80" />

        <Image
          src="/icons/trim-new.svg"
          alt="Trim"
          width={20}
          height={20}
          className="pointer-events-none select-none"
          style={imageStyle}
        />

        <div className="flex-1 w-px bg-white/80" />
      </div>
    </div>
  );
}

type TimelineTrackProps = {
  baseTimelineWidth: number;
  zoomLevel: number;
  zoomedTimelineWidth: number;
  scrollLeft: number;
  setScrollLeft: NumberSetter;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  rulerRef: React.RefObject<HTMLDivElement | null>;
  isDraggingTimelineRef: React.MutableRefObject<boolean>;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setDraggingCurrentTime: React.Dispatch<React.SetStateAction<boolean>>;
  updateCurrentTimeFromMouse: (e: MouseEvent | React.MouseEvent) => void;
  switchToNonTrimMode: () => void;
  switchToTrimMode: (trimIdx: number) => void;
  minValue: number;
  maxValue: number;
  currentPosition: number;
  setMode: React.Dispatch<React.SetStateAction<TimelineMode>>;
  setActiveZoomIdx: NumberSetter;
  setActiveSegment: NumberSetter;
  segments: { start: number; end: number }[];
  setSegments: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>;
  activeSegment: number;
  playTrimSegment: (
    segment: { start: number; end: number },
    idx: number,
    e?: React.MouseEvent
  ) => void;
  zoomSegments: ZoomEffect[];
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  activeZoomIdx: number;
  playZoomSegment: (segment: ZoomEffect, idx: number, e?: React.MouseEvent) => void;
  textOverlays: TextOverlayItem[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  selectedTextOverlayId: string | null;
  setSelectedTextOverlayId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextOverlayInspectorValues: (overlay: TextOverlayItem) => void;
  trackIndices: Record<string, number>;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
};

type DragSetters = {
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  setDragZoomState: React.Dispatch<React.SetStateAction<DragZoomState | null>>;
  setDragTextState: React.Dispatch<React.SetStateAction<DragTextState | null>>;
};

function RulerLayers(props: TimelineTrackProps & DragSetters) {
  const {
    minValue,
    maxValue,
    zoomLevel,
    zoomedTimelineWidth,
    currentPosition,
    scrollLeft,
    setMode,
    setActiveZoomIdx,
    setActiveSegment,
    segments,
    activeSegment,
    switchToTrimMode,
    playTrimSegment,
    setDragState,
    zoomSegments,
    activeZoomIdx,
    playZoomSegment,
    setDragZoomState,
    textOverlays,
    selectedTextOverlayId,
    setSelectedTextOverlayId,
    setTextOverlayInspectorValues,
    updateCurrentTimeFromMouse,
    setPlaying,
    setDragTextState,
    trackIndices,
  } = props;

  const maxTrackIdx = Object.values(trackIndices || {}).reduce((max, val) => Math.max(max, val), 2);
  const totalTracks = maxTrackIdx + 2;

  return (
    <>
      <Linepage
        maxValue={maxValue}
        minValue={minValue}
        zoomLevel={zoomLevel}
        width={zoomedTimelineWidth}
        setMode={setMode}
        setActiveZoomIdx={setActiveZoomIdx}
        setActiveSegment={setActiveSegment}
      />

      {/* Horizontal separators in background */}
      {Array.from({ length: totalTracks - 1 }).map((_, i) => (
        <div
          key={`separator-${i}`}
          className="absolute left-0 w-full h-[1px] border-t border-dashed border-[#A594F9]/30 dark:border-[#3e2fd9]/30 pointer-events-none"
          style={{ top: `${72 + i * 36}px` }}
        />
      ))}

      <div
        className="absolute top-0 h-full z-40 pointer-events-none"
        style={{
          left: `${0 + currentPosition - scrollLeft}px`,
        }}
      >
        <div
          className="sticky top-0 left-1/2 -translate-x-1/2 z-50
               w-0 h-0
               border-l-[9px] border-r-[9px] border-t-[9px]
               border-l-transparent border-r-transparent border-t-green-500"
        />

        <div className="w-0.5 h-full bg-green-500 mx-auto" />
      </div>

      {segments.map((segment, idx) => (
        <TrimSegmentBlock
          key={`segment-${idx}`}
          segment={segment}
          idx={idx}
          activeSegment={activeSegment}
          minValue={minValue}
          maxValue={maxValue}
          zoomedTimelineWidth={zoomedTimelineWidth}
          switchToTrimMode={switchToTrimMode}
          playTrimSegment={playTrimSegment}
          setDragState={setDragState}
          trackIdx={trackIndices[`trim-${idx}`] ?? 0}
        />
      ))}
      {zoomSegments.map((segment: ZoomEffect, idx) => (
        <ZoomSegmentBlock
          key={`segment-${idx}`}
          segment={segment}
          idx={idx}
          activeZoomIdx={activeZoomIdx}
          minValue={minValue}
          maxValue={maxValue}
          zoomedTimelineWidth={zoomedTimelineWidth}
          playZoomSegment={playZoomSegment}
          setDragZoomState={setDragZoomState}
          trackIdx={trackIndices[`zoom-${idx}`] ?? 0}
        />
      ))}

      {textOverlays.map((overlay, idx) => (
        <TextOverlayBlock
          key={`text-${overlay.id}`}
          overlay={overlay}
          idx={idx}
          selectedTextOverlayId={selectedTextOverlayId}
          minValue={minValue}
          maxValue={maxValue}
          zoomedTimelineWidth={zoomedTimelineWidth}
          setMode={setMode}
          setSelectedTextOverlayId={setSelectedTextOverlayId}
          setTextOverlayInspectorValues={setTextOverlayInspectorValues}
          updateCurrentTimeFromMouse={updateCurrentTimeFromMouse}
          setPlaying={setPlaying}
          setDragTextState={setDragTextState}
          trackIdx={trackIndices[`text-${overlay.id}`] ?? 0}
        />
      ))}
    </>
  );
}

export function TimelineTrack(props: TimelineTrackProps) {
  const {
    baseTimelineWidth,
    zoomLevel,
    zoomedTimelineWidth,
    setScrollLeft,
    scrollContainerRef,
    rulerRef,
    isDraggingTimelineRef,
    setPlaying,
    setDraggingCurrentTime,
    updateCurrentTimeFromMouse,
    switchToNonTrimMode,
    minValue,
    maxValue,
    setActiveSegment,
    segments,
    setSegments,
    zoomSegments,
    setZoomSegments,
    textOverlays,
    setTextOverlays,
    trackIndices,
    setTrackIndices,
  } = props;

  const { draggingScissor, setDraggingScissor, setScissorPreview } = useScissorDrag({
    rulerRef,
    minValue,
    maxValue,
    segments,
    setSegments,
    setActiveSegment,
  });

  const { setDragState } = useSegmentDrag({
    minValue,
    maxValue,
    zoomedTimelineWidth,
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  });

  const { setDragZoomState } = useZoomSegmentDrag({
    minValue,
    maxValue,
    zoomedTimelineWidth,
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  });

  const { setDragTextState } = useTextOverlayDrag({
    minValue,
    maxValue,
    zoomedTimelineWidth,
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  });

  const maxTrackIdx = Object.values(trackIndices || {}).reduce((max, val) => Math.max(max, val), 2);
  const totalTracks = maxTrackIdx + 2;

  return (
    <div className="track-stream-container max-w-[1379px] h-[173px]">
      <div className=" flex items-center justify-center bg-transparent" style={{ height: "100%" }}>
        <SliceHandle
          side="left"
          onMouseDown={() => {
            setDraggingScissor("left");
            setScissorPreview(null);
          }}
        />

        <div className="h-full overflow-hidden w-full">
          <div
            ref={scrollContainerRef}
            className={` w-full h-full overflow-y-auto ${
              zoomLevel > 1 ? "overflow-x-auto" : "overflow-x-hidden"
            }`}
            onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          >
            <div
              ref={rulerRef}
              className="relative bg-white dark:bg-[#0a081a] border-y border-[#A594F9] dark:border-[#3e2fd9]/50 cursor-pointer track-layers-row"
              style={{
                width: `${baseTimelineWidth * zoomLevel}px`,
                minWidth: `${baseTimelineWidth}px`,
                height: `${38 + totalTracks * 36 + 10}px`,
                boxSizing: "border-box",
              }}
              onMouseDown={(e) => {
                if (!draggingScissor) {
                  isDraggingTimelineRef.current = true;
                  setPlaying(false);
                  setDraggingCurrentTime(true);
                  updateCurrentTimeFromMouse(e);

                  switchToNonTrimMode();
                }
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('[class*="segment"]')) {
                  switchToNonTrimMode();
                }
              }}
            >
              <RulerLayers
                {...props}
                setDragState={setDragState}
                setDragZoomState={setDragZoomState}
                setDragTextState={setDragTextState}
              />
            </div>
          </div>
        </div>

        <SliceHandle
          side="right"
          onMouseDown={() => {
            setDraggingScissor("right");
            setScissorPreview(null);
          }}
        />
      </div>
    </div>
  );
}
