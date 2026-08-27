import React, { useState, useEffect, useCallback, useRef } from "react";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import {
  DragState,
  DragSubtitleState,
  DragZoomState,
  DragTextState,
  TextOverlayItem,
} from "./types";
import { TimelineBlock, getAllBlocks } from "./useTimelineRuler";
import {
  SUBTITLE_DRAG_THRESHOLD_PX,
  SUBTITLE_SNAP_PX,
  resolveCueDrag,
  snapSecondsForZoom,
} from "./subtitleTrackLayout";
import type { SubtitleCue } from "@/app/(signed)/editor/types";

type TrimSegment = { start: number; end: number };
type NumberSetter = React.Dispatch<React.SetStateAction<number>>;
type SegmentsSetter = React.Dispatch<React.SetStateAction<TrimSegment[]>>;

interface DragContext {
  draggedId: string;
  candidateStart: number;
  candidateEnd: number;
  candidateTrack: number;
  segments: TrimSegment[];
  zoomSegments: ZoomEffect[];
  textOverlays: TextOverlayItem[];
  trackIndices: Record<string, number>;
  minValue: number;
  maxValue: number;
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export function applyTimelineUpdates(
  updates: TimelineBlock[],
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>,
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>,
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>,
  setTrackIndices?: React.Dispatch<React.SetStateAction<Record<string, number>>>
) {
  setSegments((prev) => {
    const next = [...prev];
    updates.forEach((u) => {
      if (u.type === "trim") {
        next[u.index] = { start: u.start, end: u.end };
      }
    });
    return next;
  });

  setZoomSegments((prev) => {
    const next = [...prev];
    updates.forEach((u) => {
      if (u.type === "zoom") {
        next[u.index] = { ...next[u.index], startTime: u.start, endTime: u.end };
      }
    });
    return next;
  });

  setTextOverlays((prev) => {
    const next = [...prev];
    updates.forEach((u) => {
      if (u.type === "text") {
        const idx = next.findIndex((t) => t.id === u.originalId);
        if (idx !== -1) {
          next[idx] = { ...next[idx], startTime: u.start, endTime: u.end };
        }
      }
    });
    return next;
  });

  if (setTrackIndices) {
    setTrackIndices((prev) => {
      const next = { ...prev };
      updates.forEach((u) => {
        next[u.id] = u.track;
      });
      return next;
    });
  }
}

export function handleBlockDrag(ctx: DragContext) {
  const {
    draggedId,
    candidateStart,
    candidateEnd,
    candidateTrack,
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    minValue,
    maxValue,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  } = ctx;

  const allBlocks = getAllBlocks(segments, zoomSegments, textOverlays, trackIndices);
  const draggedBlock = allBlocks.find((b) => b.id === draggedId);
  if (!draggedBlock) {
    return;
  }

  const width = draggedBlock.end - draggedBlock.start;
  const trackBlocks = allBlocks.filter((b) => b.id !== draggedId && b.track === candidateTrack);

  const rightBlocks = trackBlocks
    .filter((b) => b.start > draggedBlock.start)
    .sort((a, b) => a.start - b.start);
  const leftBlocks = trackBlocks
    .filter((b) => b.start <= draggedBlock.start)
    .sort((a, b) => b.start - a.start);

  let newStart = candidateStart;
  let newEnd = candidateEnd;

  if (newStart < minValue) {
    newStart = minValue;
    newEnd = newStart + width;
  }
  if (newEnd > maxValue) {
    newEnd = maxValue;
    newStart = Math.max(minValue, newEnd - width);
  }

  const updatedRightBlocks = rightBlocks.map((b) => ({ ...b }));
  let currentEnd = newEnd;
  for (let i = 0; i < updatedRightBlocks.length; i++) {
    const b = updatedRightBlocks[i];
    if (b.start < currentEnd) {
      const w = b.end - b.start;
      b.start = currentEnd;
      b.end = b.start + w;
    }
    currentEnd = b.end;
  }

  const updatedLeftBlocks = leftBlocks.map((b) => ({ ...b }));
  let currentStart = newStart;
  for (let i = 0; i < updatedLeftBlocks.length; i++) {
    const b = updatedLeftBlocks[i];
    if (b.end > currentStart) {
      const w = b.end - b.start;
      b.end = currentStart;
      b.start = b.end - w;
    }
    currentStart = b.start;
  }

  let isRightInvalid = false;
  if (
    updatedRightBlocks.length > 0 &&
    updatedRightBlocks[updatedRightBlocks.length - 1].end > maxValue
  ) {
    isRightInvalid = true;
  }
  let isLeftInvalid = false;
  if (
    updatedLeftBlocks.length > 0 &&
    updatedLeftBlocks[updatedLeftBlocks.length - 1].start < minValue
  ) {
    isLeftInvalid = true;
  }

  if (isRightInvalid && isLeftInvalid) {
    return;
  }

  if (isRightInvalid) {
    let limit = maxValue;
    for (let i = updatedRightBlocks.length - 1; i >= 0; i--) {
      const b = updatedRightBlocks[i];
      const w = b.end - b.start;
      b.end = limit;
      b.start = b.end - w;
      limit = b.start;
    }
    newEnd = limit;
    newStart = newEnd - width;

    let cur = newStart;
    for (let i = 0; i < updatedLeftBlocks.length; i++) {
      const b = updatedLeftBlocks[i];
      if (b.end > cur) {
        const w = b.end - b.start;
        b.end = cur;
        b.start = b.end - w;
      }
      cur = b.start;
    }
    if (newStart < minValue) {
      return;
    }
    if (
      updatedLeftBlocks.length > 0 &&
      updatedLeftBlocks[updatedLeftBlocks.length - 1].start < minValue
    ) {
      return;
    }
  } else if (isLeftInvalid) {
    let limit = minValue;
    for (let i = updatedLeftBlocks.length - 1; i >= 0; i--) {
      const b = updatedLeftBlocks[i];
      const w = b.end - b.start;
      b.start = limit;
      b.end = b.start + w;
      limit = b.end;
    }
    newStart = limit;
    newEnd = newStart + width;

    let cur = newEnd;
    for (let i = 0; i < updatedRightBlocks.length; i++) {
      const b = updatedRightBlocks[i];
      if (b.start < cur) {
        const w = b.end - b.start;
        b.start = cur;
        b.end = b.start + w;
      }
      cur = b.end;
    }
    if (newEnd > maxValue) {
      return;
    }
    if (
      updatedRightBlocks.length > 0 &&
      updatedRightBlocks[updatedRightBlocks.length - 1].end > maxValue
    ) {
      return;
    }
  }

  const updates = [
    { ...draggedBlock, start: newStart, end: newEnd, track: candidateTrack },
    ...updatedRightBlocks,
    ...updatedLeftBlocks,
  ];

  applyTimelineUpdates(updates, setSegments, setZoomSegments, setTextOverlays, setTrackIndices);
}

interface ResizeContext {
  draggedId: string;
  side: "left" | "right";
  candidateValue: number;
  segments: TrimSegment[];
  zoomSegments: ZoomEffect[];
  textOverlays: TextOverlayItem[];
  trackIndices: Record<string, number>;
  minValue: number;
  maxValue: number;
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
}

export function handleBlockResize(ctx: ResizeContext) {
  const {
    draggedId,
    side,
    candidateValue,
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    minValue,
    maxValue,
    setSegments,
    setZoomSegments,
    setTextOverlays,
  } = ctx;

  const allBlocks = getAllBlocks(segments, zoomSegments, textOverlays, trackIndices);
  const draggedBlock = allBlocks.find((b) => b.id === draggedId);
  if (!draggedBlock) {
    return;
  }

  const track = draggedBlock.track;
  const minDuration = draggedBlock.type === "text" ? 0.05 : 0.01;
  const trackBlocks = allBlocks.filter((b) => b.id !== draggedId && b.track === track);

  const updatedDraggedBlock = { ...draggedBlock };
  let updatedAdjacentBlock: TimelineBlock | null = null;

  if (side === "left") {
    let newStart = Math.max(minValue, candidateValue);
    newStart = Math.min(newStart, draggedBlock.end - minDuration);

    const leftBlocks = trackBlocks
      .filter((b) => b.end <= draggedBlock.start)
      .sort((a, b) => b.end - a.end);
    const adjacent = leftBlocks[0];

    if (adjacent && newStart < adjacent.end) {
      const adjMinDuration = adjacent.type === "text" ? 0.05 : 0.01;
      let newAdjEnd = newStart;
      if (newAdjEnd < adjacent.start + adjMinDuration) {
        newAdjEnd = adjacent.start + adjMinDuration;
        newStart = newAdjEnd;
      }
      updatedAdjacentBlock = { ...adjacent, end: newAdjEnd };
    }
    updatedDraggedBlock.start = newStart;
  } else {
    let newEnd = Math.min(maxValue, candidateValue);
    newEnd = Math.max(newEnd, draggedBlock.start + minDuration);

    const rightBlocks = trackBlocks
      .filter((b) => b.start >= draggedBlock.end)
      .sort((a, b) => a.start - b.start);
    const adjacent = rightBlocks[0];

    if (adjacent && newEnd > adjacent.start) {
      const adjMinDuration = adjacent.type === "text" ? 0.05 : 0.01;
      let newAdjStart = newEnd;
      if (newAdjStart > adjacent.end - adjMinDuration) {
        newAdjStart = adjacent.end - adjMinDuration;
        newEnd = newAdjStart;
      }
      updatedAdjacentBlock = { ...adjacent, start: newAdjStart };
    }
    updatedDraggedBlock.end = newEnd;
  }

  const updates = [updatedDraggedBlock];
  if (updatedAdjacentBlock) {
    updates.push(updatedAdjacentBlock);
  }

  applyTimelineUpdates(updates, setSegments, setZoomSegments, setTextOverlays);
}

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
  segments,
  zoomSegments,
  textOverlays,
  trackIndices,
  setSegments,
  setZoomSegments,
  setTextOverlays,
  setTrackIndices,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  segments: TrimSegment[];
  zoomSegments: ZoomEffect[];
  textOverlays: TextOverlayItem[];
  trackIndices: Record<string, number>;
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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

