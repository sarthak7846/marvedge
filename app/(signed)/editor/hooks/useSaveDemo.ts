import { useRef } from "react";
import { toast } from "react-hot-toast";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { handleSaveDemo } from "../utils/videoHandlers";
import type { SubtitleStyle } from "@/app/lib/subtitles";
import { SubtitleCue, TextOverlayItem } from "../types";
import type { EditorState } from "../apiTypes";

interface UseSaveDemoProps {
  editorState: EditorState;
  segments: { start: number; end: number }[];
  zoomSegments: ZoomEffect[];
  subtitleCues: SubtitleCue[];
  subtitleStyle: SubtitleStyle | null;
  subtitleLanguage: string;
  textOverlays: TextOverlayItem[];
}

export function useSaveDemo({
  editorState,
  segments,
  zoomSegments,
  subtitleCues,
  subtitleStyle,
  subtitleLanguage,
  textOverlays,
}: UseSaveDemoProps) {
  const savedDemosRef = useRef<Set<string>>(new Set());

  const onSaveDemo = async (data: {
    title: string;
    description: string;
    tags?: string[];
    integrations?: string[];
    userRoles?: string[];
    featured?: boolean;
  }) => {
    const effectiveDemoId = editorState.savedDemoId || editorState.params?.get("demoId") || null;
    const isExistingDemo = !!effectiveDemoId;
    if (editorState.demoSaved && !isExistingDemo) {
      return;
    }

    const demoKey = `${data.title}|${editorState.videoUrl}|${data.description}`;

    if (!isExistingDemo && savedDemosRef.current.has(demoKey)) {
      toast.error("This demo has already been saved in this session!");
      return;
    }

    await handleSaveDemo(data, {
      videoUrl: editorState.videoUrl!,
      inputStartTime: editorState.inputStartTime,
      inputEndTime: editorState.inputEndTime,
      currentSegments: segments.map((s) => ({
        start: String(s.start),
        end: String(s.end),
      })),
      zoomEffects: zoomSegments,
      subtitles: subtitleCues,
      subtitleStyle,
      subtitleLanguage,
      selectedBackground: editorState.selectedBackground,
      backgroundType: editorState.backgroundType,
      aspectRatio: editorState.aspectRatio,
      browserFrame: {
        mode: editorState.browserFrameMode,
        drawShadow: editorState.browserFrameDrawShadow,
        drawBorder: editorState.browserFrameDrawBorder,
      },
      textOverlays,
      savedDemoId: effectiveDemoId,
      setSavingDemo: editorState.setSavingDemo,
      setSidebarTitle: editorState.setSidebarTitle,
      setSidebarDescription: editorState.setSidebarDescription,
      setShowSaveDemoModal: editorState.setShowSaveDemoModal,
      setDemoSaved: editorState.setDemoSaved,
      setSavedDemoId: editorState.setSavedDemoId,
      onSaveSuccess: () => {
        if (!isExistingDemo) {
          savedDemosRef.current.add(demoKey);
        }
      },
    });
  };

  return { onSaveDemo };
}
