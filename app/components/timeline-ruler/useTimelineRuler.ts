import { useRef } from "react";
import { TimelineRulerProps } from "./types";
import {
  usePlayhead,
  useTimelineZoom,
  useTrimSelection,
  useTimelineHistory,
  useTimelineProgress,
} from "./useTimelineCore";
import { useHandleDrag } from "./useTimelineDrags";
import { useTrimActions, useZoomActions } from "./useTimelineActions";

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
    isDraggingTimelineRef,
  } = props;

  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const baseTimelineWidth = 956;

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