      if (dragState.mode === "edge") {
        const candidateValue = dragState.startValue + deltaValue;
        handleBlockResize({
          draggedId,
          side: dragState.side,
          candidateValue,
          segments,
          zoomSegments,
          textOverlays,
          trackIndices,
          minValue,
          maxValue,
          setSegments,
          setZoomSegments,
          setTextOverlays,
        });
      } else if (dragState.mode === "segment") {
        const deltaY = e.clientY - dragState.startY;
        const deltaTrack = Math.round(deltaY / 36);
        const candidateTrack = Math.max(0, dragState.startTrack + deltaTrack);

        const width = dragState.endValue - dragState.startValue;
        const candidateStart = dragState.startValue + deltaValue;
        const candidateEnd = candidateStart + width;

        handleBlockDrag({
          draggedId,
          candidateStart,
          candidateEnd,
          candidateTrack,
          segments,
          zoomSegments,
          textOverlays,
          trackIndices,
          minValue,
          maxValue,
          setSegments,
          setZoomSegments,
          setTextOverlays,
          setTrackIndices,
        });
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
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  ]);

  return { dragState, setDragState };
}

export function useZoomSegmentDrag({
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
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  segments: TrimSegment[];
  zoomSegments: ZoomEffect[];
  textOverlays: TextOverlayItem[];
  trackIndices: Record<string, number>;
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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

      if (dragZoomState.mode === "edge") {
        const candidateValue = dragZoomState.startValue + deltaValue;
        handleBlockResize({
          draggedId,
          side: dragZoomState.side,
          candidateValue,
          segments,
          zoomSegments,
          textOverlays,
          trackIndices,
          minValue,
          maxValue,
          setSegments,
          setZoomSegments,
          setTextOverlays,
        });
      } else if (dragZoomState.mode === "segment") {
        const deltaY = e.clientY - dragZoomState.startY;
        const deltaTrack = Math.round(deltaY / 36);
        const candidateTrack = Math.max(0, dragZoomState.startTrack + deltaTrack);

        const width = dragZoomState.endValue - dragZoomState.startValue;
        const candidateStart = dragZoomState.startValue + deltaValue;
        const candidateEnd = candidateStart + width;

        handleBlockDrag({
          draggedId,
          candidateStart,
          candidateEnd,
          candidateTrack,
          segments,
          zoomSegments,
          textOverlays,
          trackIndices,
          minValue,
          maxValue,
          setSegments,
          setZoomSegments,
          setTextOverlays,
          setTrackIndices,
        });
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
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  ]);

  return { dragZoomState, setDragZoomState };
}

