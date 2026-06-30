import { useRef, useState, useEffect } from "react";
import { TimelineRulerProps, TextOverlayItem } from "./types";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import {
  usePlayhead,
  useTimelineZoom,
  useTrimSelection,
  useTimelineHistory,
  useTimelineProgress,
} from "./useTimelineCore";
import { useHandleDrag } from "./useTimelineDrags";
import { useTrimActions, useZoomActions } from "./useTimelineActions";

export interface TimelineBlock {
  id: string;
  type: "trim" | "zoom" | "text";
  index: number;
  originalId?: string;
  start: number;
  end: number;
  track: number;
}

export function getAllBlocks(
  segs: { start: number; end: number }[],
  zooms: ZoomEffect[],
  texts: TextOverlayItem[],
  tracks: Record<string, number>
): TimelineBlock[] {
  const list: TimelineBlock[] = [];
  segs.forEach((s, idx) => {
    const id = `trim-${idx}`;
    list.push({
      id,
      type: "trim",
      index: idx,
      start: s.start,
      end: s.end,
      track: tracks[id] ?? 0,
    });
  });
  zooms.forEach((z, idx) => {
    const id = `zoom-${idx}`;
    list.push({
      id,
      type: "zoom",
      index: idx,
      start: z.startTime,
      end: z.endTime,
      track: tracks[id] ?? 0,
    });
  });
  texts.forEach((t) => {
    const id = `text-${t.id}`;
    list.push({
      id,
      type: "text",
      index: -1,
      originalId: t.id,
      start: t.startTime,
      end: t.endTime,
      track: tracks[id] ?? 0,
    });
  });
  return list;
}

export function resolveTracks(
  segs: { start: number; end: number }[],
  zooms: ZoomEffect[],
  texts: TextOverlayItem[],
  currentTracks: Record<string, number>
): Record<string, number> {
  const resolved: Record<string, number> = { ...currentTracks };
  const allBlocks = getAllBlocks(segs, zooms, texts, resolved);
  const sortedBlocks = [...allBlocks].sort((a, b) => a.start - b.start);
  const trackPlacements: Record<number, TimelineBlock[]> = {};

  sortedBlocks.forEach((block) => {
    let track = resolved[block.id];
    let hasCollision = false;
    if (track !== undefined) {
      const placedOnTrack = trackPlacements[track] || [];
      hasCollision = placedOnTrack.some(
        (placed) => block.start < placed.end - 0.001 && placed.start < block.end - 0.001
      );
    }

    if (track === undefined || hasCollision) {
      track = 0;
      while (true) {
        const placedOnTrack = trackPlacements[track] || [];
        const collides = placedOnTrack.some(
          (placed) => block.start < placed.end - 0.001 && placed.start < block.end - 0.001
        );
        if (!collides) {
          break;
        }
        track++;
      }
    }

    if (!trackPlacements[track]) {
      trackPlacements[track] = [];
    }
    trackPlacements[track].push(block);
    resolved[block.id] = track;
  });

  return resolved;
}

