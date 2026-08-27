import React from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import { languageLabel } from "@/app/lib/subtitles";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";
import type { SubtitleCue } from "@/app/(signed)/editor/types";

/**
 * Behaviour for the subtitle panel's language section (SUB PR 5 / US-4).
 *
 * Panel-local, like `useSubtitleEditing`: it reads `savedDemoId` from the editor
 * store and the language state from the subtitle store, so the section is
 * self-contained and nothing new has to be threaded through EditorSidebarRegion
 * → EditorSidebar → SubtitlePanel. Generation itself stays in `useSubtitles`,
 * which owns the video URL and the upload step.
 */
export function useSubtitleLanguages() {
  const savedDemoId = useEditorStore((s) => s.savedDemoId);

  const {
    subtitleCues,
    subtitleLanguage,
    generationLanguage,
    subtitleTracks,
    subtitleTranslating,
    subtitleTranslateEnabled,
    setGenerationLanguage,
    setSubtitleTracks,
    setSubtitleTranslating,
    setSubtitleTranslateEnabled,
    activateTrack,
  } = useSubtitleStore(
    useShallow((s) => ({
      subtitleCues: s.subtitleCues,
      subtitleLanguage: s.subtitleLanguage,
      generationLanguage: s.generationLanguage,
      subtitleTracks: s.subtitleTracks,
      subtitleTranslating: s.subtitleTranslating,
      subtitleTranslateEnabled: s.subtitleTranslateEnabled,
      setGenerationLanguage: s.setGenerationLanguage,
      setSubtitleTracks: s.setSubtitleTracks,
      setSubtitleTranslating: s.setSubtitleTranslating,
      setSubtitleTranslateEnabled: s.setSubtitleTranslateEnabled,
      activateTrack: s.activateTrack,
    }))
  );

  /** Load the demo's tracks, and learn whether the server has translation on. */
  const refreshTracks = React.useCallback(async () => {
    if (!savedDemoId) {
      setSubtitleTracks([]);
      return;
    }
    try {
      const res = await axios.get("/api/subtitles/tracks", { params: { demoId: savedDemoId } });
      const tracks = res.data?.tracks;
      setSubtitleTracks(Array.isArray(tracks) ? tracks : []);
      // SUBTITLE_TRANSLATE_ENABLED is server-only, so the flag arrives here
      // rather than being read from env in the browser.
      setSubtitleTranslateEnabled(Boolean(res.data?.translateEnabled));
    } catch (e) {
      // A demo with no tracks, or a database without PR 1's migration, is a
      // normal empty state — not something to interrupt the user about.
      console.warn("Failed to load subtitle tracks:", e);
      setSubtitleTracks([]);
    }
  }, [savedDemoId, setSubtitleTracks, setSubtitleTranslateEnabled]);

  // Load on mount and whenever the demo identity changes. Also re-runs when the
  // cue count changes, which is how a freshly generated track appears in the
  // switcher without the user reopening the panel.
  React.useEffect(() => {
    void refreshTracks();
  }, [refreshTracks, subtitleCues.length]);

  /** Poll a subtitle job to completion and return its cues. */
  const pollJob = React.useCallback(async (jobId: string, failureMessage: string) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const MAX_POLLS = 180;
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      const statusRes = await axios.get(`/api/jobs/${jobId}`);
      const state = statusRes.data?.state as string | undefined;
      if (state === "completed") {
        const cues = statusRes.data?.subtitles;
        return (Array.isArray(cues) ? cues : []) as SubtitleCue[];
      }
      if (state === "failed") {
        // The route records the alignment error's own message, so a mis-aligned
        // batch surfaces as a readable reason instead of a generic failure.
        throw new Error(statusRes.data?.error || failureMessage);
      }
      await sleep(2000);
    }
    throw new Error(`${failureMessage} (timed out)`);
  }, []);

  /** Make `language` the active track: fetch its cues and adopt them. */
  const handleSelectTrack = React.useCallback(
    async (language: string) => {
      if (!savedDemoId || language === subtitleLanguage) {
        return;
      }
      const toastId = toast.loading(`Loading ${languageLabel(language)} subtitles...`);
      try {
        const res = await axios.get("/api/subtitles/tracks", {
          params: { demoId: savedDemoId, language },
        });
        const cues = res.data?.track?.cues;
        activateTrack(language, Array.isArray(cues) ? (cues as SubtitleCue[]) : []);
        toast.success(`Showing ${languageLabel(language)} subtitles`, { id: toastId });
      } catch (e: unknown) {
        toast.error(readError(e, "Failed to load that subtitle track"), { id: toastId });
      }
    },
    [savedDemoId, subtitleLanguage, activateTrack]
  );

  /**
   * Translate the active track and switch to the result.
   *
   * There is deliberately NO client-side plan check here. The server re-resolves
   * the plan from the database on every call and returns a 403 with its own
   * message; duplicating that check in the browser would mean a stale plan could
   * either hide the feature from someone who just upgraded or imply the gate
   * lives here rather than on the server.
   */
  const handleTranslate = React.useCallback(
    async (targetLanguage: string) => {
      if (!savedDemoId) {
        toast.error("Save this demo before translating its subtitles");
        return;
      }
      if (subtitleCues.length === 0) {
        toast.error("Generate subtitles before translating them");
        return;
      }
      const label = languageLabel(targetLanguage);
      const toastId = toast.loading(`Translating subtitles to ${label}...`);
      setSubtitleTranslating(true);
      try {
        const res = await axios.post("/api/subtitles/translate", {
          demoId: savedDemoId,
          sourceLanguage: subtitleLanguage,
          targetLanguage,
        });
        const jobId = res.data?.jobId as string | undefined;
        if (!jobId) {
          throw new Error("No translation job ID returned");
        }
        const cues = await pollJob(jobId, "Subtitle translation failed");
        activateTrack(targetLanguage, cues);
        await refreshTracks();
        toast.success(`${label} subtitles ready`, { id: toastId });
      } catch (e: unknown) {
        toast.error(readError(e, "Failed to translate subtitles"), { id: toastId });
      } finally {
        setSubtitleTranslating(false);
      }
    },
    [
      savedDemoId,
      subtitleCues.length,
      subtitleLanguage,
      activateTrack,
      pollJob,
      refreshTracks,
      setSubtitleTranslating,
    ]
  );

  return {
    generationLanguage,
    setGenerationLanguage,
    activeLanguage: subtitleLanguage,
    tracks: subtitleTracks,
    translating: subtitleTranslating,
    translateEnabled: subtitleTranslateEnabled,
    // Translation needs a saved demo (the route works from stored cues) and
    // something to translate.
    canTranslate: Boolean(savedDemoId) && subtitleCues.length > 0,
    handleSelectTrack,
    handleTranslate,
    refreshTracks,
  };
}

/** Prefer the server's own message — the 403 and the alignment errors explain themselves. */
function readError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) {
    return String(e.response.data.error);
  }
  return e instanceof Error ? e.message : fallback;
}