export function useTextOverlayDrag({
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
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  segments: TrimSegment[];
  zoomSegments: ZoomEffect[];
  textOverlays: TextOverlayItem[];
  trackIndices: Record<string, number>;
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  setTrackIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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

      if (dragTextState.mode === "edge") {
        const candidateValue = dragTextState.startValue + deltaValue;
        handleBlockResize({
          draggedId,
          side: dragTextState.side,
          candidateValue,
          segments,
          zoomSegments,
          textOverlays,
          trackIndices,
          minValue,
          maxValue,
          setSegments,
          setZoomSegments,
          setTextOverlays,
        });
      } else if (dragTextState.mode === "segment") {
        const deltaY = e.clientY - dragTextState.startY;
        const deltaTrack = Math.round(deltaY / 36);
        const candidateTrack = Math.max(0, dragTextState.startTrack + deltaTrack);

        const width = dragTextState.endValue - dragTextState.startValue;
        const candidateStart = dragTextState.startValue + deltaValue;
        const candidateEnd = candidateStart + width;

        handleBlockDrag({
          draggedId,
          candidateStart,
          candidateEnd,
          candidateTrack,
          segments,
          zoomSegments,
          textOverlays,
          trackIndices,
          minValue,
          maxValue,
          setSegments,
          setZoomSegments,
          setTextOverlays,
          setTrackIndices,
        });
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
    segments,
    zoomSegments,
    textOverlays,
    trackIndices,
    setSegments,
    setZoomSegments,
    setTextOverlays,
    setTrackIndices,
  ]);

  return { dragTextState, setDragTextState };
}

