import React, { useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import { uploadBlobToGcs } from "@/app/lib/gcsUploadClient";
import { findActiveCue } from "@/app/lib/subtitles";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";
import { SubtitleCue } from "../types";
import type { EditorState } from "../apiTypes";

interface UseSubtitlesProps {
  editorState: EditorState;
}

export function useSubtitles({ editorState }: UseSubtitlesProps) {
  const { params, videoUrl, currentTime, savedDemoId } = editorState;
  const {
    subtitleCues,
    subtitlesLoading,
    subtitleStyle,
    setSubtitleCues,
    setSubtitlesLoading,
    setSubtitleStyle,
  } = useSubtitleStore(
    useShallow((s) => ({
      subtitleCues: s.subtitleCues,
      subtitlesLoading: s.subtitlesLoading,
      subtitleStyle: s.subtitleStyle,
      setSubtitleCues: s.setSubtitleCues,
      setSubtitlesLoading: s.setSubtitlesLoading,
      setSubtitleStyle: s.setSubtitleStyle,
    }))
  );

  useEffect(() => {
    if (!params) {
      return;
    }
    const urlSubtitles = params.get("subtitles");
    if (!urlSubtitles) {
      return;
    }
    try {
      const parsed = JSON.parse(urlSubtitles) as unknown;

      let cues: unknown = null;
      if (Array.isArray(parsed)) {
        cues = parsed;
      } else if (typeof parsed === "object" && parsed && "cues" in parsed) {
        cues = (parsed as { cues?: unknown }).cues ?? null;
      }
      if (Array.isArray(cues)) {
        setSubtitleCues(
          cues
            .map((c) => {
              if (typeof c !== "object" || !c) {
                return null;
              }
              const rec = c as Record<string, unknown>;
              const start = Number(rec.start);
              const end = Number(rec.end);
              const text = String(rec.text ?? "").trim();
              if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
                return null;
              }
              return { start, end, text } satisfies SubtitleCue;
            })
            .filter(
              (c): c is SubtitleCue =>
                !!c && Number.isFinite(c.start) && Number.isFinite(c.end) && c.text.length > 0
            )
        );
      }
    } catch (e) {
      console.error("Failed to parse subtitles from URL:", e);
    }
  }, [params, setSubtitleCues]);

  // The binary search lives in app/lib/subtitles so the preview, the editor
  // panel and the export path all agree on which cue is on screen at a time.
  const activeSubtitleText = React.useMemo(
    () => findActiveCue(subtitleCues, currentTime)?.text ?? "",
    [subtitleCues, currentTime]
  );

  const handleAddSubtitles = async () => {
    if (!videoUrl) {
      toast.error("No video available for subtitles");
      return;
    }
    if (subtitlesLoading) {
      return;
    }

    const toastId = toast.loading("Generating subtitles...");
    setSubtitlesLoading(true);
    try {
      let subtitleSourceUrl = videoUrl;
      if (videoUrl.startsWith("blob:")) {
        toast.loading("Uploading audio source...", { id: toastId });
        const resp = await fetch(videoUrl);
        if (!resp.ok) {
          throw new Error("Failed to read recorded video blob");
        }
        const blob = await resp.blob();
        const upload = await uploadBlobToGcs({
          blob,
          filename: "subtitle_source.webm",
          kind: "subtitle-source",
        });
        subtitleSourceUrl = upload.url;
      }

      const createRes = await axios.post("/api/subtitles/create", {
        videoUrl: subtitleSourceUrl,
        demoId: savedDemoId || null,
        language: "multi",
      });
      const jobId = createRes.data?.jobId as string | undefined;
      if (!jobId) {
        throw new Error("No subtitle job ID returned");
      }

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const MAX_POLLS = 180;
      for (let pollCount = 0; pollCount < MAX_POLLS; pollCount++) {
        const statusRes = await axios.get(`/api/jobs/${jobId}`);
        const state = statusRes.data?.state as string | undefined;
        if (state === "completed") {
          const cues = (statusRes.data?.subtitles || []) as SubtitleCue[];
          setSubtitleCues(Array.isArray(cues) ? cues : []);
          toast.success("Subtitles ready", { id: toastId });
          return;
        }
        if (state === "failed") {
          throw new Error(statusRes.data?.error || "Subtitle generation failed");
        }
        await sleep(2000);
      }
      throw new Error("Subtitle generation timed out");
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Failed to generate subtitles";
      toast.error(message, { id: toastId });
    } finally {
      setSubtitlesLoading(false);
    }
  };

  const handleSkipSubtitles = React.useCallback(() => {
    setSubtitleCues([]);
    toast.success("Subtitles skipped for export");
  }, [setSubtitleCues]);

  return {
    subtitleCues,
    setSubtitleCues,
    subtitlesLoading,
    // SUB PR 4: the demo's persisted appearance. `null` until the style panel is
    // touched, which is what keeps an untouched demo's export byte-identical.
    subtitleStyle,
    setSubtitleStyle,
    activeSubtitleText,
    handleAddSubtitles,
    handleSkipSubtitles,
  };
}
