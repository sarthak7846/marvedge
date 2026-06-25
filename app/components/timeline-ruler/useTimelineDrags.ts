import React, { useState, useEffect, useCallback } from "react";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { DragState, DragZoomState, DragTextState, TextOverlayItem } from "./types";

type TrimSegment = { start: number; end: number };
type NumberSetter = React.Dispatch<React.SetStateAction<number>>;
type SegmentsSetter = React.Dispatch<React.SetStateAction<TrimSegment[]>>;

export function useScissorDrag({
  rulerRef,
  minValue,
  maxValue,
  segments,
  setSegments,
  setActiveSegment,
}: {
  rulerRef: React.RefObject<HTMLDivElement | null>;
  minValue: number;
  maxValue: number;
  segments: TrimSegment[];
  setSegments: SegmentsSetter;
  setActiveSegment: NumberSetter;
}) {
  const [draggingScissor, setDraggingScissor] = useState<"left" | "right" | null>(null);
  const [scissorPreview, setScissorPreview] = useState<number | null>(null);

  useEffect(() => {
    if (!draggingScissor) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      if (!rulerRef.current) {
        return;
      }
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(1, x / width));
      const value = minValue + (maxValue - minValue) * percentage;
      setScissorPreview(value);
    };
    const onUp = () => {
      if (scissorPreview !== null) {
        if (draggingScissor === "left" && scissorPreview > minValue && scissorPreview < maxValue) {
          setSegments((prev) => [...prev, { start: minValue, end: scissorPreview }]);
          setActiveSegment(segments.length);
        } else if (
          draggingScissor === "right" &&
          scissorPreview > minValue &&
          scissorPreview < maxValue
        ) {
          setSegments((prev) => [...prev, { start: scissorPreview, end: maxValue }]);
          setActiveSegment(segments.length);
        }
      }
      setDraggingScissor(null);
      setScissorPreview(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    draggingScissor,
    scissorPreview,
    minValue,
    maxValue,
    segments.length,
    setSegments,
    setActiveSegment,
    rulerRef,
  ]);

  return { draggingScissor, setDraggingScissor, scissorPreview, setScissorPreview };
}

export function useSegmentDrag({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setSegments,
  getTrackIndex,
  setTrackIndices,
  trackIndicesRef,
  segmentsRef,
  getAllBlocksFromRefs,
  updateAllSegmentStates,
  resolveLaneCollisions,
  resolveEdgeResizeCollisions,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setSegments: SegmentsSetter;
  getTrackIndex: (itemId: string, type: "trim" | "zoom" | "text") => number;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  trackIndicesRef: React.MutableRefObject<Record<string, number>>;
  segmentsRef: React.MutableRefObject<TrimSegment[]>;
  getAllBlocksFromRefs: (excludeId?: string) => any[];
  updateAllSegmentStates: (updatedPositions: Record<string, { start: number; end: number }>) => void;
  resolveLaneCollisions: (
    draggedId: string,
    newStart: number,
    newEnd: number,
    newTrackIdx: number,
    originalStart: number,
    originalTrack: number
  ) => Record<string, { start: number; end: number }>;
  resolveEdgeResizeCollisions: (
    draggedId: string,
    side: "left" | "right",
    newValue: number,
    originalStart: number,
    originalEnd: number,
    originalTrack: number
  ) => Record<string, { start: number; end: number }>;
}) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const pixelsPerUnit = zoomedTimelineWidth / (maxValue - minValue);
      const deltaValue = deltaX / pixelsPerUnit;
      const draggedId = `trim-${dragState.index}`;

      if (dragState.mode === "segment") {
        const deltaY = e.clientY - dragState.startY;
        const deltaTrack = Math.round(deltaY / 38);
        let newTrackIdx = Math.max(0, dragState.startTrackIndex + deltaTrack);

        const draggedWidth = dragState.endValue - dragState.startValue;
        const laneItems = getAllBlocksFromRefs(draggedId).filter((b) => {
          return b.track === newTrackIdx;
        });
        const laneWidth = laneItems.reduce((sum, b) => {
          return sum + b.width;
        }, 0);

        if (laneWidth + draggedWidth > maxValue - minValue) {
          const currentTrack =
            trackIndicesRef.current[draggedId] !== undefined
              ? trackIndicesRef.current[draggedId]
              : dragState.startTrackIndex;
          newTrackIdx = currentTrack;
        }

        setTrackIndices((prev) => {
          if (prev[draggedId] === newTrackIdx) {
            return prev;
          }
          return {
            ...prev,
            [draggedId]: newTrackIdx,
          };
        });
        trackIndicesRef.current[draggedId] = newTrackIdx;

        const newStart = dragState.startValue + deltaValue;
        const newEnd = dragState.endValue + deltaValue;

        const updatedPositions = resolveLaneCollisions(
          draggedId,
          newStart,
          newEnd,
          newTrackIdx,
          dragState.startValue,
          dragState.startTrackIndex
        );

        updateAllSegmentStates(updatedPositions);
      }

      if (dragState.mode === "edge") {
        const proposedValue = dragState.startValue + deltaValue;
        const seg = segmentsRef.current[dragState.index];
        if (seg) {
          const originalStart = seg.start;
          const originalEnd = seg.end;
          const originalTrack = getTrackIndex(draggedId, "trim");

          const updatedPositions = resolveEdgeResizeCollisions(
            draggedId,
            dragState.side,
            proposedValue,
            originalStart,
            originalEnd,
            originalTrack
          );

          updateAllSegmentStates(updatedPositions);
        }
      }
    };

    const onUp = () => setDragState(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    dragState,
    maxValue,
    minValue,
    zoomedTimelineWidth,
    getTrackIndex,
    resolveEdgeResizeCollisions,
    resolveLaneCollisions,
    updateAllSegmentStates,
    getAllBlocksFromRefs,
    setTrackIndices,
    trackIndicesRef,
    segmentsRef,
  ]);

  return { dragState, setDragState };
}

