import React, { useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { BrowserFrameMode } from "./useEditorState";
import { SubtitleCue, TextOverlayItem } from "../types";
import type { EditorState } from "../apiTypes";

interface UseDemoLoaderProps {
  editorState: EditorState;
  isEditorInitializedRef: React.RefObject<boolean>;
  setSegments: (segments: { start: number; end: number }[]) => void;
  setZoomSegments: (segments: ZoomEffect[]) => void;
  setSubtitleCues: (cues: SubtitleCue[]) => void;
  setTextOverlays: (overlays: TextOverlayItem[]) => void;
}

type DemoEditing = {
  segments?: { start: string | number; end: string | number }[];
  zoom?: ZoomEffect[];
  background?: string | null;
  backgroundType?: string;
  subtitles?: SubtitleCue[];
  textOverlays?: TextOverlayItem[];
  aspectRatio?: string;
  browserFrame?: {
    mode?: BrowserFrameMode;
    drawShadow?: boolean;
    drawBorder?: boolean;
  };
};

export function useDemoLoader({
  editorState,
  isEditorInitializedRef,
  setSegments,
  setZoomSegments,
  setSubtitleCues,
  setTextOverlays,
}: UseDemoLoaderProps) {
  const {
    params,
    savedDemoId,
    setParams,
    setSavedDemoId,
    setSidebarTitle,
    setSidebarDescription,
    setCurrentSegments,
    setSelectedBackground,
    setBackgroundType,
    setAspectRatio,
    setBrowserFrameMode,
    setBrowserFrameDrawShadow,
    setBrowserFrameDrawBorder,
  } = editorState;

  const restoreDemoEditing = (ed: DemoEditing) => {
    if (ed.segments) {
      const numeric = ed.segments
        .map((s) => ({
          start: typeof s.start === "string" ? parseFloat(s.start) : Number(s.start),
          end: typeof s.end === "string" ? parseFloat(s.end) : Number(s.end),
        }))
        .filter((s) => !isNaN(s.start) && !isNaN(s.end));
      if (numeric.length > 0) {
        setSegments(numeric);
        setCurrentSegments(
          ed.segments.map((s) => ({
            start: String(s.start),
            end: String(s.end),
          }))
        );
      }
    }
    if (ed.zoom) {
      setZoomSegments(ed.zoom);
    }
    if (ed.background) {
      setSelectedBackground(ed.background);
    }
    if (ed.backgroundType) {
      setBackgroundType(ed.backgroundType);
    }
    if (ed.subtitles) {
      setSubtitleCues(ed.subtitles);
    }
    if (ed.textOverlays) {
      setTextOverlays(ed.textOverlays);
    }
    if (ed.aspectRatio) {
      setAspectRatio(ed.aspectRatio);
    }
    if (ed.browserFrame) {
      if (ed.browserFrame.mode) {
        setBrowserFrameMode(ed.browserFrame.mode);
      }
      if (typeof ed.browserFrame.drawShadow === "boolean") {
        setBrowserFrameDrawShadow(ed.browserFrame.drawShadow);
      }
      if (typeof ed.browserFrame.drawBorder === "boolean") {
        setBrowserFrameDrawBorder(ed.browserFrame.drawBorder);
      }
    }
  };

  useEffect(() => {
    const nextParams = new URLSearchParams(window.location.search);
    setParams(nextParams);

    const urlDemoId = nextParams.get("demoId");
    if (urlDemoId) {
      setSavedDemoId(urlDemoId);
    }
  }, [setParams, setSavedDemoId]);

  useEffect(() => {
    const demoId = savedDemoId || params?.get("demoId");
    if (!demoId) {
      const timer = setTimeout(() => {
        isEditorInitializedRef.current = true;
      }, 2000);
      return () => {
        clearTimeout(timer);
      };
    }
    let isMounted = true;
    axios
      .get(`/api/demo?id=${demoId}`)
      .then((res) => {
        if (!isMounted) {
          return;
        }
        const demo = res.data?.demo;
        if (!demo) {
          return;
        }
        if (demo.title) {
          setSidebarTitle(demo.title);
        }
        if (demo.description) {
          setSidebarDescription(demo.description || "");
        }
        if (demo.editing) {
          restoreDemoEditing(demo.editing);
        }
        setTimeout(() => {
          if (isMounted) {
            isEditorInitializedRef.current = true;
          }
        }, 1500);
      })
      .catch(console.error);
    return () => {
      isMounted = false;
    };
  }, [savedDemoId, params]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("subscribed") === "true") {
      toast.success("Congrats! You are subscribed to premium! You can now export your videos.", {
        duration: 5000,
      });
      searchParams.delete("subscribed");
      const newQuery = searchParams.toString();
      const newUrl = window.location.pathname + (newQuery ? "?" + newQuery : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);
}
