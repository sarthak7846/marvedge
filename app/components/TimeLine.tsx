"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { ZoomEffect } from "../types/editor/zoom-effect";
import Linepage from "./Linepage";

import ReactPlayer from "react-player";

type TextOverlayItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  startTime: number;
  endTime: number;
  fontFamily: string;
  fontSize: number;
  color: string;
};

interface TimelineRulerProps {
  minValue?: number;
  maxValue?: number;
  currentValue?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  majorStep?: number;
  minorStep?: number;
  microStep?: number;
  startTime?: number;
  endTime?: number;
  onStartTimeChange?: (value: number) => void;
  onEndTimeChange?: (value: number) => void;
  processing?: boolean;
  onResetVideo?: () => void;

  onTrim?: (segments: { start: string; end: string }[]) => Promise<void>;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playing: boolean;
  playbackSpeed: number;
  setPlaybackSpeed: (v: number) => void;

  mode: "main" | "trim" | "zoom" | "text";
  setMode: React.Dispatch<React.SetStateAction<"main" | "trim" | "zoom" | "text">>;
  playerRef: React.RefObject<ReactPlayer>;
  setChildHandleProgress: (fn: (data: { playedSeconds: number }) => void) => void;
  zoomSegments: ZoomEffect[];
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  activeZoomIdx: number;
  setActiveZoomIdx: React.Dispatch<React.SetStateAction<number>>;
  zoomLevelDepth: number;
  segments: { start: number; end: number }[];
  setSegments: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>;
  textOverlays: TextOverlayItem[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  selectedTextOverlayId: string | null;
  setSelectedTextOverlayId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextOverlayInspectorValues: (overlay: TextOverlayItem) => void;
  isDraggingTimelineRef: React.MutableRefObject<boolean>;
}

export default function TimelineRuler({
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
  onResetVideo,

  setPlaying,
  playbackSpeed,
  setPlaybackSpeed,

  mode,
  setMode,
  playerRef,
  setChildHandleProgress,

  zoomSegments,
  setZoomSegments,
  activeZoomIdx,
  setActiveZoomIdx,

  zoomLevelDepth,
  segments,
  setSegments,
  textOverlays,
  setTextOverlays,
  selectedTextOverlayId,
  setSelectedTextOverlayId,
  setTextOverlayInspectorValues,
  isDraggingTimelineRef,
}: TimelineRulerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggingHandle] = useState<"current" | "start" | "end" | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [localValue, setLocalValue] = useState(currentValue || 0);
  const localValueRef = useRef(localValue);
  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  const [localStartTime, setLocalStartTime] = useState(startTime ?? minValue);
  const [localEndTime, setLocalEndTime] = useState(endTime ?? maxValue);

  const [activeSegment, setActiveSegment] = useState<number>(-1);

  type EditorAction =
    | { type: "add-trim"; segment: { start: number; end: number } }
    | {
        type: "remove-trim";
        segment: { start: number; end: number };
        index: number;
      }
    | { type: "add-zoom"; segment: ZoomEffect }
    | { type: "remove-zoom"; segment: ZoomEffect; index: number };
  const [undoStack, setUndoStack] = useState<EditorAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditorAction[]>([]);
  const [draggingScissor, setDraggingScissor] = useState<"left" | "right" | null>(null);
  const [scissorPreview, setScissorPreview] = useState<number | null>(null);
  const [draggingCurrentTime, setDraggingCurrentTime] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [playheadMode, setPlayheadMode] = useState<"trim" | "non-trim">("non-trim");
  const [selectedTrimIdx, setSelectedTrimIdx] = useState<number | null>(null);

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

  const FIXED_TRIM_DURATION = 4;

  const segmentsRef = useRef(segments);
  const zoomSegmentsRef = useRef(zoomSegments);
  const textOverlaysRef = useRef(textOverlays);
  const trackIndicesRef = useRef(trackIndices);
  const playheadModeRef = useRef(playheadMode);
  const selectedTrimIdxRef = useRef(selectedTrimIdx);
  const onValueChangeRef = useRef(onValueChange);
  const onStartTimeChangeRef = useRef(onStartTimeChange);
  const onEndTimeChangeRef = useRef(onEndTimeChange);
  const isUpdatingFromPropRef = useRef(false);