export function useZoomSegmentDrag({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setZoomSegments,
  getTrackIndex,
  setTrackIndices,
  trackIndicesRef,
  zoomSegmentsRef,
  getAllBlocksFromRefs,
  updateAllSegmentStates,
  resolveLaneCollisions,
  resolveEdgeResizeCollisions,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  getTrackIndex: (itemId: string, type: "trim" | "zoom" | "text") => number;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  trackIndicesRef: React.MutableRefObject<Record<string, number>>;
  zoomSegmentsRef: React.MutableRefObject<ZoomEffect[]>;
  getAllBlocksFromRefs: (excludeId?: string) => any[];
  updateAllSegmentStates: (updatedPositions: Record<string, { start: number; end: number }>) => void;
  resolveLaneCollisions: (
    draggedId: string,
    newStart: number,
    newEnd: number,
    newTrackIdx: number,
    originalStart: number,
    originalTrack: number
  ) => Record<string, { start: number; end: number }>;
  resolveEdgeResizeCollisions: (
    draggedId: string,
    side: "left" | "right",
    newValue: number,
    originalStart: number,
    originalEnd: number,
    originalTrack: number
  ) => Record<string, { start: number; end: number }>;
}) {
  const [dragZoomState, setDragZoomState] = useState<DragZoomState | null>(null);

  useEffect(() => {
    if (!dragZoomState) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragZoomState.startX;
      const pixelsPerUnit = zoomedTimelineWidth / (maxValue - minValue);
      const deltaValue = deltaX / pixelsPerUnit;
      const draggedId = `zoom-${dragZoomState.index}`;

      if (dragZoomState.mode === "segment") {
        const deltaY = e.clientY - dragZoomState.startY;
        const deltaTrack = Math.round(deltaY / 38);
        let newTrackIdx = Math.max(0, dragZoomState.startTrackIndex + deltaTrack);

        const draggedWidth = dragZoomState.endValue - dragZoomState.startValue;
        const laneItems = getAllBlocksFromRefs(draggedId).filter((b) => {
          return b.track === newTrackIdx;
        });
        const laneWidth = laneItems.reduce((sum, b) => {
          return sum + b.width;
        }, 0);

        if (laneWidth + draggedWidth > maxValue - minValue) {
          const currentTrack =
            trackIndicesRef.current[draggedId] !== undefined
              ? trackIndicesRef.current[draggedId]
              : dragZoomState.startTrackIndex;
          newTrackIdx = currentTrack;
        }

        setTrackIndices((prev) => {
          if (prev[draggedId] === newTrackIdx) {
            return prev;
          }
          return {
            ...prev,
            [draggedId]: newTrackIdx,
          };
        });
        trackIndicesRef.current[draggedId] = newTrackIdx;

        const newStart = dragZoomState.startValue + deltaValue;
        const newEnd = dragZoomState.endValue + deltaValue;

        const updatedPositions = resolveLaneCollisions(
          draggedId,
          newStart,
          newEnd,
          newTrackIdx,
          dragZoomState.startValue,
          dragZoomState.startTrackIndex
        );

        updateAllSegmentStates(updatedPositions);
      }

      if (dragZoomState.mode === "edge") {
        const proposedValue = dragZoomState.startValue + deltaValue;
        const seg = zoomSegmentsRef.current[dragZoomState.index];
        if (seg) {
          const originalStart = seg.startTime;
          const originalEnd = seg.endTime;
          const originalTrack = getTrackIndex(draggedId, "zoom");

          const updatedPositions = resolveEdgeResizeCollisions(
            draggedId,
            dragZoomState.side,
            proposedValue,
            originalStart,
            originalEnd,
            originalTrack
          );

          updateAllSegmentStates(updatedPositions);
        }
      }
    };

    const onUp = () => setDragZoomState(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    dragZoomState,
    maxValue,
    minValue,
    zoomedTimelineWidth,
    getTrackIndex,
    resolveEdgeResizeCollisions,
    resolveLaneCollisions,
    updateAllSegmentStates,
    getAllBlocksFromRefs,
    setTrackIndices,
    trackIndicesRef,
    zoomSegmentsRef,
  ]);

  return { dragZoomState, setDragZoomState };
}

