import React from "react";

import { clearVideoDraft } from "@/app/lib/videoDraftStore";

import { applyDemoEditing, buildEditingPayload, DemoEditing } from "../utils/editingDraft";
import type { EditorState, SubtitlesApi, TextOverlaysApi, ZoomEditorApi } from "../apiTypes";

// localStorage draft of the editing state for an UNSAVED session (no demoId).
// Once a demo is saved it gets a demoId and the backend becomes the source of
// truth, so this hook is a no-op from that point on. See issue #226.
const LOCAL_DRAFT_KEY = "marvedge-editor-local-draft";
const DEBOUNCE_MS = 800;

interface StoredDraft {
  draftId: string;
  title: string;
  description: string;
  editing: DemoEditing;
}

interface UseLocalDraftProps {
  editorState: EditorState;
  draftId: string | null;
  segments: { start: number; end: number }[];
  setSegments: (segments: { start: number; end: number }[]) => void;
  zoom: ZoomEditorApi;
  subtitles: SubtitlesApi;
  text: TextOverlaysApi;
}

function getUrlDemoId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("demoId");
}

function readStoredDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    // Corrupt or unavailable storage: behave as if there is no draft.
    return null;
  }
}

function writeStoredDraft(draft: StoredDraft): void {
  try {
    window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore quota/availability errors — persistence is best-effort.
  }
}

function removeStoredDraft(): void {
  try {
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
  } catch {
    // Ignore.
  }
}

// Writes the pending draft immediately and clears it (used by both the debounce
// timer and the hide/unload flush).
function flushPending(ref: { current: StoredDraft | null }): void {
  if (ref.current) {
    writeStoredDraft(ref.current);
    ref.current = null;
  }
}

// Runs `flush` when the page is being hidden or unloaded, so the last edit isn't
// lost inside the debounce window on an abrupt refresh. Returns a cleanup fn.
function addFlushListeners(flush: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  };
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("beforeunload", flush);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

interface DraftEffectProps extends UseLocalDraftProps {
  restoredRef: { current: boolean };
}

// Restore editing state from localStorage once the draft video is known.
function useDraftRestore({
  editorState,
  draftId,
  setSegments,
  zoom,
  subtitles,
  text,
  restoredRef,
}: DraftEffectProps) {
  const { setZoomSegments } = zoom;
  const { setSubtitleCues, setSubtitleStyle, setSubtitleLanguage } = subtitles;
  const { setTextOverlays } = text;
  const {
    savedDemoId,
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
    setWtm,
  } = editorState;

  React.useEffect(() => {
    if (restoredRef.current || !draftId) {
      return;
    }
    // A saved demo restores its editing from the backend (demo.editing); never
    // let a local draft clobber it.
    if (savedDemoId || getUrlDemoId()) {
      restoredRef.current = true;
      return;
    }

    restoredRef.current = true;
    const parsed = readStoredDraft();
    // Ignore a missing draft or one that belongs to a different (older) video.
    if (!parsed || parsed.draftId !== draftId) {
      return;
    }
    if (parsed.title) {
      setSidebarTitle(parsed.title);
    }
    if (parsed.description) {
      setSidebarDescription(parsed.description);
    }
    applyDemoEditing(parsed.editing, {
      setSegments,
      setCurrentSegments,
      setZoomSegments,
      setSubtitleCues,
      setSubtitleStyle,
      setSubtitleLanguage,
      setTextOverlays,
      setSelectedBackground,
      setBackgroundType,
      setAspectRatio,
      setBrowserFrameMode,
      setBrowserFrameDrawShadow,
      setBrowserFrameDrawBorder,
      setAvs,
      setWtm,
    });
  }, [
    restoredRef,
    draftId,
    savedDemoId,
    setSidebarTitle,
    setSidebarDescription,
    setSegments,
    setCurrentSegments,
    setZoomSegments,
    setSubtitleCues,
    setSubtitleStyle,
    setSubtitleLanguage,
    setTextOverlays,
    setSelectedBackground,
    setBackgroundType,
    setAspectRatio,
    setBrowserFrameMode,
    setBrowserFrameDrawShadow,
    setBrowserFrameDrawBorder,
    setAvs,
    setWtm,
  ]);
}

// Persist editing state to localStorage (debounced) for unsaved sessions only,
// flushing any pending write before the tab is hidden or unloaded.
function useDraftPersist({
  editorState,
  draftId,
  segments,
  zoom,
  subtitles,
  text,
  restoredRef,
}: DraftEffectProps) {
  const { zoomSegments } = zoom;
  const { subtitleCues, subtitleStyle, subtitleLanguage } = subtitles;
  const { textOverlays } = text;
  const {
    savedDemoId,
    selectedBackground,
    backgroundType,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
    avs,
    wtm,
    sidebarTitle,
    sidebarDescription,
  } = editorState;

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the draft the debounced timer will write, so it can be flushed early.
  const pendingDraftRef = React.useRef<StoredDraft | null>(null);

  React.useEffect(() => {
    if (!draftId || !restoredRef.current) {
      return;
    }
    if (savedDemoId || getUrlDemoId()) {
      return;
    }

    pendingDraftRef.current = {
      draftId,
      title: sidebarTitle || "",
      description: sidebarDescription || "",
      editing: buildEditingPayload({
        segments,
        zoomSegments,
        selectedBackground,
        backgroundType,
        subtitleCues,
        subtitleStyle,
        subtitleLanguage,
        textOverlays,
        aspectRatio,
        browserFrameMode,
        browserFrameDrawShadow,
        browserFrameDrawBorder,
        avs,
        wtm,
      }),
    };

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => flushPending(pendingDraftRef), DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    restoredRef,
    draftId,
    savedDemoId,
    segments,
    zoomSegments,
    subtitleCues,
    subtitleStyle,
    subtitleLanguage,
    textOverlays,
    selectedBackground,
    backgroundType,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
    avs,
    wtm,
    sidebarTitle,
    sidebarDescription,
  ]);

  React.useEffect(() => {
    return addFlushListeners(() => flushPending(pendingDraftRef));
  }, []);
}

export function useLocalDraft(props: UseLocalDraftProps) {
  const { editorState } = props;
  const { savedDemoId } = editorState;

  const restoredRef = React.useRef(false);

  // Whether this editor session began WITHOUT a demoId (i.e. an unsaved upload),
  // captured once. Used so that merely opening an existing demo never clears a
  // separate, unrelated draft that a previous unsaved session left behind.
  const startedUnsavedRef = React.useRef<boolean | null>(null);
  if (startedUnsavedRef.current === null) {
    startedUnsavedRef.current = !getUrlDemoId();
  }

  useDraftRestore({ ...props, restoredRef });
  useDraftPersist({ ...props, restoredRef });

  // Once THIS unsaved session is saved as a demo, the backend owns both the
  // editing state and the source video (restored on reload via demo.editing /
  // demo.videoUrl), so drop the client-side draft to avoid resurrecting stale
  // work on a later visit. Skipped when the session opened an existing demo, so
  // an unrelated draft from a prior session is left untouched.
  React.useEffect(() => {
    if (!savedDemoId || !startedUnsavedRef.current) {
      return;
    }
    removeStoredDraft();
    void clearVideoDraft().catch(() => {});
  }, [savedDemoId]);
}
