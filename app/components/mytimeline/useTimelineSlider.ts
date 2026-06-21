import React, { useRef, useCallback } from "react";
import { MARGIN } from "./constants";
import { TimelineSliderProps } from "./types";
import { useSegmentsCore } from "./useTimelineSliderState";
import {
  useSvgWidth,
  useTimelineSliderDrag,
  useSegmentReorder,
  useTimelineKeyboard,
} from "./useMyTimelineHooks";

function useTimelineSliderGeometry(
  props: TimelineSliderProps,
  core: ReturnType<typeof useSegmentsCore>,
  svgRef: React.RefObject<SVGSVGElement | null>,
  svgWidth: number
) {
  const { duration, onTimeChange, setCurrentTime, playerRef, onExternalTimeChange, processing } =
    props;
  const currentTime = props.currentTime;
  const { start, end, activeIdx, updateSegment, handleTrim, handleUndo, handleRedo } = core;

  const xToTime = useCallback(
    (x: number) => {
      const clamped = Math.max(MARGIN, Math.min(svgWidth - MARGIN, x));
      return ((clamped - MARGIN) / (svgWidth - 2 * MARGIN)) * (duration || 80.0);
    },
    [duration, svgWidth]
  );

  const handleTimelineClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const x = e.clientX - rect.left;
    let seekTime = xToTime(x);
    seekTime = Math.max(0, Math.min(duration || 80.0, seekTime));
    playerRef?.current?.seekTo(seekTime, "seconds");
    setCurrentTime(seekTime);

    // Force immediate video frame update
    if (playerRef?.current) {
      const player = playerRef.current.getInternalPlayer();
      if (player) {
        // Set time directly and force a frame update
        player.currentTime = seekTime;
        // Force the video to update by triggering a seek event
        player.dispatchEvent(new Event("seeking"));
        playerRef.current.seekTo(seekTime, "seconds");
      }
    }
  };

  const { dragging, setDragging } = useTimelineSliderDrag({
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
  });

  useTimelineKeyboard({
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
  });

  return { xToTime, handleTimelineClick, dragging, setDragging };
}

export function useTimelineSlider(props: TimelineSliderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { svgWidth } = useSvgWidth(svgRef);
  const core = useSegmentsCore(props);
  const geometry = useTimelineSliderGeometry(props, core, svgRef, svgWidth);
  const reorder = useSegmentReorder({
    segments: core.segments,
    setSegments: core.setSegments,
    activeIdx: core.activeIdx,
    setActiveIdx: core.setActiveIdx,
  });

  return { svgRef, svgWidth, ...core, ...geometry, ...reorder };
}

export type TimelineSliderVm = ReturnType<typeof useTimelineSlider>;
