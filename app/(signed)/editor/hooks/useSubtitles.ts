import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import { uploadBlobToGcs } from "@/app/lib/gcsUploadClient";
import { SubtitleCue } from "../types";
import type { EditorState } from "../apiTypes";

interface UseSubtitlesProps {
  editorState: EditorState;
}

export function useSubtitles({ editorState }: UseSubtitlesProps) {
  const { params, videoUrl, currentTime, savedDemoId } = editorState;
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);

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
  }, [params]);

  const activeSubtitleText = React.useMemo(() => {
    if (!subtitleCues.length) {
      return "";
    }
    const t = currentTime;

    let lo = 0;
    let hi = subtitleCues.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = subtitleCues[mid];
      if (t < c.start) {
        hi = mid - 1;
      } else if (t > c.end) {
        lo = mid + 1;
      } else {
        return c.text;
      }
    }

    return "";
  }, [subtitleCues, currentTime]);

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
  }, []);

  return {
    subtitleCues,
    setSubtitleCues,
    subtitlesLoading,
    activeSubtitleText,
    handleAddSubtitles,
    handleSkipSubtitles,
  };
}
