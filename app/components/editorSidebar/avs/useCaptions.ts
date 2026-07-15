import React from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import type { AvsState, CaptionCue } from "@/app/types/avs";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { cuesToVtt, stabilizeCues, type Cue } from "@/app/lib/avs/karaoke";

// Polling cadence for the subtitle job (mirrors useSubtitles).
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 180;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CaptionsGeneration {
  /** Whether a voiceover exists to caption. */
  hasVoiceover: boolean;
  generating: boolean;
  /** The persisted, flicker-free captions, if any. */
  captions: CaptionCue[] | undefined;
  handleGenerate: () => void;
  handleDownloadVtt: () => void;
}

/**
 * Owns AVS captions (AVS-2.3). Generates captions from the AVS *voiceover* audio
 * — never the source video — by calling the existing `/api/subtitles/create`
 * route (with no demoId, so the demo's own `subtitles` are left untouched), then
 * stabilizes the returned cues so they stop flickering. The result is written to
 * `avs.captions`, which the existing autosave persists into `Demo.editing.avs`.
 *
 * The user can also export the stabilized captions as a `.vtt` file.
 *
 * Degrades gracefully: with no voiceover the generate action is disabled, and the
 * existing (non-AVS) subtitle flow is not affected in any way.
 */
export function useCaptions(): CaptionsGeneration {
  const { avs, setAvs } = useEditorStore(
    useShallow((s) => ({
      avs: s.avs,
      setAvs: s.setAvs,
    }))
  );

  const voiceover = avs?.voiceover;
  const captions = avs?.captions;
  const hasVoiceover = typeof voiceover?.audioUrl === "string" && voiceover.audioUrl.length > 0;

  const [generating, setGenerating] = React.useState(false);

  // Preserve the other AVS fields (steps, script, voiceover, …) when only the
  // captions change.
  const setCaptions = React.useCallback(
    (cues: CaptionCue[]) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        return { ...base, captions: cues };
      });
    },
    [setAvs]
  );

  const handleGenerate = React.useCallback(async () => {
    if (generating) {
      return;
    }
    if (!voiceover?.audioUrl) {
      toast.error("Generate a voiceover first");
      return;
    }

    const toastId = toast.loading("Generating captions…");
    setGenerating(true);
    try {
      // demoId is intentionally omitted so this does NOT overwrite the demo's
      // own subtitles — AVS captions live under avs.captions.
      const createRes = await axios.post("/api/subtitles/create", {
        videoUrl: voiceover.audioUrl,
        demoId: null,
        language: "multi",
      });
      const jobId = createRes.data?.jobId as string | undefined;
      if (!jobId) {
        throw new Error("No caption job ID returned");
      }

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        const statusRes = await axios.get(`/api/jobs/${jobId}`);
        const state = statusRes.data?.state as string | undefined;
        if (state === "completed") {
          const rawCues = (statusRes.data?.subtitles || []) as Cue[];
          const stabilized = stabilizeCues(Array.isArray(rawCues) ? rawCues : []);
          setCaptions(stabilized);
          if (stabilized.length === 0) {
            toast.error("No speech detected in the voiceover", { id: toastId });
          } else {
            toast.success("Captions ready", { id: toastId });
          }
          return;
        }
        if (state === "failed") {
          throw new Error(statusRes.data?.error || "Caption generation failed");
        }
        await sleep(POLL_INTERVAL_MS);
      }
      throw new Error("Caption generation timed out");
    } catch (e: unknown) {
      const message =
        axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
          ? e.response.data.error
          : e instanceof Error
            ? e.message
            : "Failed to generate captions";
      toast.error(message, { id: toastId });
    } finally {
      setGenerating(false);
    }
  }, [generating, voiceover?.audioUrl, setCaptions]);

  const handleDownloadVtt = React.useCallback(() => {
    if (!captions || captions.length === 0) {
      toast.error("Generate captions first");
      return;
    }
    const vtt = cuesToVtt(captions);
    const blob = new Blob([vtt], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "captions.vtt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [captions]);

  return {
    hasVoiceover,
    generating,
    captions,
    handleGenerate,
    handleDownloadVtt,
  };
}