function useTimelineRulerState(props: TimelineRulerProps) {
  const {
    minValue = 0.05,
    maxValue = 1.0,
    currentValue = 0.07,
    onValueChange,
    step = 0.002,
    startTime,
    endTime,
    onStartTimeChange,
    onEndTimeChange,
    processing = false,
    setPlaying,
    mode,
    playerRef,
    setChildHandleProgress,
    zoomSegments,
    segments,
    setSegments,
    setZoomSegments,
    textOverlays,
    isDraggingTimelineRef,
  } = props;

  const [trackIndices, setTrackIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    setTrackIndices((prev) => {
      const next = resolveTracks(segments, zoomSegments, textOverlays, prev);
      const changed =
        Object.keys(next).some((k) => next[k] !== prev[k]) ||
        Object.keys(prev).some((k) => next[k] !== prev[k]);
      return changed ? next : prev;
    });
  }, [segments, zoomSegments, textOverlays]);

  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [baseTimelineWidth, setBaseTimelineWidth] = useState(956);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setBaseTimelineWidth(el.clientWidth);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const { zoomLevel, setZoomLevel, scrollLeft, setScrollLeft } = useTimelineZoom({
    rulerRef,
    scrollContainerRef,
    baseTimelineWidth,
  });
  const zoomedTimelineWidth = baseTimelineWidth * zoomLevel;

  const {
    localValue,
    setLocalValue,
    lastSeekTimeRef,
    updateCurrentTimeFromMouse,
    setDraggingCurrentTime,
  } = usePlayhead({
    rulerRef,
    minValue,
    maxValue,
    currentValue,
    onValueChange,
    playerRef,
    setPlaying,
    isDraggingTimelineRef,
  });

  const {
    localStartTime,
    setLocalStartTime,
    localEndTime,
    setLocalEndTime,
    activeSegment,
    setActiveSegment,
    switchToTrimMode,
    switchToNonTrimMode,
  } = useTrimSelection({ segments, startTime, endTime, minValue, maxValue, setLocalValue });

  const { undoStack, redoStack, pushAction, handleUndo, handleRedo } = useTimelineHistory({
    segments,
    setSegments,
    setZoomSegments,
    switchToNonTrimMode,
  });

  useHandleDrag({
    rulerRef,
    minValue,
    maxValue,
    step,
    localStartTime,
    localEndTime,
    segments,
    activeSegment,
    setSegments,
    setLocalStartTime,
    setLocalEndTime,
    setLocalValue,
    onStartTimeChange,
    onEndTimeChange,
  });

  useTimelineProgress({
    playerRef,
    mode,
    segments,
    activeSegment,
    isDraggingTimelineRef,
    setChildHandleProgress,
    lastSeekTimeRef,
  });

  const hasBeenTrimmed =
    segments.length > 1 ||
    (segments.length === 1 &&
      (Math.abs(segments[0].start - minValue) > 0.001 ||
        Math.abs(segments[0].end - maxValue) > 0.001));
  const hasTimelineEdits = hasBeenTrimmed || zoomSegments.length > 0;
  const currentPosition = ((localValue - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;

  return {
    rulerRef,
    scrollContainerRef,
    baseTimelineWidth,
    zoomLevel,
    setZoomLevel,
    scrollLeft,
    setScrollLeft,
    zoomedTimelineWidth,
    localValue,
    updateCurrentTimeFromMouse,
    setDraggingCurrentTime,
    setLocalStartTime,
    setLocalEndTime,
    activeSegment,
    setActiveSegment,
    switchToTrimMode,
    switchToNonTrimMode,
    undoStack,
    redoStack,
    pushAction,
    handleUndo,
    handleRedo,
    hasTimelineEdits,
    currentPosition,
    minValue,
    maxValue,
    processing,
    trackIndices,
    setTrackIndices,
  };
}

function useTimelineRulerActions(
  props: TimelineRulerProps,
  state: ReturnType<typeof useTimelineRulerState>
) {
  const {
    segments,
    setSegments,
    setTextOverlays,
    setSelectedTextOverlayId,
    setMode,
    setActiveZoomIdx,
    playerRef,
    setPlaying,
    zoomSegments,
    setZoomSegments,
    zoomLevelDepth,
  } = props;
  const {
    activeSegment,
    setActiveSegment,
    setLocalStartTime,
    setLocalEndTime,
    switchToNonTrimMode,
    localValue,
    updateCurrentTimeFromMouse,
    pushAction,
    minValue,
    maxValue,
  } = state;

  const { removeSegment, removeTextOverlay, handleSmartTrim, playTrimSegment } = useTrimActions({
    segments,
    setSegments,
    activeSegment,
    setActiveSegment,
    setLocalStartTime,
    setLocalEndTime,
    switchToNonTrimMode,
    setTextOverlays,
    setSelectedTextOverlayId,
    setMode,
    setActiveZoomIdx,
    localValue,
    minValue,
    maxValue,
    playerRef,
    setPlaying,
    updateCurrentTimeFromMouse,
    pushAction,
  });

  const { removeZoomSegment, playZoomSegment, handleZoomClick } = useZoomActions({
    zoomSegments,
    setZoomSegments,
    setActiveZoomIdx,
    setActiveSegment,
    setMode,
    localValue,
    maxValue,
    zoomLevelDepth,
    setLocalStartTime,
    setLocalEndTime,
    playerRef,
    setPlaying,
    updateCurrentTimeFromMouse,
    pushAction,
  });

  return {
    removeSegment,
    removeTextOverlay,
    handleSmartTrim,
    playTrimSegment,
    removeZoomSegment,
    playZoomSegment,
    handleZoomClick,
  };
}

export function useTimelineRuler(props: TimelineRulerProps) {
  const state = useTimelineRulerState(props);
  const actions = useTimelineRulerActions(props, state);
  return { ...state, ...actions };
}

export type TimelineRulerVm = ReturnType<typeof useTimelineRuler>;
