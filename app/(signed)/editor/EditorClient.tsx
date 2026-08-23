"use client";

import { useCallback, useRef, useState } from "react";

import { useEditor } from "@/app/hooks/useEditor";
import { useBlobStore } from "@/app/store/blobStore";

import { useEditorState } from "./hooks/useEditorState";
import { useFormatTime } from "./hooks/useURLParams";
import { useIsDark } from "./hooks/useIsDark";
import { useNativeAspectRatio } from "./hooks/useNativeAspectRatio";
import { useTextOverlays } from "./hooks/useTextOverlays";
import { useSubtitles } from "./hooks/useSubtitles";
import { useZoomEditor } from "./hooks/useZoomEditor";
import { useExportFlow } from "./hooks/useExportFlow";
import { useSaveDemo } from "./hooks/useSaveDemo";
import { useDemoLoader } from "./hooks/useDemoLoader";
import { useAutosave } from "./hooks/useAutosave";
import { useLocalDraft } from "./hooks/useLocalDraft";
import { useEditorWiring } from "./hooks/useEditorWiring";
import { useEditorSyncEffects } from "./hooks/useEditorSyncEffects";

import EditorModals from "./components/EditorModals";
import EditorPreviewRegion from "./components/EditorPreviewRegion";
import EditorSidebarRegion from "./components/EditorSidebarRegion";

export default function EditorPage() {
  const editorState = useEditorState();
  const { isDark } = useIsDark();
  const { videoUrl: recordedVideoUrl, thumbnailUrl, processing, resetVideo } = useEditor();
  const blob = useBlobStore((state) => state.blob);
  const sourceDuration = useBlobStore((state) => state.sourceDuration);
  const draftId = useBlobStore((state) => state.draftId);
  const { formatTimeForInput } = useFormatTime();

  const isEditorInitializedRef = useRef(false);
  const zoomFocusStageRef = useRef<HTMLDivElement | null>(null);
  const lastInteractionRef = useRef<number>(0);
  const isDraggingTimelineRef = useRef<boolean>(false);

  const [segments, setSegments] = useState<{ start: number; end: number }[]>([]);
  const [mode, setMode] = useState<"main" | "trim" | "zoom" | "text">("main");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [childHandleProgress, setChildHandleProgress] = useState<
    null | ((data: { playedSeconds: number }) => void)
  >(null);

  const text = useTextOverlays({ editorState, zoomFocusStageRef });
  const subtitles = useSubtitles({ editorState });
  const zoom = useZoomEditor({ editorState, zoomFocusStageRef, lastInteractionRef, mode });
  const nativeAspectRatio = useNativeAspectRatio(editorState.videoUrl);

  const { handleFullscreen, handleMouseDown, handleMouseUp, getBackgroundStyle, imageMap } =
    useEditorWiring({
      editorState,
      blob,
      sourceDuration,
      formatTimeForInput,
      setTextOverlaysFromUrl: text.setTextOverlaysFromUrl,
    });

  const exportFlow = useExportFlow({
    editorState,
    imageMap,
    segments,
    zoomSegments: zoom.zoomSegments,
    subtitleCues: subtitles.subtitleCues,
    subtitleStyle: subtitles.subtitleStyle,
    textOverlays: text.textOverlays,
    playbackSpeed,
  });

  const { onSaveDemo } = useSaveDemo({
    editorState,
    segments,
    zoomSegments: zoom.zoomSegments,
    subtitleCues: subtitles.subtitleCues,
    subtitleStyle: subtitles.subtitleStyle,
    textOverlays: text.textOverlays,
  });

  useDemoLoader({
    editorState,
    isEditorInitializedRef,
    setSegments,
    setZoomSegments: zoom.setZoomSegments,
    setSubtitleCues: subtitles.setSubtitleCues,
    setSubtitleStyle: subtitles.setSubtitleStyle,
    setTextOverlays: text.setTextOverlays,
  });

  useAutosave({
    editorState,
    isDark,
    isEditorInitializedRef,
    segments,
    zoomSegments: zoom.zoomSegments,
    subtitleCues: subtitles.subtitleCues,
    subtitleStyle: subtitles.subtitleStyle,
    textOverlays: text.textOverlays,
  });

  // Persist/restore an UNSAVED session (no demoId) to localStorage so an
  // accidental refresh doesn't discard timeline edits. The uploaded video
  // itself is restored from IndexedDB via the blob store. See issue #226.
  useLocalDraft({ editorState, draftId, segments, setSegments, zoom, subtitles, text });

  useEditorSyncEffects({
    editorState,
    blob,
    recordedVideoUrl,
    formatTimeForInput,
    segments,
    setSegments,
    zoomSegments: zoom.zoomSegments,
    setZoomSegments: zoom.setZoomSegments,
  });

  const resolvedDuration = Math.max(0, editorState.duration || 0);

  const { setInputStartTime, setInputEndTime } = editorState;
  const handleTimelineChange = useCallback(
    (start: number, end: number) => {
      setInputStartTime(formatTimeForInput(start));
      setInputEndTime(formatTimeForInput(end));
    },
    [formatTimeForInput, setInputStartTime, setInputEndTime]
  );

  const handleResetTimeline = () => {
    resetVideo();
    editorState.setPlaying(false);
    setMode("main");
    setSegments([]);
    zoom.setZoomSegments([]);
    zoom.setActiveZoomIdx(-1);
    editorState.setCurrentTime(0);
    editorState.playerRef.current?.seekTo(0, "seconds");
    editorState.setTimelineStartTime(0);
    editorState.setTimelineEndTime(editorState.duration);
    editorState.setInputStartTime(formatTimeForInput(0));
    editorState.setInputEndTime(formatTimeForInput(editorState.duration));
  };

  return (
    <main className="editor-page flex flex-col min-h-screen w-full bg-gray-50 overflow-hidden">
      <EditorModals
        exportFlow={exportFlow}
        onSaveDemo={onSaveDemo}
        resolvedDuration={resolvedDuration}
        playerRef={editorState.playerRef}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <EditorSidebarRegion
          text={text}
          zoom={zoom}
          subtitles={subtitles}
          exportFlow={exportFlow}
          thumbnailUrl={thumbnailUrl}
          playerRef={editorState.playerRef}
        />

        <EditorPreviewRegion
          text={text}
          zoom={zoom}
          subtitles={subtitles}
          playerRef={editorState.playerRef}
          canvasRef={editorState.canvasRef}
          videoContainerRef={editorState.videoContainerRef}
          isDark={isDark}
          processing={processing}
          nativeAspectRatio={nativeAspectRatio}
          resolvedDuration={resolvedDuration}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          mode={mode}
          setMode={setMode}
          segments={segments}
          setSegments={setSegments}
          childHandleProgress={childHandleProgress}
          setChildHandleProgress={setChildHandleProgress}
          handleMouseDown={handleMouseDown}
          handleMouseUp={handleMouseUp}
          handleFullscreen={handleFullscreen}
          getBackgroundStyle={getBackgroundStyle}
          handleTimelineChange={handleTimelineChange}
          handleResetTimeline={handleResetTimeline}
          zoomFocusStageRef={zoomFocusStageRef}
          lastInteractionRef={lastInteractionRef}
          isDraggingTimelineRef={isDraggingTimelineRef}
        />
      </div>
    </main>
  );
}
