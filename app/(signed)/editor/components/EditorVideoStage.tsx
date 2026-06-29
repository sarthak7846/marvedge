import React from "react";

import SubtitleOverlay from "./SubtitleOverlay";
import TextOverlayLayer from "./TextOverlayLayer";
import VideoPreviewPlayer from "./VideoPreviewPlayer";
import ZoomFocusOverlay from "./ZoomFocusOverlay";
import type { EditorState, SubtitlesApi, TextOverlaysApi, ZoomEditorApi } from "../apiTypes";

type EditorMode = "main" | "trim" | "zoom" | "text";

interface EditorVideoStageProps {
  editorState: EditorState;
  text: TextOverlaysApi;
  zoom: ZoomEditorApi;
  subtitles: SubtitlesApi;
  hasCanvasBackground: boolean;
  previewObjectFit: "contain";
  playbackSpeed: number;
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  setMode: React.Dispatch<React.SetStateAction<EditorMode>>;
  childHandleProgress: null | ((data: { playedSeconds: number }) => void);
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  lastInteractionRef: React.RefObject<number>;
  isDraggingTimelineRef: React.RefObject<boolean>;
}

export default function EditorVideoStage({
  editorState,
  text,
  zoom,
  subtitles,
  hasCanvasBackground,
  previewObjectFit,
  playbackSpeed,
  handleMouseDown,
  handleMouseUp,
  setMode,
  childHandleProgress,
  zoomFocusStageRef,
  lastInteractionRef,
  isDraggingTimelineRef,
}: EditorVideoStageProps) {
  const { videoUrl, playing, volume, tool, canvasRef, playerRef, currentTime, duration } =
    editorState;
  const { isDraggingZoomTarget, handleZoomTargetMouseDown, preview } = zoom;
  const {
    shouldApplyZoomPreview,
    previewZoomScale,
    zoomTranslateX,
    zoomTranslateY,
    shouldShowZoomFocusBox,
    activeEditedZoomSegment,
    zoomFocusSizePct,
  } = preview;

  return (
    <div
      ref={zoomFocusStageRef}
      className="relative w-full flex-1 min-h-0"
      style={{
        borderRadius: "1.25rem",
        overflow: "hidden",
      }}
    >
      <div
        className="absolute inset-0 z-10"
        style={{
          transform: shouldApplyZoomPreview
            ? `scale(${previewZoomScale}) translate(-${zoomTranslateX}%, -${zoomTranslateY}%)`
            : "scale(1)",
          transformOrigin: "0% 0%",
          transition: isDraggingZoomTarget ? "none" : "transform 0.4s ease",
          backgroundColor: hasCanvasBackground ? "#F1ECFF" : "#000000",
        }}
      >
        <VideoPreviewPlayer
          videoUrl={videoUrl}
          playerRef={playerRef}
          playing={playing}
          volume={volume}
          playbackSpeed={playbackSpeed}
          previewObjectFit={previewObjectFit}
          hasCanvasBackground={hasCanvasBackground}
          isDraggingTimelineRef={isDraggingTimelineRef}
          lastInteractionRef={lastInteractionRef}
          setCurrentTime={editorState.setCurrentTime}
          childHandleProgress={childHandleProgress}
          setDuration={editorState.setDuration}
          setPlaying={editorState.setPlaying}
          duration={duration}
        />
      </div>

      <SubtitleOverlay text={subtitles.activeSubtitleText} />

      {shouldShowZoomFocusBox && activeEditedZoomSegment && (
        <ZoomFocusOverlay
          activeEditedZoomSegment={activeEditedZoomSegment}
          isDraggingZoomTarget={isDraggingZoomTarget}
          zoomFocusSizePct={zoomFocusSizePct}
          onMouseDown={handleZoomTargetMouseDown}
        />
      )}

      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full ${
          tool !== "none" ? "z-40 cursor-crosshair" : "z-0 cursor-default"
        }`}
        onMouseDown={tool !== "none" ? handleMouseDown : undefined}
        onMouseUp={tool !== "none" ? handleMouseUp : undefined}
        style={{
          pointerEvents: tool !== "none" ? "auto" : "none",
          borderRadius: "1.25rem",
        }}
      />

      <TextOverlayLayer
        text={text}
        currentTime={currentTime}
        videoUrl={videoUrl}
        tool={tool}
        shouldShowZoomFocusBox={shouldShowZoomFocusBox}
        zoomFocusStageRef={zoomFocusStageRef}
        setMode={setMode}
      />
    </div>
  );
}
