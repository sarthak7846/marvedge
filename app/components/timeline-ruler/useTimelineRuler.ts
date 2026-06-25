import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TimelineRulerProps, TextOverlayItem } from "./types";
import {
  usePlayhead,
  useTimelineZoom,
  useTrimSelection,
  useTimelineHistory,
  useTimelineProgress,
} from "./useTimelineCore";
import { useHandleDrag } from "./useTimelineDrags";
import { useTrimActions, useZoomActions } from "./useTimelineActions";

interface TimelineBlock {
  id: string;
  type: "trim" | "zoom" | "text";
  index: number;
  start: number;
  end: number;
  track: number;
  width: number;
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
    setTextOverlays,
    isDraggingTimelineRef,
  } = props;

  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const baseTimelineWidth = 956;

  const [trackIndices, setTrackIndices] = useState<Record<string, number>>({});

  const getTrackIndex = useCallback(
    (itemId: string, type: "trim" | "zoom" | "text") => {
      if (trackIndices[itemId] !== undefined) {
        return trackIndices[itemId];
      }
      if (type === "trim") {
        return 0;
      }
      if (type === "zoom") {
        return 1;
      }
      return 2;
    },
    [trackIndices]
  );

  const maxTrackIndex = useMemo(() => {
    let maxIdx = 2; // default accommodates at least 3 tracks (0, 1, 2)

    (segments || []).forEach((_, idx) => {
      const tIdx = getTrackIndex(`trim-${idx}`, "trim");
      if (tIdx > maxIdx) {
        maxIdx = tIdx;
      }
    });

    (zoomSegments || []).forEach((seg, idx) => {
      const tIdx = getTrackIndex(`zoom-${idx}`, "zoom");
      if (tIdx > maxIdx) {
        maxIdx = tIdx;
      }
    });

    (textOverlays || []).forEach((overlay) => {
      const tIdx = getTrackIndex(`text-${overlay.id}`, "text");
      if (tIdx > maxIdx) {
        maxIdx = tIdx;
      }
    });

    return maxIdx;
  }, [segments, zoomSegments, textOverlays, getTrackIndex]);

  const totalTracks = maxTrackIndex + 2; // occupied tracks + 1 extra empty track
  const calculatedHeight = 42 + totalTracks * 38;

  const segmentsRef = useRef(segments);
  const zoomSegmentsRef = useRef(zoomSegments);
  const textOverlaysRef = useRef(textOverlays);
  const trackIndicesRef = useRef(trackIndices);

  useEffect(() => {
    segmentsRef.current = (segments || []).map((s) => {
      return { ...s };
    });
  }, [segments]);

  useEffect(() => {
    zoomSegmentsRef.current = (zoomSegments || []).map((s) => {
      return { ...s };
    });
  }, [zoomSegments]);

  useEffect(() => {
    textOverlaysRef.current = (textOverlays || []).map((s) => {
      return { ...s };
    });
  }, [textOverlays]);

  useEffect(() => {
    trackIndicesRef.current = trackIndices;
  }, [trackIndices]);

  const getAllBlocksFromRefs = useCallback((excludeId?: string): TimelineBlock[] => {
    const list: TimelineBlock[] = [];
    (segmentsRef.current || []).forEach((seg, idx) => {
      const id = `trim-${idx}`;
      if (id !== excludeId) {
        list.push({
          id,
          type: "trim",
          index: idx,
          start: seg.start,
          end: seg.end,
          track: trackIndicesRef.current[id] !== undefined ? trackIndicesRef.current[id] : 0,
          width: seg.end - seg.start,
        });
      }
    });
    (zoomSegmentsRef.current || []).forEach((seg, idx) => {
      const id = `zoom-${idx}`;
      if (id !== excludeId) {
        list.push({
          id,
          type: "zoom",
          index: idx,
          start: seg.startTime,
          end: seg.endTime,
          track: trackIndicesRef.current[id] !== undefined ? trackIndicesRef.current[id] : 1,
          width: seg.endTime - seg.startTime,
        });
      }
    });
    (textOverlaysRef.current || []).forEach((overlay) => {
      const id = `text-${overlay.id}`;
      if (id !== excludeId) {
        list.push({
          id,
          type: "text",
          index: -1,
          start: overlay.startTime,
          end: overlay.endTime,
          track: trackIndicesRef.current[id] !== undefined ? trackIndicesRef.current[id] : 2,
          width: overlay.endTime - overlay.startTime,
        });
      }
    });
    return list;
  }, []);

  const updateAllSegmentStates = useCallback(
    (updatedPositions: Record<string, { start: number; end: number }>) => {
      // 1. Sync refs immediately to prevent stale event data on next pixel move
      (segmentsRef.current || []).forEach((seg, idx) => {
        const id = `trim-${idx}`;
        if (updatedPositions[id] !== undefined) {
          seg.start = updatedPositions[id].start;
          seg.end = updatedPositions[id].end;
        }
      });

      (zoomSegmentsRef.current || []).forEach((seg, idx) => {
        const id = `zoom-${idx}`;
        if (updatedPositions[id] !== undefined) {
          seg.startTime = updatedPositions[id].start;
          seg.endTime = updatedPositions[id].end;
        }
      });

      (textOverlaysRef.current || []).forEach((overlay) => {
        const id = `text-${overlay.id}`;
        if (updatedPositions[id] !== undefined) {
          overlay.startTime = updatedPositions[id].start;
          overlay.endTime = updatedPositions[id].end;
        }
      });

      // 2. Dispatch state updates to React
      setSegments((prev) =>
        prev.map((seg, idx) => {
          const id = `trim-${idx}`;
          if (updatedPositions[id] !== undefined) {
            return {
              ...seg,
              start: updatedPositions[id].start,
              end: updatedPositions[id].end,
            };
          }
          return seg;
        })
      );

      setZoomSegments((prev) =>
        prev.map((seg, idx) => {
          const id = `zoom-${idx}`;
          if (updatedPositions[id] !== undefined) {
            return {
              ...seg,
              startTime: updatedPositions[id].start,
              endTime: updatedPositions[id].end,
            };
          }
          return seg;
        })
      );

      setTextOverlays((prev) =>
        prev.map((overlay) => {
          const id = `text-${overlay.id}`;
          if (updatedPositions[id] !== undefined) {
            return {
              ...overlay,
              startTime: updatedPositions[id].start,
              endTime: updatedPositions[id].end,
            };
          }
          return overlay;
        })
      );
    },
    [setSegments, setZoomSegments, setTextOverlays]
  );

  useEffect(() => {
    let changed = false;
    const newTrackIndices = { ...trackIndices };

    const checkAndAssign = (id: string, start: number, end: number) => {
      if (newTrackIndices[id] === undefined) {
        let track = 0;
        while (true) {
          let hasOverlap = false;
          (segments || []).forEach((s, i) => {
            const blockId = `trim-${i}`;
            if (blockId !== id && newTrackIndices[blockId] === track) {
              if (!(end <= s.start || start >= s.end)) {
                hasOverlap = true;
              }
            }
          });
          (zoomSegments || []).forEach((s, i) => {
            const blockId = `zoom-${i}`;
            if (blockId !== id && newTrackIndices[blockId] === track) {
              if (!(end <= s.startTime || start >= s.endTime)) {
                hasOverlap = true;
              }
            }
          });
          (textOverlays || []).forEach((s) => {
            const blockId = `text-${s.id}`;
            if (blockId !== id && newTrackIndices[blockId] === track) {
              if (!(end <= s.startTime || start >= s.endTime)) {
                hasOverlap = true;
              }
            }
          });

          if (!hasOverlap) {
            newTrackIndices[id] = track;
            changed = true;
            break;
          }
          track++;
        }
      }
    };

    (segments || []).forEach((seg, idx) => {
      checkAndAssign(`trim-${idx}`, seg.start, seg.end);
    });

    (zoomSegments || []).forEach((seg, idx) => {
      checkAndAssign(`zoom-${idx}`, seg.startTime, seg.endTime);
    });

    (textOverlays || []).forEach((overlay) => {
      checkAndAssign(`text-${overlay.id}`, overlay.startTime, overlay.endTime);
    });

    if (changed) {
      setTrackIndices(newTrackIndices);
    }
  }, [segments, zoomSegments, textOverlays, trackIndices]);

  const resolveLaneCollisions = useCallback(
    (
      draggedId: string,
      newStart: number,
      newEnd: number,
      newTrackIdx: number,
      originalStart: number,
      originalTrack: number
    ) => {
      const draggedWidth = newEnd - newStart;
      const laneItems = getAllBlocksFromRefs(draggedId).filter((b) => {
        return b.track === newTrackIdx;
      });

      const sortedLaneItems = [...laneItems].sort((a, b) => {
        return a.start - b.start;
      });

      let leftItems: TimelineBlock[] = [];
      let rightItems: TimelineBlock[] = [];

      if (originalTrack === newTrackIdx) {
        leftItems = sortedLaneItems.filter((b) => {
          return b.start < originalStart;
        });
        rightItems = sortedLaneItems.filter((b) => {
          return b.start >= originalStart;
        });
      } else {
        const insertIdx = sortedLaneItems.findIndex((b) => {
          return newStart < b.start;
        });
        if (insertIdx === -1) {
          leftItems = sortedLaneItems;
          rightItems = [];
        } else {
          leftItems = sortedLaneItems.slice(0, insertIdx);
          rightItems = sortedLaneItems.slice(insertIdx);
        }
      }

      let currentRightBoundary = newEnd;
      rightItems.forEach((b) => {
        if (b.start < currentRightBoundary) {
          b.start = currentRightBoundary;
          b.end = b.start + b.width;
        }
        currentRightBoundary = b.end;
      });

      let currentLeftBoundary = newStart;
      for (let i = leftItems.length - 1; i >= 0; i--) {
        const b = leftItems[i];
        if (b.end > currentLeftBoundary) {
          b.end = currentLeftBoundary;
          b.start = b.end - b.width;
        }
        currentLeftBoundary = b.start;
      }

      if (rightItems.length > 0) {
        const lastItem = rightItems[rightItems.length - 1];
        if (lastItem.end > maxValue) {
          lastItem.end = maxValue;
          lastItem.start = maxValue - lastItem.width;
          for (let i = rightItems.length - 2; i >= 0; i--) {
            if (rightItems[i].end > rightItems[i + 1].start) {
              rightItems[i].end = rightItems[i + 1].start;
              rightItems[i].start = rightItems[i].end - rightItems[i].width;
            }
          }
          newEnd = Math.min(newEnd, rightItems[0].start);
          newStart = newEnd - draggedWidth;
        }
      }

      if (leftItems.length > 0) {
        const firstItem = leftItems[0];
        if (firstItem.start < minValue) {
          firstItem.start = minValue;
          firstItem.end = minValue + firstItem.width;
          for (let i = 1; i < leftItems.length; i++) {
            if (leftItems[i].start < leftItems[i - 1].end) {
              leftItems[i].start = leftItems[i - 1].end;
              leftItems[i].end = leftItems[i].start + leftItems[i].width;
            }
          }
          newStart = Math.max(newStart, leftItems[leftItems.length - 1].end);
          newEnd = newStart + draggedWidth;
        }
      }

      if (newStart < minValue) {
        newStart = minValue;
        newEnd = minValue + draggedWidth;
      } else if (newEnd > maxValue) {
        newEnd = maxValue;
        newStart = maxValue - draggedWidth;
      }

      const updatedPositions: Record<string, { start: number; end: number }> = {};
      leftItems.forEach((b) => {
        updatedPositions[b.id] = { start: b.start, end: b.end };
      });
      rightItems.forEach((b) => {
        updatedPositions[b.id] = { start: b.start, end: b.end };
      });
      updatedPositions[draggedId] = { start: newStart, end: newEnd };

      return updatedPositions;
    },
    [getAllBlocksFromRefs, minValue, maxValue]
  );

  const resolveEdgeResizeCollisions = useCallback(
    (
      draggedId: string,
      side: "left" | "right",
      newValue: number,
      originalStart: number,
      originalEnd: number,
      originalTrack: number
    ) => {
      const laneItems = getAllBlocksFromRefs(draggedId).filter((b) => {
        return b.track === originalTrack;
      });
      const updatedPositions: Record<string, { start: number; end: number }> = {};
      const minDuration = 0.05;

      if (side === "left") {
        const leftItems = laneItems.filter((b) => {
          return b.end <= originalStart;
        });
        const closestLeft =
          leftItems.length > 0
            ? leftItems.reduce((max, curr) => {
                return curr.end > max.end ? curr : max;
              }, leftItems[0])
            : null;

        if (closestLeft) {
          const clampedValue = Math.max(newValue, closestLeft.start + minDuration);
          updatedPositions[closestLeft.id] = { start: closestLeft.start, end: clampedValue };
          updatedPositions[draggedId] = { start: clampedValue, end: originalEnd };
        } else {
          const clampedValue = Math.max(newValue, minValue);
          updatedPositions[draggedId] = { start: clampedValue, end: originalEnd };
        }
      } else {
        const rightItems = laneItems.filter((b) => {
          return b.start >= originalEnd;
        });
        const closestRight =
          rightItems.length > 0
            ? rightItems.reduce((min, curr) => {
                return curr.start < min.start ? curr : min;
              }, rightItems[0])
            : null;

        if (closestRight) {
          const clampedValue = Math.min(newValue, closestRight.end - minDuration);
          updatedPositions[closestRight.id] = { start: clampedValue, end: closestRight.end };
          updatedPositions[draggedId] = { start: originalStart, end: clampedValue };
        } else {
          const clampedValue = Math.min(newValue, maxValue);
          updatedPositions[draggedId] = { start: originalStart, end: clampedValue };
        }
      }

      return updatedPositions;
    },
    [getAllBlocksFromRefs, minValue, maxValue]
  );

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
    trackIndicesRef,
    segmentsRef,
    zoomSegmentsRef,
    textOverlaysRef,
    getTrackIndex,
    maxTrackIndex,
    totalTracks,
    calculatedHeight,
    getAllBlocksFromRefs,
    updateAllSegmentStates,
    resolveLaneCollisions,
    resolveEdgeResizeCollisions,
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