export function useTextOverlayDrag({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setTextOverlays,
  getTrackIndex,
  setTrackIndices,
  trackIndicesRef,
  textOverlaysRef,
  getAllBlocksFromRefs,
  updateAllSegmentStates,
  resolveLaneCollisions,
  resolveEdgeResizeCollisions,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  getTrackIndex: (itemId: string, type: "trim" | "zoom" | "text") => number;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  trackIndicesRef: React.MutableRefObject<Record<string, number>>;
  textOverlaysRef: React.MutableRefObject<TextOverlayItem[]>;
  getAllBlocksFromRefs: (excludeId?: string) => any[];
  updateAllSegmentStates: (updatedPositions: Record<string, { start: number; end: number }>) => void;
  resolveLaneCollisions: (
    draggedId: string,
    newStart: number,
    newEnd: number,
    newTrackIdx: number,
    originalStart: number,
    originalTrack: number
  ) => Record<string, { start: number; end: number }>;
  resolveEdgeResizeCollisions: (
    draggedId: string,
    side: "left" | "right",
    newValue: number,
    originalStart: number,
    originalEnd: number,
    originalTrack: number
  ) => Record<string, { start: number; end: number }>;
}) {
  const [dragTextState, setDragTextState] = useState<DragTextState | null>(null);

  useEffect(() => {
    if (!dragTextState) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragTextState.startX;
      const pixelsPerUnit = zoomedTimelineWidth / (maxValue - minValue);
      const deltaValue = deltaX / pixelsPerUnit;
      const draggedId = `text-${dragTextState.id}`;

      if (dragTextState.mode === "segment") {
        const deltaY = e.clientY - dragTextState.startY;
        const deltaTrack = Math.round(deltaY / 38);
        let newTrackIdx = Math.max(0, dragTextState.startTrackIndex + deltaTrack);

        const draggedWidth = dragTextState.endValue - dragTextState.startValue;
        const laneItems = getAllBlocksFromRefs(draggedId).filter((b) => {
          return b.track === newTrackIdx;
        });
        const laneWidth = laneItems.reduce((sum, b) => {
          return sum + b.width;
        }, 0);

        if (laneWidth + draggedWidth > maxValue - minValue) {
          const currentTrack =
            trackIndicesRef.current[draggedId] !== undefined
              ? trackIndicesRef.current[draggedId]
              : dragTextState.startTrackIndex;
          newTrackIdx = currentTrack;
        }

        setTrackIndices((prev) => {
          if (prev[draggedId] === newTrackIdx) {
            return prev;
          }
          return {
            ...prev,
            [draggedId]: newTrackIdx,
          };
        });
        trackIndicesRef.current[draggedId] = newTrackIdx;

        const newStart = dragTextState.startValue + deltaValue;
        const newEnd = dragTextState.endValue + deltaValue;

        const updatedPositions = resolveLaneCollisions(
          draggedId,
          newStart,
          newEnd,
          newTrackIdx,
          dragTextState.startValue,
          dragTextState.startTrackIndex
        );

        updateAllSegmentStates(updatedPositions);
      }

      if (dragTextState.mode === "edge") {
        const proposedValue = dragTextState.startValue + deltaValue;
        const overlay = textOverlaysRef.current.find((t) => {
          return t.id === dragTextState.id;
        });
        if (overlay) {
          const originalStart = overlay.startTime;
          const originalEnd = overlay.endTime;
          const originalTrack = getTrackIndex(draggedId, "text");

          const updatedPositions = resolveEdgeResizeCollisions(
            draggedId,
            dragTextState.side,
            proposedValue,
            originalStart,
            originalEnd,
            originalTrack
          );

          updateAllSegmentStates(updatedPositions);
        }
      }
    };

    const onUp = () => setDragTextState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    dragTextState,
    maxValue,
    minValue,
    zoomedTimelineWidth,
    getTrackIndex,
    resolveEdgeResizeCollisions,
    resolveLaneCollisions,
    updateAllSegmentStates,
    getAllBlocksFromRefs,
    setTrackIndices,
    trackIndicesRef,
    textOverlaysRef,
  ]);

  return { dragTextState, setDragTextState };
}

