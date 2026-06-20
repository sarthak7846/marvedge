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
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setSegments: SegmentsSetter;
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

      setSegments((prev) =>
        prev.map((seg, i) => {
          if (i !== dragState.index) {
            return seg;
          }

          if (dragState.mode === "edge") {
            let newStart = seg.start;
            let newEnd = seg.end;

            if (dragState.side === "left") {
              newStart = dragState.startValue + deltaValue;

              if (newStart <= seg.end - 0.01) {
                newStart = Math.max(minValue, newStart);
              } else {
                const flippedStart = seg.end;
                const flippedEnd = Math.min(maxValue, newStart);
                newStart = flippedStart;
                newEnd = flippedEnd;

                setTimeout(() => {
                  setDragState((d) =>
                    d && d.mode === "edge"
                      ? {
                          ...d,
                          side: "right",
                          startValue: flippedEnd,
                          startX: e.clientX,
                        }
                      : d
                  );
                }, 0);
              }
            }

            if (dragState.side === "right") {
              newEnd = dragState.startValue + deltaValue;

              if (newEnd >= seg.start + 0.01) {
                newEnd = Math.min(maxValue, newEnd);
              } else {
                const flippedEnd = seg.start;
                const flippedStart = Math.max(minValue, newEnd);
                newStart = flippedStart;
                newEnd = flippedEnd;

                setTimeout(() => {
                  setDragState((d) =>
                    d && d.mode === "edge"
                      ? {
                          ...d,
                          side: "left",
                          startValue: flippedStart,
                          startX: e.clientX,
                        }
                      : d
                  );
                }, 0);
              }
            }

            return { ...seg, start: newStart, end: newEnd };
          }

          if (dragState.mode === "segment") {
            const width = dragState.endValue - dragState.startValue;

            let newStart = dragState.startValue + deltaValue;
            let newEnd = dragState.endValue + deltaValue;

            if (newStart < minValue) {
              newStart = minValue;
              newEnd = minValue + width;
            } else if (newEnd > maxValue) {
              newEnd = maxValue;
              newStart = maxValue - width;
            }

            return { ...seg, start: newStart, end: newEnd };
          }

          return seg;
        })
      );
    };

    const onUp = () => setDragState(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, maxValue, minValue, zoomedTimelineWidth, setSegments]);

  return { dragState, setDragState };
}

export function useZoomSegmentDrag({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setZoomSegments,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
}) {
  const [dragZoomState, setDragZoomState] = useState<DragZoomState | null>(null);

  useEffect(() => {
    if (!dragZoomState) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      let pendingFlip: null | {
        side: "left" | "right";
        startValue: number;
        startX: number;
      } = null;
      const deltaX = e.clientX - dragZoomState.startX;
      const pixelsPerUnit = zoomedTimelineWidth / (maxValue - minValue);
      const deltaValue = deltaX / pixelsPerUnit;

      setZoomSegments((prev) =>
        prev.map((seg, i) => {
          console.log("zoom", i, dragZoomState);
          if (i !== dragZoomState.index) {
            return seg;
          }

          if (dragZoomState.mode === "edge") {
            console.log("zoom runn in edge");
            let newStart = seg.startTime;
            let newEnd = seg.endTime;

            if (dragZoomState.side === "left") {
              newStart = dragZoomState.startValue + deltaValue;

              if (newStart <= seg.endTime - 0.01) {
                newStart = Math.max(minValue, newStart);
              } else {
                const flippedStart = seg.endTime;
                const flippedEnd = Math.min(maxValue, newStart);
                newStart = flippedStart;
                newEnd = flippedEnd;

                pendingFlip = {
                  side: "right",
                  startValue: flippedEnd,
                  startX: e.clientX,
                };
              }
            }

            if (dragZoomState.side === "right") {
              newEnd = dragZoomState.startValue + deltaValue;

              if (newEnd >= seg.startTime + 0.01) {
                newEnd = Math.min(maxValue, newEnd);
              } else {
                const flippedEnd = seg.startTime;
                const flippedStart = Math.max(minValue, newEnd);
                newStart = flippedStart;
                newEnd = flippedEnd;

                pendingFlip = {
                  side: "left",
                  startValue: flippedStart,
                  startX: e.clientX,
                };
              }
            }

            return { ...seg, startTime: newStart, endTime: newEnd };
          }

          if (dragZoomState.mode === "segment") {
            const width = dragZoomState.endValue - dragZoomState.startValue;

            let newStart = dragZoomState.startValue + deltaValue;
            let newEnd = dragZoomState.endValue + deltaValue;

            if (newStart < minValue) {
              newStart = minValue;
              newEnd = minValue + width;
            } else if (newEnd > maxValue) {
              newEnd = maxValue;
              newStart = maxValue - width;
            }

            return { ...seg, startTime: newStart, endTime: newEnd };
          }

          return seg;
        })
      );

      if (pendingFlip) {
        setDragZoomState((d) =>
          d && d.mode === "edge"
            ? {
                ...d,
                side: pendingFlip!.side,
                startValue: pendingFlip!.startValue,
                startX: pendingFlip!.startX,
              }
            : d
        );
      }
    };

    const onUp = () => setDragZoomState(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragZoomState, maxValue, minValue, setZoomSegments, zoomedTimelineWidth]);

  return { dragZoomState, setDragZoomState };
}

export function useTextOverlayDrag({
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setTextOverlays,
}: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
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

      setTextOverlays((prev) =>
        prev.map((t) => {
          if (t.id !== dragTextState.id) {
            return t;
          }

          if (dragTextState.mode === "edge") {
            let newStart = t.startTime;
            let newEnd = t.endTime;

            if (dragTextState.side === "left") {
              newStart = dragTextState.startValue + deltaValue;
              newStart = Math.max(minValue, Math.min(newStart, newEnd - 0.05));
            } else {
              newEnd = dragTextState.startValue + deltaValue;
              newEnd = Math.min(maxValue, Math.max(newEnd, newStart + 0.05));
            }

            return { ...t, startTime: newStart, endTime: newEnd };
          }

          if (dragTextState.mode === "segment") {
            const width = dragTextState.endValue - dragTextState.startValue;
            let newStart = dragTextState.startValue + deltaValue;
            let newEnd = dragTextState.endValue + deltaValue;

            if (newStart < minValue) {
              newStart = minValue;
              newEnd = minValue + width;
            } else if (newEnd > maxValue) {
              newEnd = maxValue;
              newStart = maxValue - width;
            }

            return { ...t, startTime: newStart, endTime: newEnd };
          }

          return t;
        })
      );
    };

    const onUp = () => setDragTextState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragTextState, maxValue, minValue, setTextOverlays, zoomedTimelineWidth]);

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
