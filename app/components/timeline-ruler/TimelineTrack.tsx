import React from "react";
import Image from "next/image";
import Linepage, { TIMELINE_RULER_HEIGHT } from "../Linepage";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { DragState, DragZoomState, DragTextState, DragAudioState, TextOverlayItem } from "./types";
import { AudioClipDto } from "../../types/audio";
import { ClipPlacement, useAudioClipStore } from "../../store/audioClipStore";
import {
  TrimSegmentBlock,
  ZoomSegmentBlock,
  TextOverlayBlock,
  AudioClipBlock,
} from "./TimelineBlocks";
import {
  useScissorDrag,
  useSegmentDrag,
  useZoomSegmentDrag,
  useTextOverlayDrag,
  useAudioClipDrag,
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
  audioClips?: AudioClipDto[];
  trackIndices: Record<string, number>;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
};

type DragSetters = {
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  setDragZoomState: React.Dispatch<React.SetStateAction<DragZoomState | null>>;
  setDragTextState: React.Dispatch<React.SetStateAction<DragTextState | null>>;
  setDragAudioState: React.Dispatch<React.SetStateAction<DragAudioState | null>>;
};

type AudioEditProps = {
  placements: Record<string, ClipPlacement>;
  selectedAudioClipId: string | null;
  onSelectAudioClip: (clipId: string | null) => void;
};

function RulerLayers(props: TimelineTrackProps & DragSetters & AudioEditProps) {
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
    audioClips,
    trackIndices,
    setDragAudioState,
    placements,
    selectedAudioClipId,
    onSelectAudioClip,
  } = props;

  const maxTrackIdx = Object.values(trackIndices || {}).reduce((max, val) => Math.max(max, val), 2);
  // Audio clips get dedicated lanes below every editable track.
  const audioBaseTrackIdx = maxTrackIdx + 1;
  const totalTracks = maxTrackIdx + 2 + (audioClips?.length ?? 0);

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
          style={{ top: `${TIMELINE_RULER_HEIGHT + 34 + i * 36}px` }}
        />
      ))}

      {/* Zero-width so the arrow and line both anchor to the exact playhead x */}
      <div
        className="absolute top-0 h-full w-0 z-40 pointer-events-none"
        style={{
          left: `${0 + currentPosition - scrollLeft}px`,
        }}
      >
        <div
          className="sticky top-0 -translate-x-1/2 z-50
               w-0 h-0
               border-l-[9px] border-r-[9px] border-t-[9px]
               border-l-transparent border-r-transparent border-t-green-500"
        />

        <div className="absolute top-0 left-0 h-full w-0.5 bg-green-500 -translate-x-1/2" />
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

      {(audioClips ?? []).map((clip, idx) => (
        <AudioClipBlock
          key={`audio-${clip.id}`}
          clip={clip}
          idx={idx}
          minValue={minValue}
          maxValue={maxValue}
          zoomedTimelineWidth={zoomedTimelineWidth}
          trackIdx={audioBaseTrackIdx + idx}
          placements={placements}
          selected={selectedAudioClipId === clip.id}
          onSelect={onSelectAudioClip}
          setDragAudioState={setDragAudioState}
        />
      ))}
    </>
  );
}

/** Placement + selection state for the audio lanes, kept out of TimelineTrack. */
function useAudioClipEditing({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  audioClips,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  audioClips?: AudioClipDto[];
}) {
  const placements = useAudioClipStore((s) => s.placements);
  const setClipPlacement = useAudioClipStore((s) => s.setClipPlacement);
  const selectedAudioClipId = useAudioClipStore((s) => s.selectedTimelineClipId);
  const selectTimelineClip = useAudioClipStore((s) => s.selectTimelineClip);

  const { setDragAudioState } = useAudioClipDrag({
    minValue,
    maxValue,
    zoomedTimelineWidth,
    audioClips: audioClips ?? [],
    placements,
    setClipPlacement,
  });

  return {
    placements,
    selectedAudioClipId,
    setSelectedAudioClipId: selectTimelineClip,
    setDragAudioState,
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
    setActiveSegment,
    segments,
    setSegments,
    zoomSegments,
    setZoomSegments,
    textOverlays,
    setTextOverlays,
    audioClips,
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

  const { placements, selectedAudioClipId, setSelectedAudioClipId, setDragAudioState } =
    useAudioClipEditing({ minValue, maxValue, zoomedTimelineWidth, audioClips });

  const maxTrackIdx = Object.values(trackIndices || {}).reduce((max, val) => Math.max(max, val), 2);
  const totalTracks = maxTrackIdx + 2 + (audioClips?.length ?? 0);
  // Grow the stream area with the lane count so every lane (incl. audio) is
  // visible without vertical scrolling; matches the rulerRef height formula.
  const timelineHeight = TIMELINE_RULER_HEIGHT + totalTracks * 36 + 10;

  return (
    <div className="track-stream-container max-w-[1379px]">
      <div
        className=" flex items-center justify-center bg-transparent"
        style={{ height: timelineHeight }}
      >
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
                height: `${TIMELINE_RULER_HEIGHT + totalTracks * 36 + 10}px`,
                boxSizing: "border-box",
              }}
              onMouseDown={(e) => {
                if (!draggingScissor) {
                  isDraggingTimelineRef.current = true;
                  setPlaying(false);
                  setDraggingCurrentTime(true);
                  updateCurrentTimeFromMouse(e);

                  switchToNonTrimMode();
                  setSelectedAudioClipId(null);
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
                setDragAudioState={setDragAudioState}
                placements={placements}
                selectedAudioClipId={selectedAudioClipId}
                onSelectAudioClip={setSelectedAudioClipId}
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