/**
 * Drag and resize for the timeline's subtitle track (SUB-6.4).
 *
 * The same shape as the three hooks above — a `DragSubtitleState` with `edge`
 * and `segment` modes, set on mousedown by the block, window listeners that
 * convert pointer travel into seconds through `zoomedTimelineWidth` — but the
 * mutation goes somewhere else, and deliberately so.
 *
 * `handleBlockDrag` / `handleBlockResize` above resolve collisions by RIPPLING:
 * a moved block pushes its neighbours along the track, and blocks live on
 * multiple lanes assigned by `resolveTracks`. Neither is right for cues. Cues
 * occupy one fixed lane, and their non-overlap invariant belongs to
 * `normalizeCues` — which the render worker's cue remapping depends on and
 * which resolves overlaps by truncation, not by rippling, precisely so a drag
 * cannot silently re-time the rest of a 150-cue transcript. So the arithmetic
 * is `resolveCueDrag` (pure, tested in subtitleTrackLayout.test.ts) and the
 * caller applies the result through the subtitle store.
 *
 * Every frame is resolved against the cue list as it was at mousedown, which
 * `getOriginCues` supplies once per gesture. That is what makes a drag
 * reversible and what lets the whole gesture collapse into one undo step.
 *
 * The callbacks and the playhead are held in refs, so the effect's dependencies
 * are only the gesture and the geometry: with 150 cues, re-registering two
 * window listeners on every mousemove (each of which changes the cue list) is
 * the difference between a smooth drag and a stuttering one.
 */
export function useSubtitleCueDrag({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  playheadSeconds,
  snapPx = SUBTITLE_SNAP_PX,
  getOriginCues,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  /** Playhead position — a snap target, read fresh on every move. */
  playheadSeconds: number;
  /** Snap radius in pixels. Constant on screen at every zoom level. */
  snapPx?: number;
  /** The cue list to resolve this gesture against, read once at mousedown. */
  getOriginCues: () => SubtitleCue[];
  onDragStart: () => void;
  onDragMove: (cues: SubtitleCue[]) => void;
  onDragEnd: () => void;
}) {
  const [dragSubtitleState, setDragSubtitleState] = useState<DragSubtitleState | null>(null);

  const getOriginCuesRef = useRef(getOriginCues);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const playheadRef = useRef(playheadSeconds);

  useEffect(() => {
    getOriginCuesRef.current = getOriginCues;
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
    playheadRef.current = playheadSeconds;
  }, [getOriginCues, onDragStart, onDragMove, onDragEnd, playheadSeconds]);

  useEffect(() => {
    if (!dragSubtitleState) {
      return;
    }

    const pixelsPerUnit = zoomedTimelineWidth / (maxValue - minValue);
    if (!Number.isFinite(pixelsPerUnit) || pixelsPerUnit <= 0) {
      return;
    }

    const origin = getOriginCuesRef.current();
    onDragStartRef.current();

    // A click is a mousedown and a mouseup with a stray zero-distance move in
    // between; without a threshold that move would snap the cue onto a
    // neighbour and selecting a block would silently retime it.
    let dragging = false;
    const snapSeconds = snapSecondsForZoom(pixelsPerUnit, snapPx);

    const onMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragSubtitleState.startX;
      if (!dragging) {
        if (Math.abs(deltaPx) < SUBTITLE_DRAG_THRESHOLD_PX) {
          return;
        }
        dragging = true;
      }
      const deltaSeconds = deltaPx / pixelsPerUnit;
      const next = resolveCueDrag(
        origin,
        dragSubtitleState.mode === "edge"
          ? {
              index: dragSubtitleState.index,
              mode: "edge",
              side: dragSubtitleState.side,
              startValue: dragSubtitleState.startValue,
              deltaSeconds,
            }
          : {
              index: dragSubtitleState.index,
              mode: "segment",
              startValue: dragSubtitleState.startValue,
              endValue: dragSubtitleState.endValue,
              deltaSeconds,
            },
        {
          minValue,
          maxValue,
          snapSeconds,
          playheadSeconds: playheadRef.current,
        }
      );
      if (next) {
        onDragMoveRef.current(next);
      }
    };

    const onUp = () => {
      setDragSubtitleState(null);
      onDragEndRef.current();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragSubtitleState, minValue, maxValue, zoomedTimelineWidth, snapPx]);

  return { dragSubtitleState, setDragSubtitleState };
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
  setLocalValue: (value: number) => void;
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
