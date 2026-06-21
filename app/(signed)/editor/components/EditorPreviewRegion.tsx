import React from "react";

import CustomVideoControls from "@/app/components/CustomVideoControls";
import EditorTimelineSection from "./EditorTimelineSection";
import EditorVideoStage from "./EditorVideoStage";
import TextColorToolbar from "./TextColorToolbar";
import { computePreviewLayout } from "../utils/previewLayout";
import type { EditorState, SubtitlesApi, TextOverlaysApi, ZoomEditorApi } from "../apiTypes";

type EditorMode = "main" | "trim" | "zoom" | "text";

interface EditorPreviewRegionProps {
  editorState: EditorState;
  text: TextOverlaysApi;
  zoom: ZoomEditorApi;
  subtitles: SubtitlesApi;
  isDark: boolean;
  processing: boolean;
  nativeAspectRatio: string;
  resolvedDuration: number;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  mode: EditorMode;
  setMode: React.Dispatch<React.SetStateAction<EditorMode>>;
  segments: { start: number; end: number }[];
  setSegments: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>;
  childHandleProgress: null | ((data: { playedSeconds: number }) => void);
  setChildHandleProgress: (handler: null | ((data: { playedSeconds: number }) => void)) => void;
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleFullscreen: () => void;
  getBackgroundStyle: () => React.CSSProperties;
  handleTimelineChange: (start: number, end: number) => void;
  handleResetTimeline: () => void;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
  lastInteractionRef: React.RefObject<number>;
  isDraggingTimelineRef: React.RefObject<boolean>;
}

export default function EditorPreviewRegion(props: EditorPreviewRegionProps) {
  const { editorState, text, zoom, subtitles, isDark, processing, nativeAspectRatio } = props;
  const { resolvedDuration, playbackSpeed, setPlaybackSpeed, mode, setMode } = props;
  const { segments, setSegments, childHandleProgress, setChildHandleProgress } = props;
  const { handleMouseDown, handleMouseUp, handleFullscreen, getBackgroundStyle } = props;
  const { handleTimelineChange, handleResetTimeline } = props;
  const { zoomFocusStageRef, lastInteractionRef, isDraggingTimelineRef } = props;
  const { videoUrl, selectedBackground, isFullscreen, tool, playerRef } = editorState;

  const layout = computePreviewLayout({
    selectedBackground,
    aspectRatio: editorState.aspectRatio,
    nativeAspectRatio,
    browserFrameDrawBorder: editorState.browserFrameDrawBorder,
    browserFrameDrawShadow: editorState.browserFrameDrawShadow,
    isFullscreen,
  });
  const { hasCanvasBackground, previewObjectFit, previewFrameAspectRatio } = layout;
  const { browserFrameBorder, browserFrameShadow, stageHeight, stageMaxWidth } = layout;

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="mt-3" />

      <div className="flex flex-col items-center w-full max-w-[1200px] mx-auto rounded-2xl bg-transparent">
        <div
          ref={editorState.videoContainerRef}
          className={`monitor-viewport relative w-full max-w-[1120px] sm:h-auto rounded-2xl border ${
            isFullscreen ? "border-[#7C5CFC] shadow-lg" : "border-[#E6E1FA]"
          } flex flex-col items-center justify-center mb-1 transition-all duration-300`}
          style={{
            aspectRatio: "16 / 9",
            minHeight: "160px",
            padding: `${layout.stageContainerPadY}px ${selectedBackground ? "0px" : "5px"}`,
            boxShadow: "0 4px 24px 0 #E6E1FA",
            ...getBackgroundStyle(),
          }}
        >
          <div
            className="editor-video-card"
            style={{
              width: "auto",
              aspectRatio: previewFrameAspectRatio,
              height: stageHeight,
              maxWidth: stageMaxWidth,
              margin: "0 auto",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              borderRadius: "1.25rem",
              overflow: "hidden",
              background: isDark
                ? `${hasCanvasBackground ? "linear-gradient(#F6F3FF, #F6F3FF)" : "linear-gradient(#000000, #000000)"} padding-box, linear-gradient(135deg, #6c4cff, #8b73ff) border-box`
                : hasCanvasBackground
                  ? "#F6F3FF"
                  : "#000000",
              border: isDark ? "1px solid transparent" : browserFrameBorder,
              boxShadow: isDark
                ? "0 0 30px rgba(62, 47, 217, 0.25), 0 10px 40px rgba(0, 0, 0, 0.7)"
                : browserFrameShadow,
              transition: "width 0.3s ease, height 0.3s ease",
            }}
          >
            <EditorVideoStage
              editorState={editorState}
              text={text}
              zoom={zoom}
              subtitles={subtitles}
              hasCanvasBackground={hasCanvasBackground}
              previewObjectFit={previewObjectFit}
              playbackSpeed={playbackSpeed}
              handleMouseDown={handleMouseDown}
              handleMouseUp={handleMouseUp}
              setMode={setMode}
              childHandleProgress={childHandleProgress}
              zoomFocusStageRef={zoomFocusStageRef}
              lastInteractionRef={lastInteractionRef}
              isDraggingTimelineRef={isDraggingTimelineRef}
            />
          </div>

          {videoUrl && (
            <div className="w-full flex flex-col gap-3 mt-5">
              <CustomVideoControls
                playerRef={playerRef}
                duration={resolvedDuration}
                currentTime={editorState.currentTime}
                setCurrentTime={(t) => {
                  lastInteractionRef.current = Date.now();
                  editorState.setCurrentTime(t);
                  playerRef.current?.seekTo(t, "seconds");
                }}
                setPlaying={editorState.setPlaying}
                playing={editorState.playing}
                volume={editorState.volume}
                setVolume={editorState.setVolume}
                playbackSpeed={playbackSpeed}
                handleFullscreen={handleFullscreen}
              />
            </div>
          )}
        </div>
      </div>
      {tool === "text" && (
        <TextColorToolbar
          textColor={editorState.textColor}
          setTextColor={editorState.setTextColor}
          textFont={editorState.textFont}
          setTextFont={editorState.setTextFont}
        />
      )}

      {videoUrl && (
        <div className="mr-2 mt-8 mb-5 pr-8 sm:mr-0 mx-4 sm:mx-8">
          <EditorTimelineSection
            editorState={editorState}
            zoom={zoom}
            text={text}
            resolvedDuration={resolvedDuration}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            mode={mode}
            setMode={setMode}
            segments={segments}
            setSegments={setSegments}
            processing={processing}
            handleResetTimeline={handleResetTimeline}
            handleTimelineChange={handleTimelineChange}
            setChildHandleProgress={setChildHandleProgress}
            lastInteractionRef={lastInteractionRef}
            isDraggingTimelineRef={isDraggingTimelineRef}
          />
        </div>
      )}
    </div>
  );
}
