import React from "react";
import ReactPlayer from "react-player";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { EditorAction, TextOverlayItem } from "./types";

type TrimSegment = { start: number; end: number };
type TimelineMode = "main" | "trim" | "zoom" | "text";
type NumberSetter = React.Dispatch<React.SetStateAction<number>>;

export function useTrimActions({
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
}: {
  segments: TrimSegment[];
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  activeSegment: number;
  setActiveSegment: NumberSetter;
  setLocalStartTime: NumberSetter;
  setLocalEndTime: NumberSetter;
  switchToNonTrimMode: () => void;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  setSelectedTextOverlayId: React.Dispatch<React.SetStateAction<string | null>>;
  setMode: React.Dispatch<React.SetStateAction<TimelineMode>>;
  setActiveZoomIdx: NumberSetter;
  localValue: number;
  minValue: number;
  maxValue: number;
  playerRef: React.RefObject<ReactPlayer>;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  updateCurrentTimeFromMouse: (e: MouseEvent | React.MouseEvent) => void;
  pushAction: (action: EditorAction) => void;
}) {
  const FIXED_TRIM_DURATION = 4;

  const removeSegment = (idx: number) => {
    const removed = segments[idx];

    pushAction({ type: "remove-trim", segment: removed, index: idx });

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

  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    setSelectedTextOverlayId(null);
    setMode("main");
  };

  const handleSmartTrim = async () => {
    const currentTime = localValue;
    const startTime = Math.max(minValue, currentTime);
    const endTime = Math.min(maxValue, currentTime + FIXED_TRIM_DURATION);

    const newSegment = { start: startTime, end: endTime };

    pushAction({ type: "add-trim", segment: newSegment });

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

  return { removeSegment, removeTextOverlay, handleSmartTrim, playTrimSegment };
}

export function useZoomActions({
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
}: {
  zoomSegments: ZoomEffect[];
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  setActiveZoomIdx: NumberSetter;
  setActiveSegment: NumberSetter;
  setMode: React.Dispatch<React.SetStateAction<TimelineMode>>;
  localValue: number;
  maxValue: number;
  zoomLevelDepth: number;
  setLocalStartTime: NumberSetter;
  setLocalEndTime: NumberSetter;
  playerRef: React.RefObject<ReactPlayer>;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  updateCurrentTimeFromMouse: (e: MouseEvent | React.MouseEvent) => void;
  pushAction: (action: EditorAction) => void;
}) {
  const removeZoomSegment = (idx: number) => {
    const removed = zoomSegments[idx];
    pushAction({ type: "remove-zoom", segment: removed, index: idx });
    setZoomSegments((prev) => prev.filter((_, i) => i !== idx));
    setActiveZoomIdx(-1);
    if (zoomSegments.length <= 1) {
      setMode("main");
    }
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

    pushAction({ type: "add-zoom", segment: newSegment });

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

  return { removeZoomSegment, playZoomSegment, handleZoomClick };
}
