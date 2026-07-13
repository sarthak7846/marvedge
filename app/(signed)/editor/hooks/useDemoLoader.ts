import React, { useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { applyDemoEditing } from "../utils/editingDraft";
import { resolvePlayableVideoUrl } from "./useURLParams";
import { SubtitleCue, TextOverlayItem } from "../types";
import type { EditorState } from "../apiTypes";

interface UseDemoLoaderProps {
  editorState: EditorState;
  isEditorInitializedRef: React.MutableRefObject<boolean>;
  setSegments: (segments: { start: number; end: number }[]) => void;
  setZoomSegments: (segments: ZoomEffect[]) => void;
  setSubtitleCues: (cues: SubtitleCue[]) => void;
  setTextOverlays: (overlays: TextOverlayItem[]) => void;
}

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
    videoUrl,
    setVideoUrl,
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
    setAvs,
    setCtas,
  } = editorState;

  // Read the freshest videoUrl inside async callbacks without re-running the
  // demo-fetch effect every time the video changes.
  const videoUrlRef = React.useRef(videoUrl);
  videoUrlRef.current = videoUrl;

  useEffect(() => {
    const nextParams = new URLSearchParams(window.location.search);
    setParams(nextParams);

    const urlDemoId = nextParams.get("demoId");
    if (urlDemoId) {
      setSavedDemoId(urlDemoId);
    }
  }, [setParams, setSavedDemoId]);

  useEffect(() => {
    if (savedDemoId) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("demoId") !== savedDemoId) {
        searchParams.set("demoId", savedDemoId);
        const newUrl = window.location.pathname + "?" + searchParams.toString();
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [savedDemoId]);

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
    isEditorInitializedRef.current = false;
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
        // Restore the source video from the demo record. This covers the case
        // where a demo was saved from inside the editor (its URL only carries a
        // demoId, no `video=` param) and the page is then refreshed. See #226.
        if (demo.videoUrl && !videoUrlRef.current && !params?.get("video")) {
          void resolvePlayableVideoUrl(demo.videoUrl, setVideoUrl);
        }
        if (demo.editing) {
          applyDemoEditing(demo.editing, {
            setSegments,
            setCurrentSegments,
            setZoomSegments,
            setSubtitleCues,
            setTextOverlays,
            setSelectedBackground,
            setBackgroundType,
            setAspectRatio,
            setBrowserFrameMode,
            setBrowserFrameDrawShadow,
            setBrowserFrameDrawBorder,
            setAvs,
          });
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
  }, [
    savedDemoId,
    params,
    isEditorInitializedRef,
    setVideoUrl,
    setSidebarDescription,
    setSidebarTitle,
    setCurrentSegments,
    setSelectedBackground,
    setBackgroundType,
    setAspectRatio,
    setBrowserFrameMode,
    setBrowserFrameDrawShadow,
    setBrowserFrameDrawBorder,
    setAvs,
    setSegments,
    setZoomSegments,
    setSubtitleCues,
    setTextOverlays,
  ]);

  // CTAs live in the Cta table, not in demo.editing, so load them separately.
  // Degrades gracefully: a missing/empty endpoint just leaves the list empty.
  useEffect(() => {
    const demoId = savedDemoId || params?.get("demoId");
    if (!demoId) {
      return;
    }
    let isMounted = true;
    axios
      .get(`/api/demos/${demoId}/ctas`)
      .then((res) => {
        if (!isMounted) {
          return;
        }
        const list = res.data?.ctas;
        if (!Array.isArray(list)) {
          return;
        }
        setCtas(
          list.map((c) => ({
            id: String(c.id),
            label: String(c.label ?? ""),
            url: String(c.url ?? ""),
            placement: c.placement ?? null,
            order: typeof c.order === "number" ? c.order : 0,
          }))
        );
      })
      .catch(() => {
        // CTAs are optional; ignore load failures (e.g. endpoint not yet deployed).
      });
    return () => {
      isMounted = false;
    };
  }, [savedDemoId, params, setCtas]);

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
