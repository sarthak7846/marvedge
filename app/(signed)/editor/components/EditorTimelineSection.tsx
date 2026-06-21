import React from "react";

import TimelineRuler from "@/app/components/TimeLine";
import type { EditorState, TextOverlaysApi, ZoomEditorApi } from "../apiTypes";

type EditorMode = "main" | "trim" | "zoom" | "text";

interface EditorTimelineSectionProps {
  editorState: EditorState;
  zoom: ZoomEditorApi;
  text: TextOverlaysApi;
  resolvedDuration: number;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  mode: EditorMode;
  setMode: React.Dispatch<React.SetStateAction<EditorMode>>;
  segments: { start: number; end: number }[];
  setSegments: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>;
  processing: boolean;
  handleResetTimeline: () => void;
  handleTimelineChange: (start: number, end: number) => void;
  setChildHandleProgress: (handler: null | ((data: { playedSeconds: number }) => void)) => void;
  lastInteractionRef: React.RefObject<number>;
  isDraggingTimelineRef: React.RefObject<boolean>;
}

export default function EditorTimelineSection({
  editorState,
  zoom,
  text,
  resolvedDuration,
  playbackSpeed,
  setPlaybackSpeed,
  mode,
  setMode,
  segments,
  setSegments,
  processing,
  handleResetTimeline,
  handleTimelineChange,
  setChildHandleProgress,
  lastInteractionRef,
  isDraggingTimelineRef,
}: EditorTimelineSectionProps) {
  const {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    playerRef,
    timelineStartTime,
    timelineEndTime,
    setTimelineStartTime,
    setTimelineEndTime,
  } = editorState;

  if (resolvedDuration <= 0) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="relative h-32 bg-white border-2 border-[#A594F9] rounded-lg flex items-center justify-center">
          <span className="text-[#A594F9] font-medium">Loading timeline...</span>
        </div>
      </div>
    );
  }

  return (
    <TimelineRuler
      minValue={0}
      maxValue={resolvedDuration}
      currentValue={Math.max(0, currentTime)}
      playbackSpeed={playbackSpeed}
      setPlaybackSpeed={setPlaybackSpeed}
      onValueChange={(value) => {
        lastInteractionRef.current = Date.now();
        const safeDuration = Number.isFinite(resolvedDuration) ? Math.max(0, resolvedDuration) : 0;
        const safeValue = Number.isFinite(value) ? value : 0;
        const clampedValue = Math.max(0, Math.min(safeDuration, safeValue));
        setCurrentTime(clampedValue);

        if (!isDraggingTimelineRef.current && Number.isFinite(clampedValue)) {
          playerRef.current?.seekTo(clampedValue, "seconds");
        }
      }}
      step={0.1}
      majorStep={20}
      minorStep={5}
      microStep={1}
      startTime={timelineStartTime}
      endTime={timelineEndTime}
      onStartTimeChange={(value) => {
        setTimelineStartTime(value);
        handleTimelineChange(value, timelineEndTime);
      }}
      onEndTimeChange={(value) => {
        setTimelineEndTime(value);
        handleTimelineChange(timelineStartTime, value);
      }}
      processing={processing}
      onResetVideo={handleResetTimeline}
      playing={playing}
      setPlaying={setPlaying}
      mode={mode}
      setMode={setMode}
      playerRef={playerRef}
      setChildHandleProgress={setChildHandleProgress}
      zoomSegments={zoom.zoomSegments}
      setZoomSegments={zoom.setZoomSegments}
      activeZoomIdx={zoom.activeZoomIdx}
      setActiveZoomIdx={zoom.setActiveZoomIdx}
      zoomLevelDepth={zoom.zoomLevel}
      segments={segments}
      setSegments={setSegments}
      textOverlays={text.textOverlays}
      setTextOverlays={text.setTextOverlays}
      selectedTextOverlayId={text.selectedTextOverlayId}
      setSelectedTextOverlayId={text.setSelectedTextOverlayId}
      setTextOverlayInspectorValues={(overlay) => {
        text.setTextOverlayInput(overlay.text);
        text.setTextOverlayFontFamily(overlay.fontFamily);
        text.setTextOverlayFontSize(overlay.fontSize);
        text.setTextOverlayColor(overlay.color);
      }}
      isDraggingTimelineRef={isDraggingTimelineRef}
    />
  );
}