  const switchToTrimMode = (trimIdx: number) => {
    console.log(
      `[MODE] Switching to TRIM mode, trimIdx=${trimIdx}, segment=${JSON.stringify(segments[trimIdx])}`
    );
    playheadModeRef.current = "trim";
    selectedTrimIdxRef.current = trimIdx;
    setPlayheadMode("trim");
    setSelectedTrimIdx(trimIdx);
    setLocalValue(segments[trimIdx].start);
  };

  const switchToNonTrimMode = () => {
    playheadModeRef.current = "non-trim";
    selectedTrimIdxRef.current = null;
    setPlayheadMode("non-trim");
    setSelectedTrimIdx(null);
  };

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

  useEffect(() => {
    playheadModeRef.current = playheadMode;
  }, [playheadMode]);

  useEffect(() => {
    selectedTrimIdxRef.current = selectedTrimIdx;
  }, [selectedTrimIdx]);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    onStartTimeChangeRef.current = onStartTimeChange;
  }, [onStartTimeChange]);

  useEffect(() => {
    onEndTimeChangeRef.current = onEndTimeChange;
  }, [onEndTimeChange]);

  interface TimelineBlock {
    id: string;
    type: "trim" | "zoom" | "text";
    index: number;
    start: number;
    end: number;
    track: number;
    width: number;
  }

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

  const hasBeenTrimmed =
    segments.length > 1 ||
    (segments.length === 1 &&
      (Math.abs(segments[0].start - minValue) > 0.001 ||
        Math.abs(segments[0].end - maxValue) > 0.001));
  const hasTimelineEdits = hasBeenTrimmed || zoomSegments.length > 0;

  const baseTimelineWidth = 956;
  const zoomedTimelineWidth = baseTimelineWidth * zoomLevel;

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    const newTimelineWidth = baseTimelineWidth * zoomLevel;
    const maxScroll = Math.max(0, newTimelineWidth - baseTimelineWidth);

    const clampedScrollLeft = Math.min(scrollLeft, maxScroll);
    if (clampedScrollLeft !== scrollLeft) {
      setScrollLeft(clampedScrollLeft);
      scrollContainerRef.current.scrollLeft = clampedScrollLeft;
    }
  }, [zoomLevel, baseTimelineWidth, scrollLeft]);

  useEffect(() => {
    const el = rulerRef.current;
    if (!el) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorRatio = cursorX / baseTimelineWidth;

        setZoomLevel((prev) => {
          const factor = e.deltaY < 0 ? 1.25 : 0.8;
          const newZoom = Math.max(1, Math.min(prev * factor, 20));

          if (newZoom > 1 && scrollContainerRef.current) {
            const newTimelineWidth = baseTimelineWidth * newZoom;
            const maxScroll = Math.max(0, newTimelineWidth - baseTimelineWidth);
            const targetScrollLeft = cursorRatio * newTimelineWidth - cursorX;
            const clampedScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));

            setScrollLeft(clampedScrollLeft);
            scrollContainerRef.current.scrollLeft = clampedScrollLeft;
          }

          return newZoom;
        });
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [baseTimelineWidth]);

  useEffect(() => {
    if (isDraggingTimelineRef.current) {
      return;
    }
    isUpdatingFromPropRef.current = true;
    setLocalValue(currentValue);
  }, [currentValue, isDraggingTimelineRef]);

  useEffect(() => {
    if (startTime !== undefined) {
      setLocalStartTime(startTime);
    }
  }, [startTime]);

  useEffect(() => {
    if (endTime !== undefined) {
      setLocalEndTime(endTime);
    }
  }, [endTime]);

  useEffect(() => {
    if (segments[activeSegment]) {
      setLocalStartTime(segments[activeSegment].start);
      setLocalEndTime(segments[activeSegment].end);
    }
  }, [activeSegment, segments]);

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
  }, [draggingScissor, scissorPreview, minValue, maxValue, segments.length, setSegments]);

  const lastSeekTimeRef = useRef<number>(0);

  const updateCurrentTimeFromMouse = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!rulerRef.current) {
        return;
      }
      lastSeekTimeRef.current = Date.now();

      const rect = rulerRef.current.getBoundingClientRect();
      const x = (e instanceof MouseEvent ? e.clientX : e.nativeEvent.clientX) - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(1, x / width));
      const value = minValue + (maxValue - minValue) * percentage;

      localValueRef.current = value;
      setLocalValue(value);
    },
    [minValue, maxValue]
  );

  useEffect(() => {
    if (!draggingCurrentTime) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      updateCurrentTimeFromMouse(e);
    };
    const onUp = () => {
      const player = playerRef.current;
      if (player) {
        const finalValue = localValueRef.current;
        setTimeout(() => {
          player.seekTo(finalValue, "seconds");
        }, 0);
      }

      setDraggingCurrentTime(false);
      isDraggingTimelineRef.current = false;

      lastSeekTimeRef.current = Date.now();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    draggingCurrentTime,
    updateCurrentTimeFromMouse,
    setPlaying,
    isDraggingTimelineRef,
    playerRef,
  ]);

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

  const removeSegment = (idx: number) => {
    const removed = segments[idx];

    setUndoStack((prev) => [...prev, { type: "remove-trim", segment: removed, index: idx }]);
    setRedoStack([]);

    const newSegments = segments.filter((_, i) => i !== idx);
    setSegments(newSegments);

    const newActiveSegment = Math.min(activeSegment, newSegments.length - 1);
    setActiveSegment(-1);
    if (newSegments[newActiveSegment]) {
      setLocalStartTime(newSegments[newActiveSegment].start);
      setLocalEndTime(newSegments[newActiveSegment].end);
    }

    if (newSegments.length === 0) {
      switchToNonTrimMode();
    }
  };

  const removeZoomSegment = (idx: number) => {
    const removed = zoomSegments[idx];
    setUndoStack((prev) => [...prev, { type: "remove-zoom", segment: removed, index: idx }]);
    setRedoStack([]);
    setZoomSegments((prev) => prev.filter((_, i) => i !== idx));
    setActiveZoomIdx(-1);
    if (zoomSegments.length <= 1) {
      setMode("main");
    }
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    setSelectedTextOverlayId(null);
    setMode("main");
  };

  const handleUndo = () => {
    if (undoStack.length === 0) {
      return;
    }
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, lastAction]);

    switch (lastAction.type) {
      case "add-trim":
        setSegments((prev) => prev.filter((s) => s !== lastAction.segment));
        if (segments.length <= 1) {
          switchToNonTrimMode();
        }
        break;
      case "remove-trim":
        setSegments((prev) => {
          const newSegs = [...prev];
          newSegs.splice(lastAction.index, 0, lastAction.segment);
          return newSegs;
        });

        break;
      case "add-zoom":
        setZoomSegments((prev) => prev.filter((s) => s !== lastAction.segment));
        break;
      case "remove-zoom":
        setZoomSegments((prev) => {
          const newSegs = [...prev];
          newSegs.splice(lastAction.index, 0, lastAction.segment);
          return newSegs;
        });
        break;
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) {
      return;
    }
    const lastAction = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, lastAction]);

    switch (lastAction.type) {
      case "add-trim":
        setSegments((prev) => [...prev, lastAction.segment]);
        break;
      case "remove-trim":
        setSegments((prev) => prev.filter((_, i) => i !== lastAction.index));
        if (segments.length <= 1) {
          switchToNonTrimMode();
        }
        break;
      case "add-zoom":
        setZoomSegments((prev) => [...prev, lastAction.segment]);
        break;
      case "remove-zoom":
        setZoomSegments((prev) => prev.filter((_, i) => i !== lastAction.index));
        break;
    }
  };

  const handleSmartTrim = async () => {
    const currentTime = localValue;
    const startTime = Math.max(minValue, currentTime);
    const endTime = Math.min(maxValue, currentTime + FIXED_TRIM_DURATION);

    const newSegment = { start: startTime, end: endTime };

    setUndoStack((prev) => [...prev, { type: "add-trim", segment: newSegment }]);
    setRedoStack([]);

    console.log("Start time", startTime, " ", endTime);
    setSegments((prev) => {
      const newSegments = [...prev, newSegment];
      return newSegments;
    });
    setActiveSegment(segments.length - 1);

    setLocalStartTime(startTime);
    setLocalEndTime(endTime);

    console.log(`Created segment from ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);
  };

  const playTrimSegment = (
    segment: { start: number; end: number },
    idx: number,
    e?: React.MouseEvent
  ) => {
    const video = playerRef.current;
    if (!video) {
      return;
    }

    setMode("trim");
    setActiveSegment(idx);
    setActiveZoomIdx(-1);
    if (e) {
      updateCurrentTimeFromMouse(e);
      setPlaying(false);
    } else {
      video.seekTo(segment.start, "seconds");
    }
  };

  const lastPlayedSecondsRef = useRef(0);

  const handleProgress = useCallback(
    ({ playedSeconds }: { playedSeconds: number }) => {
      const player = playerRef.current;
      if (!player) {
        lastPlayedSecondsRef.current = playedSeconds;
        return;
      }

      if (isDraggingTimelineRef.current) {
        lastPlayedSecondsRef.current = playedSeconds;
        return;
      }

      if (Date.now() - lastSeekTimeRef.current < 500) {
        lastPlayedSecondsRef.current = playedSeconds;
        return;
      }

      const delta = playedSeconds - lastPlayedSecondsRef.current;
      const isNaturallyPlaying = delta > 0 && delta < 1;

      lastPlayedSecondsRef.current = playedSeconds;

      if (!isNaturallyPlaying) {
        return;
      }

      if (mode === "main") {
        for (const segment of segments) {
          if (playedSeconds >= segment.start && playedSeconds < segment.end) {
            player.seekTo(segment.end, "seconds");
          }
        }
      }

      if (mode === "trim" && segments[activeSegment]) {
        const trim = segments[activeSegment];
        if (trim && playedSeconds >= trim.end) {
          player.seekTo(trim.start, "seconds");
        }
      }
    },
    [playerRef, mode, segments, activeSegment, isDraggingTimelineRef]
  );

  const handleProgressRef = useRef(handleProgress);
  useEffect(() => {
    handleProgressRef.current = handleProgress;
  }, [handleProgress]);

  const handleProgressWrapper = useCallback((data: { playedSeconds: number }) => {
    handleProgressRef.current?.(data);
  }, []);

  useEffect(() => {
    setChildHandleProgress(() => handleProgressWrapper);
  }, [setChildHandleProgress, handleProgressWrapper]);

  type DragState =
    | {
        mode: "edge";
        index: number;
        side: "left" | "right";
        startX: number;
        startValue: number;
      }
    | {
        mode: "segment";
        index: number;
        startX: number;
        startY: number;
        startValue: number;
        endValue: number;
        startTrackIndex: number;
      };

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
  ]);

  useEffect(() => {
    if (isUpdatingFromPropRef.current) {
      isUpdatingFromPropRef.current = false;
      return;
    }
    onValueChangeRef.current?.(localValue);
  }, [localValue]);

  type DragZoomState =
    | {
        mode: "edge";
        index: number;
        side: "left" | "right";
        startX: number;
        startValue: number;
      }
    | {
        mode: "segment";
        index: number;
        startX: number;
        startY: number;
        startValue: number;
        endValue: number;
        startTrackIndex: number;
      };

  const playZoomSegment = (segment: ZoomEffect, idx: number, e?: React.MouseEvent) => {
    const video = playerRef.current;
    if (!video) {
      return;
    }

    setActiveZoomIdx(idx);

    setMode("zoom");
    setActiveSegment(-1);

    if (e) {
      updateCurrentTimeFromMouse(e);
      setPlaying(false);
    } else {
      video.seekTo(segment.startTime, "seconds");
    }
  };

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
  ]);

  type DragTextState =
    | {
        mode: "edge";
        id: string;
        side: "left" | "right";
        startX: number;
        startValue: number;
      }
    | {
        mode: "segment";
        id: string;
        startX: number;
        startY: number;
        startValue: number;
        endValue: number;
        startTrackIndex: number;
      };

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
  ]);

  const currentPosition = ((localValue - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const handleZoomClick = () => {
    const startTime = Math.max(0, localValue - 1);
    const endTime = Math.min(maxValue, localValue + 2);

    const newSegment: ZoomEffect = {
      id: Date.now().toString(),
      startTime: startTime,
      endTime: endTime,
      zoomLevel: Math.max(2, zoomLevelDepth),
      x: 0.5,
      y: 0.5,
    };

    setUndoStack((prev) => [...prev, { type: "add-zoom", segment: newSegment }]);
    setRedoStack([]);

    console.log("Start time", startTime, " ", endTime);
    const nextIdx = zoomSegments.length;
    setZoomSegments((prev) => [...prev, newSegment]);
    setActiveZoomIdx(nextIdx);
    setMode("zoom");
    playerRef.current?.seekTo(startTime, "seconds");
    setPlaying(true);

    setLocalStartTime(startTime);
    setLocalEndTime(endTime);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-row items-center justify-between w-full mb-6 gap-3 sm:gap-6 ">
        <div className="flex gap-3 sm:gap-4 items-center">
          <button
            onClick={handleZoomClick}
            className="btn-toolbar-item h-[50.85px] w-[111.71px] px-4 flex items-center justify-center gap-1 font-medium bg-white text-[#8A76FC] text-sm rounded-lg hover:shadow-md transition-all duration-200"
          >
            <Image src="/icons/zoooom.svg" alt="Zoom" width={26} height={26} />
            <span className="text-sm font-medium leading-none">Zoom</span>
          </button>

          <button
            onClick={handleSmartTrim}
            disabled={processing}
            className="btn-toolbar-item h-[50.85px] w-[111.71px] px-4 flex items-center justify-center gap-2 font-medium bg-white text-[#8A76FC] text-sm rounded-lg hover:shadow-md transition-all duration-200"
          >
            <Image src="/icons/trim-new.svg" alt="Trim" width={16} height={16} />
            <span className="text-sm font-medium leading-none"> Trim </span>
          </button>

          {onResetVideo && hasTimelineEdits && (
            <button
              onClick={onResetVideo}
              className="btn-toolbar-item h-[50.85px] w-[163px] px-4 flex items-center justify-center gap-2 font-medium bg-white text-[#8A76FC] text-sm rounded-lg hover:shadow-md transition-all duration-200"
            >
              <span className="text-sm font-medium leading-none"> Reset Timeline </span>
            </button>
          )}

          <div className="zoom-slider-housing flex items-center gap-2 px-3 py-2 bg-gray-100/80 rounded-lg backdrop-blur-sm ">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(1, prev * 0.8))}
              className="text-gray-600 hover:text-purple-600 hover:bg-white rounded p-1 transition-colors dark:text-white dark:hover:bg-white/10"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            <input
              type="range"
              min="1"
              max="20"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              style={{
                background: `linear-gradient(to right, #8A76FC ${
                  ((zoomLevel - 1) / (20 - 1)) * 100
                }%, #E9D8FD ${((zoomLevel - 1) / (20 - 1)) * 100}%)`,
              }}
              className="
                w-[170px] h-[13px]
                rounded-full appearance-none cursor-pointer

            [&::-webkit-slider-runnable-track]:h-2
            [&::-webkit-slider-runnable-track]:rounded-full

            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4 
            [&::-webkit-slider-thumb]:w-4 
            [&::-webkit-slider-thumb]:rounded-full 
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-[#8A76FC]
            [&::-webkit-slider-thumb]:shadow
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:relative
            [&::-webkit-slider-thumb]:z-10
            [&::-webkit-slider-thumb]:-mt-1

            [&::-moz-range-track]:h-2
            [&::-moz-range-track]:rounded-full
            [&::-moz-range-track]:bg-purple-200

            [&::-moz-range-progress]:h-2
            [&::-moz-range-progress]:rounded-full
            [&::-moz-range-progress]:bg-[#8A76FC]

            accent-[#8A76FC]
          "
            />

            <button
              onClick={() => setZoomLevel((prev) => Math.min(20, prev * 1.25))}
              className="text-gray-600 hover:text-purple-600 hover:bg-white rounded p-1 transition-colors dark:text-white dark:hover:bg-white/10"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          <div className="btn-toolbar-item h-[51px] px-3 flex items-center justify-center bg-white rounded-lg border border-[#E6E1FA]">
            <select
              value={String(playbackSpeed)}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="h-[36px] bg-transparent text-sm text-[#7C5CFC] font-medium focus:outline-none cursor-pointer dark:text-white [&>option]:dark:bg-[#0a081a]"
              title="Playback speed"
            >
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
            </select>
          </div>

          <button
            onClick={() => {
              if (mode === "trim" && activeSegment >= 0 && activeSegment < segments.length) {
                removeSegment(activeSegment);
              } else if (
                mode === "zoom" &&
                activeZoomIdx >= 0 &&
                activeZoomIdx < zoomSegments.length
              ) {
                removeZoomSegment(activeZoomIdx);
              } else if (mode === "text" && selectedTextOverlayId) {
                removeTextOverlay(selectedTextOverlayId);
              }
            }}
            disabled={
              mode === "main" ||
              (mode === "trim" && (segments.length === 0 || activeSegment === -1)) ||
              (mode === "zoom" && (zoomSegments.length === 0 || activeZoomIdx === -1)) ||
              (mode === "text" && !selectedTextOverlayId)
            }
            className="btn-toolbar-item h-[51px] w-[51px] px-3 flex items-center justify-center font-medium bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Delete"
          >
            <Image
              src="/icons/Vector (1) copy.svg"
              alt="delete_icon"
              width={18.67}
              height={21}
              className="dark:brightness-0 dark:invert"
            />
          </button>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="btn-toolbar-item h-[51px] w-[51px] px-3 flex items-center justify-center font-medium bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Image
              src="/icons/undo.svg"
              alt="Undo"
              width={18.41}
              height={14.71}
              className="dark:brightness-0 dark:invert"
            />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="btn-toolbar-item h-[51px] w-[51px] px-3 flex items-center justify-center font-medium bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Image
              src="/icons/redo.svg"
              alt="Redo"
              width={18.41}
              height={14.71}
              className="dark:brightness-0 dark:invert"
            />
          </button>
        </div>
      </div>

      <div className="track-stream-container max-w-[1379px] h-[173px]">
        <div
          className=" flex items-center justify-center bg-transparent"
          style={{ height: "100%" }}
        >
          <div
            className="
            flex-none
            flex flex-col items-center justify-between
            bg-[#8A76FC]
            rounded-l-lg
            cursor-ew-resize
            z-30
            shrink-0
            select-none
            py-3
            slice-handle
            slice-handle-left
          "
            style={{ width: "32px", height: "100%" }}
            onMouseDown={() => {
              setDraggingScissor("left");
              setScissorPreview(null);
            }}
          >
            <div
              className="
            flex flex-col items-center justify-between
            bg-[#8A76FC]
            rounded-l-lg
            cursor-ew-resize
            z-30
            shrink-0
            select-none
            slice-handle
            slice-handle-left
            "
              style={{ width: "20px", height: "100%" }}
            >
              <div className="flex-1 w-px bg-white/80" />

              <Image
                src="/icons/trim-new.svg"
                alt="Trim"
                width={20}
                height={20}
                className="pointer-events-none select-none"
                style={{ filter: "brightness(0) invert(1)" }}
              />

              <div className="flex-1 w-px bg-white/80" />
            </div>
          </div>

          <div className="h-full overflow-hidden">
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
                  height: `${calculatedHeight}px`,
                  minHeight: "100%",

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
                    style={{ top: `${36 + (i + 1) * 38}px` }}
                  />
                ))}

                <div
                  className="absolute top-0 h-full z-40 pointer-events-none"
                  style={{
                    left: `${0 + currentPosition - scrollLeft}px`,
                  }}
                >
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2
               w-0 h-0 
               border-l-[9px] border-r-[9px] border-t-[9px]
               border-l-transparent border-r-transparent border-t-green-500"
                  />

                  <div className="w-0.5 h-full bg-green-500 mx-auto" />
                </div>

                {segments.map((segment, idx) => {
                  const startPosition =
                    ((segment.start - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
                  const endPosition =
                    ((segment.end - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
                  const width = endPosition - startPosition;
                  const trackIdx = getTrackIndex(`trim-${idx}`, "trim");
                  const topOffset = 36 + trackIdx * 38;

                  return (
                    <div
                      key={`segment-${idx}`}
                      className={`absolute group cursor-grab transition-opacity track-red sequence-block-shape width-trim-block ${
                        idx === activeSegment && activeSegment != -1
                          ? "bg-[#FF3939]/54 opacity-70 z-10 hover:border-2 border-black rounded-md active"
                          : "bg-[#FF3939]/35 opacity-50 hover:opacity-65 z-8"
                      }`}
                      style={{
                        left: `${startPosition}px`,
                        width: `${width}px`,
                        top: `${topOffset}px`,
                        height: "32px",
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
                          startValue: segment.start,
                          endValue: segment.end,
                          startTrackIndex: trackIdx,
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
                          <div className="text-base font-bold text-[#8A76FC] select-none track-text">
                            Trim
                          </div>
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
                })}
                {zoomSegments.map((segment: ZoomEffect, idx) => {
                  const startPosition =
                    ((segment.startTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
                  const endPosition =
                    ((segment.endTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
                  const width = endPosition - startPosition;
                  const trackIdx = getTrackIndex(`zoom-${idx}`, "zoom");
                  const topOffset = 36 + trackIdx * 38;

                  return (
                    <div
                      key={`segment-${idx}`}
                      className={`absolute group cursor-grab transition-opacity track-green sequence-block-shape width-zoom-block ${
                        idx == activeZoomIdx
                          ? "bg-[#36B37E]/40 opacity-80 z-10 hover:border-2 border-[#36B37E] rounded-md active"
                          : "bg-[#36B37E]/25 opacity-70 hover:opacity-90 z-8"
                      }`}
                      style={{
                        left: `${startPosition}px`,
                        width: `${width}px`,
                        top: `${topOffset}px`,
                        height: "32px",
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
                          startValue: segment.startTime,
                          endValue: segment.endTime,
                          startTrackIndex: trackIdx,
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
                          <div className="text-base font-bold text-[#8A76FC] select-none track-text">
                            Zoom
                          </div>
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
                })}

                {textOverlays.map((overlay, idx) => {
                  const startPosition =
                    ((overlay.startTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
                  const endPosition =
                    ((overlay.endTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
                  const width = Math.max(6, endPosition - startPosition);
                  const isSelected = overlay.id === selectedTextOverlayId;
                  const label = overlay.text?.trim() ? overlay.text.trim() : `Text ${idx + 1}`;
                  const trackIdx = getTrackIndex(`text-${overlay.id}`, "text");
                  const topOffset = 36 + trackIdx * 38;

                  return (
                    <div
                      key={`text-${overlay.id}`}
                      className={`absolute group cursor-grab transition-opacity track-yellow sequence-block-shape width-text-block ${
                        isSelected
                          ? "bg-[#FFF4A8]/85 opacity-90 z-10 hover:border-2 border-[#B38700] rounded-md active"
                          : "bg-[#FFF4A8]/65 opacity-75 hover:opacity-90 border border-[#D4A017] z-8 rounded-md"
                      }`}
                      style={{
                        left: `${startPosition}px`,
                        width: `${width}px`,
                        top: `${topOffset}px`,
                        height: "32px",
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
                          startValue: overlay.startTime,
                          endValue: overlay.endTime,
                          startTrackIndex: trackIdx,
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
                          <div className="text-base font-bold text-[#8A76FC] select-none track-text">
                            Text
                          </div>
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
                })}
              </div>
            </div>
          </div>

          <div
            className="
            flex-none
            flex flex-col items-center justify-between
            bg-[#8A76FC]
            rounded-r-lg
            cursor-ew-resize
            z-30
            shrink-0
            select-none
            py-3
            slice-handle
            slice-handle-right
          "
            style={{ width: "32px", height: "100%" }}
            onMouseDown={() => {
              setDraggingScissor("right");
              setScissorPreview(null);
            }}
          >
            <div
              className="
            flex flex-col items-center justify-between
            bg-[#8A76FC]
            rounded-r-lg
            cursor-ew-resize
            z-30
            shrink-0
            select-none
            slice-handle
            slice-handle-right
            "
              style={{ width: "20px", height: "100%" }}
            >
              <div className="flex-1 w-px bg-white/80" />

              <Image
                src="/icons/trim-new.svg"
                alt="Trim"
                width={20}
                height={20}
                className="pointer-events-none select-none"
                style={{
                  filter: "brightness(0) invert(1)",
                  transform: "scaleX(-1)",
                }}
              />

              <div className="flex-1 w-px bg-white/80" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <span className="timecode-footer-readout text-sm font-medium text-[#A594F9]">
          Current: {localValue.toFixed(2)}s
        </span>
      </div>
    </div>
  );
}
