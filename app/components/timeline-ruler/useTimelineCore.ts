import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { EditorAction } from "./types";

type TrimSegment = { start: number; end: number };
type TimelineMode = "main" | "trim" | "zoom" | "text";

export function usePlayhead({
  rulerRef,
  minValue,
  maxValue,
  currentValue,
  onValueChange,
  playerRef,
  setPlaying,
  isDraggingTimelineRef,
}: {
  rulerRef: React.RefObject<HTMLDivElement | null>;
  minValue: number;
  maxValue: number;
  currentValue: number;
  onValueChange?: (value: number) => void;
  playerRef: React.RefObject<ReactPlayer>;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isDraggingTimelineRef: React.MutableRefObject<boolean>;
}) {
  const [localValue, setLocalValue] = useState(currentValue || 0);
  const localValueRef = useRef(localValue);
  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const isUpdatingFromPropRef = useRef(false);
  const lastSeekTimeRef = useRef<number>(0);
  const [draggingCurrentTime, setDraggingCurrentTime] = useState(false);

  useEffect(() => {
    if (isDraggingTimelineRef.current) {
      return;
    }
    isUpdatingFromPropRef.current = true;
    setLocalValue(currentValue);
  }, [currentValue, isDraggingTimelineRef]);

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
    [minValue, maxValue, rulerRef]
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

  useEffect(() => {
    if (isUpdatingFromPropRef.current) {
      isUpdatingFromPropRef.current = false;
      return;
    }
    onValueChangeRef.current?.(localValue);
  }, [localValue]);

  return {
    localValue,
    setLocalValue,
    localValueRef,
    lastSeekTimeRef,
    updateCurrentTimeFromMouse,
    draggingCurrentTime,
    setDraggingCurrentTime,
  };
}

export function useTimelineZoom({
  rulerRef,
  scrollContainerRef,
  baseTimelineWidth,
}: {
  rulerRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  baseTimelineWidth: number;
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);

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
  }, [zoomLevel, baseTimelineWidth, scrollLeft, scrollContainerRef]);

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
  }, [baseTimelineWidth, rulerRef, scrollContainerRef]);

  return { zoomLevel, setZoomLevel, scrollLeft, setScrollLeft };
}

export function useTrimSelection({
  segments,
  startTime,
  endTime,
  minValue,
  maxValue,
  setLocalValue,
}: {
  segments: TrimSegment[];
  startTime?: number;
  endTime?: number;
  minValue: number;
  maxValue: number;
  setLocalValue: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [localStartTime, setLocalStartTime] = useState(startTime ?? minValue);
  const [localEndTime, setLocalEndTime] = useState(endTime ?? maxValue);
  const [activeSegment, setActiveSegment] = useState<number>(-1);
  const [playheadMode, setPlayheadMode] = useState<"trim" | "non-trim">("non-trim");
  const [selectedTrimIdx, setSelectedTrimIdx] = useState<number | null>(null);

  const segmentsRef = useRef(segments);
  const playheadModeRef = useRef(playheadMode);
  const selectedTrimIdxRef = useRef(selectedTrimIdx);

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
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    playheadModeRef.current = playheadMode;
  }, [playheadMode]);

  useEffect(() => {
    selectedTrimIdxRef.current = selectedTrimIdx;
  }, [selectedTrimIdx]);

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

  return {
    localStartTime,
    setLocalStartTime,
    localEndTime,
    setLocalEndTime,
    activeSegment,
    setActiveSegment,
    playheadMode,
    selectedTrimIdx,
    switchToTrimMode,
    switchToNonTrimMode,
  };
}

export function useTimelineHistory({
  segments,
  setSegments,
  setZoomSegments,
  switchToNonTrimMode,
}: {
  segments: TrimSegment[];
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  switchToNonTrimMode: () => void;
}) {
  const [undoStack, setUndoStack] = useState<EditorAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditorAction[]>([]);

  const pushAction = useCallback((action: EditorAction) => {
    setUndoStack((prev) => [...prev, action]);
    setRedoStack([]);
  }, []);

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

  return { undoStack, redoStack, pushAction, handleUndo, handleRedo };
}

export function useTimelineProgress({
  playerRef,
  mode,
  segments,
  activeSegment,
  isDraggingTimelineRef,
  setChildHandleProgress,
  lastSeekTimeRef,
}: {
  playerRef: React.RefObject<ReactPlayer>;
  mode: TimelineMode;
  segments: TrimSegment[];
  activeSegment: number;
  isDraggingTimelineRef: React.MutableRefObject<boolean>;
  setChildHandleProgress: (fn: (data: { playedSeconds: number }) => void) => void;
  lastSeekTimeRef: React.MutableRefObject<number>;
}) {
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
    [playerRef, mode, segments, activeSegment, isDraggingTimelineRef, lastSeekTimeRef]
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
}
