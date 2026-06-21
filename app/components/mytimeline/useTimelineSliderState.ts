import React, { useCallback, useState, useEffect } from "react";
import { defaultFormatTime } from "@/app/lib/dateTimeUtils";
import { toggleZoom } from "../../lib/utils";
import { convertTimeStringToSeconds } from "./constants";
import { TimelineSliderProps, TrimSegment } from "./types";

function useTimelineSliderEffects({
  duration,
  initialSegments,
  setSegments,
  segments,
  onSegmentsChange,
  timeFormatter,
  progress,
  setProgress,
  removedSegments,
}: {
  duration: number;
  initialSegments?: { start: string; end: string }[];
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  segments: TrimSegment[];
  onSegmentsChange?: (segments: { start: string; end: string }[]) => void;
  timeFormatter: (seconds: number) => string;
  progress: number;
  setProgress?: (progress: number) => void;
  removedSegments: TrimSegment[];
}) {
  useEffect(() => {
    if (setProgress) {
      setProgress(progress);
    }
  }, [progress, setProgress]);

  useEffect(() => {
    console.log(
      "Current state - segments:",
      segments.length,
      "removedSegments:",
      removedSegments.length
    );
    console.log("Segments:", segments);
  }, [segments.length, removedSegments.length, segments]);

  useEffect(() => {
    console.log(
      "Current state - segments:",
      segments.length,
      "removedSegments:",
      removedSegments.length
    );
    console.log("Segments:", segments);
  }, [segments.length, removedSegments.length, segments]);

  // Update segments when duration changes or when initialSegments are provided
  useEffect(() => {
    if (duration > 0) {
      if (initialSegments && initialSegments.length > 0) {
        // Convert time string format to numbers for internal use
        const convertedSegments = initialSegments.map((seg) => {
          const startSeconds = convertTimeStringToSeconds(seg.start);
          const endSeconds = convertTimeStringToSeconds(seg.end);
          return {
            start: startSeconds,
            end: endSeconds,
          };
        });
        setSegments(convertedSegments);
      } else {
        setSegments((prev) => {
          const updated = [...prev];
          updated[0] = { start: 0, end: duration };
          return updated;
        });
      }
    }
  }, [duration, initialSegments, setSegments]);

  // Call onSegmentsChange when segments change
  useEffect(() => {
    if (onSegmentsChange) {
      const formattedSegments = segments.map((seg) => ({
        start: timeFormatter(seg.start),
        end: timeFormatter(seg.end),
      }));
      onSegmentsChange(formattedSegments);
    }
  }, [segments, onSegmentsChange, timeFormatter]);
}

export function useSegmentsCore(props: TimelineSliderProps) {
  const {
    duration,
    formatTime,
    ontrim,
    onZoomEffectCreate,
    currentTime,
    initialSegments,
    onSegmentsChange,
    setProgress,
  } = props;

  const [segments, setSegments] = useState<TrimSegment[]>([
    { start: 0, end: duration || 80.0 }, // Dynamic end based on duration
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomed, setzoomed] = useState(false);
  const [progress] = useState(0);
  const [removedSegments, setRemovedSegments] = useState<TrimSegment[]>([]);
  const [removedActiveIdx, setRemovedActiveIdx] = useState<number[]>([]);
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false);

  const timeFormatter = formatTime || defaultFormatTime;

  const handleToggleZoom = useCallback(() => {
    toggleZoom(onZoomEffectCreate, currentTime, duration || 80.0, setzoomed);
  }, [onZoomEffectCreate, currentTime, duration, setzoomed]);

  const handleTrim = useCallback(() => {
    if (isNaN(duration) || duration === 0) {
      alert("Video duration not loaded yet.");
      return;
    }
    if (segments.some((seg) => seg.start >= seg.end)) {
      alert("Invalid trim range in one or more segments.");
      return;
    }
    ontrim(
      segments.map((seg) => ({
        start: timeFormatter(seg.start),
        end: timeFormatter(seg.end),
      }))
    );
    setHasBeenTrimmed(true);
  }, [segments, duration, ontrim, timeFormatter]);

  const updateSegment = useCallback(
    (key: "start" | "end", value: number) => {
      setSegments((segs) => {
        const updated = segs.map((seg, i) => (i === activeIdx ? { ...seg, [key]: value } : seg));
        return updated;
      });
    },
    [activeIdx]
  );

  const start = segments[activeIdx]?.start ?? 0;
  const end = segments[activeIdx]?.end ?? (duration || 80.0);

  const handleUndo = useCallback(() => {
    if (segments.length > 1) {
      const lastSegment = segments[segments.length - 1];
      setRemovedSegments((prev) => [...prev, lastSegment]);
      setRemovedActiveIdx((prev) => [...prev, activeIdx]);
      setSegments((prev) => prev.slice(0, -1));
      setActiveIdx(Math.min(activeIdx, segments.length - 2));
    }
  }, [segments, activeIdx, setRemovedSegments, setRemovedActiveIdx, setSegments, setActiveIdx]);

  const handleRedo = useCallback(() => {
    if (removedSegments.length > 0) {
      const segmentToRestore = removedSegments[removedSegments.length - 1];
      const activeIdxToRestore = removedActiveIdx[removedActiveIdx.length - 1];
      setSegments((prev) => [...prev, segmentToRestore]);
      setActiveIdx(activeIdxToRestore);
      setRemovedSegments((prev) => prev.slice(0, -1));
      setRemovedActiveIdx((prev) => prev.slice(0, -1));
    }
  }, [
    removedSegments,
    removedActiveIdx,
    setSegments,
    setActiveIdx,
    setRemovedSegments,
    setRemovedActiveIdx,
  ]);

  const addSegment = () => {
    setSegments([...segments, { start: 0, end: duration || 80.0 }]);
    setActiveIdx(segments.length);
  };

  const removeSegment = (idx: number) => {
    if (segments.length > 1) {
      const newSegments = segments.filter((_, i) => i !== idx);
      setSegments(newSegments);
      setActiveIdx(Math.min(activeIdx, newSegments.length - 1));
    }
  };

  useTimelineSliderEffects({
    duration,
    initialSegments,
    setSegments,
    segments,
    onSegmentsChange,
    timeFormatter,
    progress,
    setProgress,
    removedSegments,
  });

  return {
    segments,
    setSegments,
    activeIdx,
    setActiveIdx,
    zoomed,
    removedSegments,
    hasBeenTrimmed,
    timeFormatter,
    handleToggleZoom,
    handleTrim,
    updateSegment,
    start,
    end,
    progress,
    handleUndo,
    handleRedo,
    addSegment,
    removeSegment,
  };
}
