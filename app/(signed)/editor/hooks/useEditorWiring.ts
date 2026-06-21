import { useBackgroundStyle } from "./useBackgroundStyle";
import { useFullscreen } from "./useFullscreen";
import { useOverlays } from "./useOverlays";
import { useTimelineInit } from "./useTimelineInit";
import { useURLParams } from "./useURLParams";
import { useVideoDuration } from "./useVideoDuration";
import type { EditorState } from "../apiTypes";

interface UseEditorWiringProps {
  editorState: EditorState;
  blob: Blob | null;
  sourceDuration: number;
  formatTimeForInput: (seconds: number) => string;
  setTextOverlaysFromUrl: (overlays: unknown) => void;
}

export function useEditorWiring({
  editorState,
  blob,
  sourceDuration,
  formatTimeForInput,
  setTextOverlaysFromUrl,
}: UseEditorWiringProps) {
  useVideoDuration({
    videoUrl: editorState.videoUrl,
    duration: editorState.duration,
    recordingDuration: sourceDuration,
    blob,
    playerRef: editorState.playerRef,
    setDuration: editorState.setDuration,
  });

  const { handleFullscreen } = useFullscreen({
    videoContainerRef: editorState.videoContainerRef,
    setIsFullscreen: editorState.setIsFullscreen,
  });

  const { handleMouseDown, handleMouseUp } = useOverlays({
    canvasRef: editorState.canvasRef,
    playerRef: editorState.playerRef,
    tool: editorState.tool,
    textColor: editorState.textColor,
    textFont: editorState.textFont,
  });

  const { getBackgroundStyle, imageMap } = useBackgroundStyle({
    selectedBackground: editorState.selectedBackground,
    customBackground: editorState.customBackground,
  });

  useTimelineInit({
    duration: editorState.duration,
    timelineEndTime: editorState.timelineEndTime,
    setTimelineStartTime: editorState.setTimelineStartTime,
    setInputStartTime: editorState.setInputStartTime,
    setTimelineEndTime: editorState.setTimelineEndTime,
    setInputEndTime: editorState.setInputEndTime,
    formatTimeForInput,
  });

  useURLParams({
    params: editorState.params,
    setVideoUrl: editorState.setVideoUrl,
    setInputStartTime: editorState.setInputStartTime,
    setInputEndTime: editorState.setInputEndTime,
    setTimelineEndTime: editorState.setTimelineEndTime,
    setSidebarTitle: editorState.setSidebarTitle,
    setSidebarDescription: editorState.setSidebarDescription,
    setLoadedSegments: editorState.setLoadedSegments,
    setCurrentSegments: editorState.setCurrentSegments,
    setZoomEffects: editorState.setZoomEffects,
    setSelectedBackground: editorState.setSelectedBackground,
    setBackgroundType: editorState.setBackgroundType,
    setTextOverlays: setTextOverlaysFromUrl,
    setSavedDemoId: editorState.setSavedDemoId,
    setAspectRatio: editorState.setAspectRatio,
    setBrowserFrameMode: editorState.setBrowserFrameMode,
    setBrowserFrameDrawShadow: editorState.setBrowserFrameDrawShadow,
    setBrowserFrameDrawBorder: editorState.setBrowserFrameDrawBorder,
    formatTimeForInput,
  });

  return { handleFullscreen, handleMouseDown, handleMouseUp, getBackgroundStyle, imageMap };
}
