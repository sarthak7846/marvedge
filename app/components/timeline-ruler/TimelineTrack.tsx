import React from "react";
import Image from "next/image";
import Linepage from "../Linepage";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { DragState, DragZoomState, DragTextState, TextOverlayItem } from "./types";
import {
  TrimSegmentBlock,
  ZoomSegmentBlock,
  TextOverlayBlock,
  SubtitleCueBlock,
  SubtitleClusterBlock,
} from "./TimelineBlocks";
import {
  useScissorDrag,
  useSegmentDrag,
  useZoomSegmentDrag,
  useTextOverlayDrag,
} from "./useTimelineDrags";
import { useSubtitleTrack, type SubtitleTrackVm } from "./useSubtitleTrack";

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
  // Both of these already reach this component through the spread in
  // TimelineRulerView; the subtitle track is the first consumer to need them by
  // name. `setZoomLevel` drives the zoom-into-a-cluster affordance and
  // `onValueChange` is the ruler's own seek channel.
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  onValueChange?: (value: number) => void;
  /** Playhead in seconds — `currentPosition` is the same thing in pixels. */
  localValue: number;
};

type DragSetters = {
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  setDragZoomState: React.Dispatch<React.SetStateAction<DragZoomState | null>>;
  setDragTextState: React.Dispatch<React.SetStateAction<DragTextState | null>>;
};

type SubtitleLayer = {
  subtitleTrack: SubtitleTrackVm;
  /** Lane the subtitle blocks sit on, just below whatever else is in use. */
  subtitleTrackIdx: number;
};

function RulerLayers(props: TimelineTrackProps & DragSetters & SubtitleLayer) {
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
    subtitleTrack,
    subtitleTrackIdx,
  } = props;

  const usedTrackCount = Object.keys(trackIndices || {}).length;
  const highestUsedTrackIdx = Object.values(trackIndices || {}).reduce(
    (max, val) => Math.max(max, val),
    -1
  );
  const separatorCount = usedTrackCount > 0 ? highestUsedTrackIdx + 1 : 0;

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
      {Array.from({ length: separatorCount }).map((_, i) => (
        <div
          key={`separator-${i}`}
          className="absolute left-0 w-full h-[1px] border-t border-dashed border-[#A594F9]/30 dark:border-[#3e2fd9]/30 pointer-events-none"
          style={{ top: `${72 + i * 36}px` }}
        />
      ))}

      <div
        className="absolute top-0 h-full z-40 pointer-events-none flex flex-col items-center"
        style={{
          left: `${0 + currentPosition - scrollLeft}px`,
          width: "18px",
          marginLeft: "-9px", // center the 18px-wide marker on the exact time position
        }}
      >
        <div
          className="z-50 w-0 h-0
                border-l-[9px] border-r-[9px] border-t-[9px]
                border-l-transparent border-r-transparent border-t-green-500"
        />

        <div className="w-0.5 h-full bg-green-500" />
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

      {/* Subtitle track (SUB-6.4). Rendered last so a cue block sits above the
          lane separators, and only when there are cues and the editor flag is
          on — otherwise the ruler is exactly what it is today. */}
      {subtitleTrack.visible &&
        subtitleTrack.items.map((item) =>
          item.kind === "cue" ? (
            <SubtitleCueBlock
              key={`subtitle-${item.index}`}
              item={item}
              isSelected={item.index === subtitleTrack.selectedCueIndex}
              isDragging={item.index === subtitleTrack.draggingIndex}
              trackIdx={subtitleTrackIdx}
              onSelect={subtitleTrack.selectCueAt}
              setDragSubtitleState={subtitleTrack.setDragSubtitleState}
            />
          ) : (
            <SubtitleClusterBlock
              key={`subtitle-cluster-${item.fromIndex}`}
              item={item}
              trackIdx={subtitleTrackIdx}
              onFocus={subtitleTrack.focusCluster}
            />
          )
        )}
    </>
  );
}

/**
 * The trim / zoom / text drag hooks, which every block on the ruler shares.
 *
 * Lifted out of `TimelineTrack` verbatim: four hook calls taking nearly the same
 * dozen arguments made the component read as plumbing. Subtitles are wired up
 * separately, in `useSubtitleTrack` — see the note on `useSubtitleCueDrag` for
 * why they do not go through this machinery.
 */
function useBlockDrags(props: TimelineTrackProps) {
  const {
    minValue,
    maxValue,
    zoomedTimelineWidth,
    rulerRef,
    segments,
    setSegments,
    setActiveSegment,
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

  const shared = {
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
  };

  const { setDragState } = useSegmentDrag(shared);
  const { setDragZoomState } = useZoomSegmentDrag(shared);
  const { setDragTextState } = useTextOverlayDrag(shared);

  return {
    draggingScissor,
    setDraggingScissor,
    setScissorPreview,
    setDragState,
    setDragZoomState,
    setDragTextState,
  };
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
    trackIndices,
    setZoomLevel,
    scrollLeft,
    localValue,
    onValueChange,
  } = props;

  const { draggingScissor, setDraggingScissor, setScissorPreview, ...dragSetters } =
    useBlockDrags(props);

  const subtitleTrack = useSubtitleTrack({
    minValue,
    maxValue,
    baseTimelineWidth,
    zoomedTimelineWidth,
    zoomLevel,
    setZoomLevel,
    scrollLeft,
    setScrollLeft,
    scrollContainerRef,
    playheadSeconds: localValue,
    onValueChange,
  });

  const maxTrackIdx = Object.values(trackIndices || {}).reduce((max, val) => Math.max(max, val), 2);

  // Subtitles get a lane of their own, immediately below whatever trim / zoom /
  // text blocks are actually in use — not a lane out of the pool `resolveTracks`
  // assigns from, since 150 back-to-back cues would fight every other block for
  // it. With nothing else on the ruler that is lane 0, and the height below is
  // unchanged from today in every case where a spare lane already existed.
  const highestUsedTrackIdx = Object.values(trackIndices || {}).reduce(
    (max, val) => Math.max(max, val),
    -1
  );
  const subtitleTrackIdx = highestUsedTrackIdx + 1;
  const totalTracks = subtitleTrack.visible
    ? Math.max(maxTrackIdx + 2, subtitleTrackIdx + 2)
    : maxTrackIdx + 2;

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
                if (!target.closest(".subtitle-cue-block, .subtitle-cue-cluster")) {
                  subtitleTrack.clearSelection();
                }
              }}
            >
              <RulerLayers
                {...props}
                {...dragSetters}
                subtitleTrack={subtitleTrack}
                subtitleTrackIdx={subtitleTrackIdx}
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
