import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";

type TrimSegment = { start: number; end: number };

export function useSvgWidth(svgRef: React.RefObject<SVGSVGElement | null>) {
  const [svgWidth, setSvgWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (svgRef.current) {
        setSvgWidth(svgRef.current.getBoundingClientRect().width);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [svgRef]);

  return { svgWidth };
}

export function useTimelineSliderDrag({
  svgRef,
  start,
  end,
  duration,
  xToTime,
  updateSegment,
  onTimeChange,
  setCurrentTime,
  playerRef,
  onExternalTimeChange,
  activeIdx,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  start: number;
  end: number;
  duration: number;
  xToTime: (x: number) => number;
  updateSegment: (key: "start" | "end", value: number) => void;
  onTimeChange?: (time: number) => void;
  setCurrentTime: (t: number) => void;
  playerRef: React.RefObject<ReactPlayer | null>;
  onExternalTimeChange?: (start: number, end: number) => void;
  activeIdx: number;
}) {
  const [dragging, setDragging] = useState<null | "start" | "end">(null);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    // console.log("Dragging started:", dragging);

    const onMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      if (e instanceof MouseEvent) {
        clientX = e.clientX;
      } else if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
      }
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const x = clientX - rect.left;
      let newTime = xToTime(x);
      newTime = Math.max(0, Math.min(duration || 80.0, newTime));

      if (dragging === "start") {
        if (newTime >= end) {
          newTime = end - 0.01;
        }
        updateSegment("start", newTime);
        onTimeChange?.(newTime);
        setCurrentTime(newTime);
        // Force immediate video frame update during dragging
        if (playerRef?.current) {
          const player = playerRef.current.getInternalPlayer();
          if (player) {
            // Set time directly and force a frame update
            player.currentTime = newTime;
            // Force the video to update by triggering a seek event
            player.dispatchEvent(new Event("seeking"));
          }
        }

        // Always notify parent
        if (onExternalTimeChange) {
          onExternalTimeChange(newTime, end);
        }
      } else if (dragging === "end") {
        if (newTime <= start) {
          newTime = start + 0.01;
        }
        updateSegment("end", newTime);
        onTimeChange?.(newTime);
        setCurrentTime(newTime);
        // Force immediate video frame update during dragging
        if (playerRef?.current) {
          const player = playerRef.current.getInternalPlayer();
          if (player) {
            // Set time directly and force a frame update
            player.currentTime = newTime;
            // Force the video to update by triggering a seek event
            player.dispatchEvent(new Event("seeking"));
          }
        }

        // Always notify parent
        if (onExternalTimeChange) {
          onExternalTimeChange(start, newTime);
        }
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [
    dragging,
    start,
    end,
    duration,
    onTimeChange,
    playerRef,
    setCurrentTime,
    xToTime,
    updateSegment,
    activeIdx,
    onExternalTimeChange,
    svgRef,
  ]);

  return { dragging, setDragging };
}

export function useSegmentReorder({
  segments,
  setSegments,
  activeIdx,
  setActiveIdx,
}: {
  segments: TrimSegment[];
  setSegments: React.Dispatch<React.SetStateAction<TrimSegment[]>>;
  activeIdx: number;
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseStartPos, setMouseStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    // console.log("Drag start:", index);
    setDragIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", index.toString());
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 10, 10);
    }
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    // console.log("Drop:", dragIndex, "to", dropIndex);
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      setIsDragging(false);
      return;
    }

    const newSegments = [...segments];
    const draggedSegment = newSegments[dragIndex];
    newSegments.splice(dragIndex, 1);
    newSegments.splice(dropIndex, 0, draggedSegment);

    setSegments(newSegments);

    if (activeIdx === dragIndex) {
      setActiveIdx(dropIndex);
    } else if (activeIdx > dragIndex && activeIdx <= dropIndex) {
      setActiveIdx(activeIdx - 1);
    } else if (activeIdx < dragIndex && activeIdx >= dropIndex) {
      setActiveIdx(activeIdx + 1);
    }

    setDragIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    // console.log("Drag end");
    setDragIndex(null);
    setDragOverIndex(null);
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (mouseStartPos && !isDragging) {
      const deltaX = Math.abs(e.clientX - mouseStartPos.x);
      const deltaY = Math.abs(e.clientY - mouseStartPos.y);
      if (deltaX > 5 || deltaY > 5) {
        // console.log("Mouse drag start:", index);
        setDragIndex(index);
        setIsDragging(true);
        setMouseStartPos(null);
      }
    }
  };

  const handleMouseUp = () => {
    setMouseStartPos(null);
  };

  return {
    dragIndex,
    dragOverIndex,
    isDragging,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

export function useTimelineKeyboard({
  processing,
  currentTime,
  setCurrentTime,
  duration,
  playerRef,
  updateSegment,
  start,
  end,
  handleTrim,
  handleUndo,
  handleRedo,
}: {
  processing: boolean;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  duration: number;
  playerRef: React.RefObject<ReactPlayer | null>;
  updateSegment: (key: "start" | "end", value: number) => void;
  start: number;
  end: number;
  handleTrim: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (processing) {
        return;
      }
      switch (e.key) {
        case "ArrowLeft":
          const newTimeLeft = Math.max(0, currentTime - 1);
          setCurrentTime(newTimeLeft);

          // Force immediate video frame update
          if (playerRef?.current) {
            const player = playerRef.current.getInternalPlayer();
            if (player) {
              // Set time directly and force a frame update
              player.currentTime = newTimeLeft;
              // Force the video to update by triggering a seek event
              player.dispatchEvent(new Event("seeking"));
              playerRef.current.seekTo(newTimeLeft, "seconds");
            }
          }
          break;
        case "ArrowRight":
          const newTimeRight = Math.min(duration, currentTime + 1);
          setCurrentTime(newTimeRight);

          // Force immediate video frame update
          if (playerRef?.current) {
            const player = playerRef.current.getInternalPlayer();
            if (player) {
              // Set time directly and force a frame update
              player.currentTime = newTimeRight;
              // Force the video to update by triggering a seek event
              player.dispatchEvent(new Event("seeking"));
              playerRef.current.seekTo(newTimeRight, "seconds");
            }
          }
          break;
        case "[":
          updateSegment("start", Math.max(0, start - 1));
          break;
        case "]":
          updateSegment("end", Math.min(duration || 80.0, end + 1));
          break;
        case "Enter":
          handleTrim();
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRedo();
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    duration,
    processing,
    playerRef,
    handleTrim,
    end,
    start,
    currentTime,
    setCurrentTime,
    updateSegment,
    handleUndo,
    handleRedo,
  ]);
}