export function useHandleDrag({
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
}: {
  rulerRef: React.RefObject<HTMLDivElement | null>;
  minValue: number;
  maxValue: number;
  step: number;
  localStartTime: number;
  localEndTime: number;
  segments: TrimSegment[];
  activeSegment: number;
  setSegments: SegmentsSetter;
  setLocalStartTime: NumberSetter;
  setLocalEndTime: NumberSetter;
  setLocalValue: NumberSetter;
  onStartTimeChange?: (value: number) => void;
  onEndTimeChange?: (value: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggingHandle] = useState<"current" | "start" | "end" | null>(null);
  const onStartTimeChangeRef = React.useRef(onStartTimeChange);
  const onEndTimeChangeRef = React.useRef(onEndTimeChange);

  useEffect(() => {
    onStartTimeChangeRef.current = onStartTimeChange;
  }, [onStartTimeChange]);

  useEffect(() => {
    onEndTimeChangeRef.current = onEndTimeChange;
  }, [onEndTimeChange]);

  const updateValueFromMouse = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!rulerRef.current) {
        return;
      }

      const rect = rulerRef.current.getBoundingClientRect();
      const x = (e instanceof MouseEvent ? e.clientX : e.clientX) - rect.left;
      const width = rect.width;

      const percentage = Math.max(0, Math.min(1, x / width));
      const newValue = minValue + (maxValue - minValue) * percentage;

      const snappedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(0, Math.min(maxValue, snappedValue));

      if (draggingHandle === "start") {
        const newStartTime = Math.min(clampedValue, localEndTime - step);
        setLocalStartTime(newStartTime);
        if (segments[activeSegment]) {
          const updatedSegments = [...segments];
          updatedSegments[activeSegment] = {
            ...updatedSegments[activeSegment],
            start: newStartTime,
          };
          setSegments(updatedSegments);
        }
        onStartTimeChangeRef.current?.(newStartTime);
      } else if (draggingHandle === "end") {
        const newEndTime = Math.max(clampedValue, localStartTime + step);
        setLocalEndTime(newEndTime);
        if (segments[activeSegment]) {
          const updatedSegments = [...segments];
          updatedSegments[activeSegment] = {
            ...updatedSegments[activeSegment],
            end: newEndTime,
          };
          setSegments(updatedSegments);
        }
        onEndTimeChangeRef.current?.(newEndTime);
      } else {
        setLocalValue(clampedValue);
      }
    },
    [
      minValue,
      maxValue,
      step,
      localEndTime,
      localStartTime,
      draggingHandle,
      segments,
      activeSegment,
      setSegments,
      setLocalStartTime,
      setLocalEndTime,
      setLocalValue,
      rulerRef,
    ]
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValueFromMouse(e);
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("mousemove", handleGlobalMouseMove);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isDragging, updateValueFromMouse]);
}
