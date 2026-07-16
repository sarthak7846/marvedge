import React from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import type {
  AlignedSource,
  AvsState,
  CaptionCue,
  PronunciationRule,
  ScriptLine,
  Step,
  StepTiming,
  VoiceoverTrack,
} from "@/app/types/avs";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useZoomStore } from "@/app/store/editor/zoomStore";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";
import { resolveClickTimes } from "@/app/lib/avs/clickSources";
import { deriveSteps } from "@/app/lib/avs/deriveSteps";
import { seedScriptLines } from "@/app/lib/avs/seedScript";
import { stabilizeCues, type Cue } from "@/app/lib/avs/karaoke";
import { DEFAULT_AVS_VOICE, isAvsVoiceId } from "@/app/lib/avs/voices";
import type { ScriptTone } from "@/app/lib/avs/tones";

// Job polling cadence (mirrors useCaptions / the export flow).
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 240; // ~10 minutes for the heavier ffmpeg alignment/export.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The ordered stages of the end-to-end AVS pipeline. */
export type PipelineStageId = "steps" | "script" | "voiceover" | "captions" | "sync" | "export";

export type StageStatus = "pending" | "running" | "done" | "warning" | "error";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  status: StageStatus;
  /** Short human-readable detail (result summary or failure reason). */
  note?: string;
}

const STAGE_LABELS: Record<PipelineStageId, string> = {
  steps: "Steps",
  script: "AI script",
  voiceover: "Voiceover",
  captions: "Captions",
  sync: "Time-alignment",
  export: "Export",
};

const STAGE_ORDER: PipelineStageId[] = [
  "steps",
  "script",
  "voiceover",
  "captions",
  "sync",
  "export",
];

function initialStages(): PipelineStage[] {
  return STAGE_ORDER.map((id) => ({ id, label: STAGE_LABELS[id], status: "pending" }));
}

export interface AvsPipeline {
  stages: PipelineStage[];
  running: boolean;
  /** Whether the pipeline can run right now (saved demo + fetchable source). */
  canRun: boolean;
  /** Why the pipeline is blocked, if `canRun` is false. */
  blockedReason: string | null;
  /** The exported, AI-voiced/synced/subtitled MP4 URL once the run completes. */
  exportedUrl: string | null;
  run: () => void;
}

// --- Stage helpers -----------------------------------------------------------
// Each helper owns one stage's network work and returns plain data. The hook
// wires them together and reflects progress into the stage list. Keeping these
// at module scope keeps the orchestration readable and the calls testable.

/** Poll `/api/jobs/[id]` until it completes or fails; returns the job payload. */
async function pollJob(jobId: string): Promise<Record<string, unknown>> {
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    const res = await axios.get(`/api/jobs/${jobId}`);
    const data = (res.data ?? {}) as Record<string, unknown>;
    const state = typeof data.state === "string" ? data.state : "";
    if (state === "completed") {
      return data;
    }
    if (state === "failed") {
      throw new Error(typeof data.error === "string" ? data.error : "Job failed");
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for the job to finish");
}

/** Rewrite per-step narration into `tone` via `/api/avs/script` (OpenAI). */
async function rewriteScript(lines: ScriptLine[], tone: ScriptTone): Promise<ScriptLine[]> {
  const res = await axios.post("/api/avs/script", { lines, tone });
  const returned = (res.data?.lines ?? []) as ScriptLine[];
  const rewritten = new Map(returned.map((l) => [l.stepId, l.text]));
  return lines.map((l) => ({ stepId: l.stepId, text: rewritten.get(l.stepId) ?? l.text }));
}

/** Synthesize one continuous MP3 via `/api/avs/voiceover` (Aura in the worker). */
async function synthesizeVoiceover(
  lines: ScriptLine[],
  voiceId: string,
  pronunciation: PronunciationRule[]
): Promise<VoiceoverTrack> {
  const res = await axios.post("/api/avs/voiceover", { lines, voiceId, pronunciation });
  const data = res.data as Partial<VoiceoverTrack>;
  if (typeof data.audioUrl !== "string" || !data.audioUrl) {
    throw new Error("Voiceover produced no audio");
  }
  return {
    audioUrl: data.audioUrl,
    duration: typeof data.duration === "number" ? data.duration : 0,
    voiceId: isAvsVoiceId(data.voiceId) ? (data.voiceId as string) : voiceId,
    stepTimings: Array.isArray(data.stepTimings) ? data.stepTimings : [],
  };
}

/** Transcribe the voiceover audio into stabilized, flicker-free captions. */
async function generateCaptions(audioUrl: string): Promise<CaptionCue[]> {
  // demoId omitted so this never overwrites the demo's own subtitles.
  const createRes = await axios.post("/api/subtitles/create", {
    videoUrl: audioUrl,
    demoId: null,
    language: "multi",
  });
  const jobId = createRes.data?.jobId as string | undefined;
  if (!jobId) {
    throw new Error("No caption job id returned");
  }
  const jobData = await pollJob(jobId);
  const rawCues = Array.isArray(jobData.subtitles) ? (jobData.subtitles as Cue[]) : [];
  return stabilizeCues(rawCues);
}

interface AlignInput {
  videoUrl: string;
  audioUrl: string;
  steps: Step[];
  stepTimings: StepTiming[];
  duration: number;
  demoId: string | null;
}

/** Run the freeze-frame/silence pre-pass via `/api/avs/sync`; poll for the result. */
async function alignSource(input: AlignInput): Promise<AlignedSource> {
  const res = await axios.post("/api/avs/sync", input);
  const jobId = res.data?.jobId as string | undefined;
  if (!jobId) {
    throw new Error("Time-alignment did not start");
  }
  const data = await pollJob(jobId);
  const aligned =
    data.aligned && typeof data.aligned === "object"
      ? (data.aligned as Record<string, unknown>)
      : {};
  const videoUrl = typeof aligned.alignedVideoUrl === "string" ? aligned.alignedVideoUrl : "";
  if (!videoUrl) {
    throw new Error("Time-alignment returned no aligned source");
  }
  return {
    videoUrl,
    duration: typeof aligned.duration === "number" ? aligned.duration : input.duration,
  };
}

interface ExportInput {
  aligned: AlignedSource;
  captions: CaptionCue[];
  title: string;
  demoId: string | null;
  selectedBackground: string;
  aspectRatio: string;
  browserFrame: { mode: string; drawShadow: boolean; drawBorder: boolean };
}

/**
 * Feed the aligned source (voiceover already muxed in) + stabilized captions into
 * the EXISTING export route. Additive: nothing about the non-AVS export changes.
 * Trims/zoom are dropped — their timings don't map onto the realigned timeline.
 */
async function exportAligned(input: ExportInput): Promise<string> {
  const res = await axios.post("/api/jobs/create", {
    videoUrl: input.aligned.videoUrl,
    title: input.title,
    description: "",
    demoId: input.demoId,
    segments: [],
    zoomEffects: [],
    textOverlays: [],
    subtitles: input.captions,
    duration: input.aligned.duration,
    selectedBackground: input.selectedBackground,
    customBackgroundUrl: null,
    aspectRatio: input.aspectRatio,
    browserFrame: input.browserFrame,
    imageMap: {},
    settings: { quality: "720p", fps: "24 FPS", compression: "Web", speed: "Default" },
  });
  const jobId = res.data?.jobId as string | undefined;
  if (!jobId) {
    throw new Error("Export did not start");
  }
  const data = await pollJob(jobId);
  const url = typeof data.exportedUrl === "string" ? data.exportedUrl : "";
  if (!url) {
    throw new Error("Export finished without an output URL");
  }
  return url;
}

/**
 * End-to-end AVS orchestration (PR 7): a single "Generate AI Voiceover Demo"
 * action that runs steps → script → voiceover → subtitles → time-alignment →
 * export, reusing the PR 3–6 routes. Each stage reports its own status for the
 * progress UI, and every result is written back to the store's `avs` slice, so
 * the existing autosave persists the whole thing into `Demo.editing.avs`.
 *
 * Degrades gracefully: no clicks → one full-length step; no transcript → empty
 * script the user can fill; a failed rewrite or caption pass is non-fatal (the
 * run continues with what it has). The voiceover and time-alignment are required
 * for a meaningful export, so a hard failure there stops the run with a message.
 */
export function useAvsPipeline(): AvsPipeline {
  const {
    videoUrl,
    duration,
    savedDemoId,
    sidebarTitle,
    avs,
    setAvs,
    selectedBackground,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
  } = useEditorStore(
    useShallow((s) => ({
      videoUrl: s.videoUrl,
      duration: s.duration,
      savedDemoId: s.savedDemoId,
      sidebarTitle: s.sidebarTitle,
      avs: s.avs,
      setAvs: s.setAvs,
      selectedBackground: s.selectedBackground,
      aspectRatio: s.aspectRatio,
      browserFrameMode: s.browserFrameMode,
      browserFrameDrawShadow: s.browserFrameDrawShadow,
      browserFrameDrawBorder: s.browserFrameDrawBorder,
    }))
  );

  const { extensionEvents, zoomSegments } = useZoomStore(
    useShallow((s) => ({
      extensionEvents: s.extensionEvents,
      zoomSegments: s.zoomSegments,
    }))
  );

  const transcriptCues = useSubtitleStore((s) => s.subtitleCues);

  const [stages, setStages] = React.useState<PipelineStage[]>(initialStages);
  const [running, setRunning] = React.useState(false);
  const [exportedUrl, setExportedUrl] = React.useState<string | null>(null);

  // A fetchable https/gs source is required: the sync + export workers download
  // it server-side, so an un-uploaded blob URL cannot be aligned.
  const hasFetchableSource =
    typeof videoUrl === "string" && videoUrl.length > 0 && !videoUrl.startsWith("blob:");

  const blockedReason = React.useMemo<string | null>(() => {
    if (!savedDemoId) {
      return "Save the demo first, then generate its AI voiceover.";
    }
    if (!hasFetchableSource) {
      return "The source video is still uploading — try again in a moment.";
    }
    if (!(duration > 0)) {
      return "Load a video before generating.";
    }
    return null;
  }, [savedDemoId, hasFetchableSource, duration]);

  const canRun = blockedReason === null;

  const patchStage = React.useCallback((id: PipelineStageId, patch: Partial<PipelineStage>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // Persist a partial AVS update, preserving the other fields.
  const mergeAvs = React.useCallback(
    (patch: Partial<AvsState>) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        return { ...base, ...patch };
      });
    },
    [setAvs]
  );

  // Resolve the per-step narration to voice: stored text merged over the current
  // steps, seeded from the transcript when everything is still empty.
  const resolveScriptLines = React.useCallback(
    (steps: Step[]): ScriptLine[] => {
      const stored = new Map((avs?.script?.lines ?? []).map((l) => [l.stepId, l.text]));
      const merged = steps.map((step) => ({
        stepId: step.id,
        text: (stored.get(step.id) ?? "").trim(),
      }));
      return merged.every((l) => l.text.length === 0)
        ? seedScriptLines(steps, transcriptCues)
        : merged;
    },
    [avs?.script?.lines, transcriptCues]
  );

  const run = React.useCallback(async () => {
    if (running) {
      return;
    }
    if (!canRun) {
      toast.error(blockedReason ?? "Cannot generate right now");
      return;
    }

    setRunning(true);
    setExportedUrl(null);
    setStages(initialStages());
    const toastId = toast.loading("Generating AI voiceover demo…");

    try {
      // ---- Stage 1: steps ---------------------------------------------------
      patchStage("steps", { status: "running" });
      let steps: Step[] = avs?.steps ?? [];
      if (steps.length === 0) {
        steps = deriveSteps(resolveClickTimes(extensionEvents, zoomSegments), duration);
        mergeAvs({ steps });
      }
      if (steps.length === 0) {
        throw new Error("Could not derive any steps from the video");
      }
      patchStage("steps", {
        status: "done",
        note: `${steps.length} step${steps.length === 1 ? "" : "s"}`,
      });

      // ---- Stage 2: AI script ----------------------------------------------
      patchStage("script", { status: "running" });
      let lines = resolveScriptLines(steps);
      if (lines.every((l) => l.text.trim().length === 0)) {
        throw new Error("No script text — add narration or generate a transcript first");
      }
      const tone: ScriptTone = avs?.script?.tone ?? "sales";
      // Rewrite is best effort — keep the seeded text if OpenAI is unavailable.
      let scriptWarning: string | undefined;
      try {
        lines = await rewriteScript(
          lines.filter((l) => l.text.trim().length > 0),
          tone
        );
      } catch {
        scriptWarning = "Rewrite skipped — using the seeded narration";
      }
      mergeAvs({ script: { tone, lines } });
      patchStage("script", {
        status: scriptWarning ? "warning" : "done",
        note: scriptWarning ?? `Rewritten in ${tone} tone`,
      });

      // ---- Stage 3: voiceover ----------------------------------------------
      patchStage("voiceover", { status: "running" });
      const voiceId = isAvsVoiceId(avs?.voiceover?.voiceId)
        ? (avs?.voiceover?.voiceId as string)
        : DEFAULT_AVS_VOICE;
      const pronunciation = (avs?.pronunciation ?? []).filter(
        (r) => r.term.trim().length > 0 && r.phonetic.trim().length > 0
      );
      const voiceover = await synthesizeVoiceover(
        lines.filter((l) => l.text.trim().length > 0),
        voiceId,
        pronunciation
      );
      mergeAvs({ voiceover });
      patchStage("voiceover", {
        status: "done",
        note: `${voiceover.duration.toFixed(1)}s continuous MP3`,
      });

      // ---- Stage 4: captions (non-fatal) -----------------------------------
      patchStage("captions", { status: "running" });
      let captions: CaptionCue[] = avs?.captions ?? [];
      try {
        captions = await generateCaptions(voiceover.audioUrl);
        mergeAvs({ captions });
        patchStage("captions", {
          status: captions.length > 0 ? "done" : "warning",
          note:
            captions.length > 0
              ? `${captions.length} caption${captions.length === 1 ? "" : "s"}`
              : "No speech detected",
        });
      } catch {
        patchStage("captions", { status: "warning", note: "Skipped — export continues" });
      }

      // ---- Stage 5: time-alignment -----------------------------------------
      patchStage("sync", { status: "running" });
      const aligned = await alignSource({
        videoUrl: videoUrl as string,
        audioUrl: voiceover.audioUrl,
        steps,
        stepTimings: voiceover.stepTimings,
        duration,
        demoId: savedDemoId,
      });
      mergeAvs({ aligned });
      patchStage("sync", {
        status: "done",
        note: `Aligned source (${aligned.duration.toFixed(1)}s)`,
      });

      // ---- Stage 6: export --------------------------------------------------
      patchStage("export", { status: "running" });
      const finalUrl = await exportAligned({
        aligned,
        captions,
        title: sidebarTitle?.trim() || "AI Voiceover Demo",
        demoId: savedDemoId,
        selectedBackground: selectedBackground ?? "transparent",
        aspectRatio: aspectRatio || "native",
        browserFrame: {
          mode: browserFrameMode,
          drawShadow: browserFrameDrawShadow,
          drawBorder: browserFrameDrawBorder,
        },
      });
      setExportedUrl(finalUrl);
      patchStage("export", { status: "done", note: "Ready to download" });

      toast.success("AI voiceover demo ready", { id: toastId });
    } catch (e: unknown) {
      const message =
        axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
          ? e.response.data.error
          : e instanceof Error
            ? e.message
            : "Failed to generate AI voiceover demo";
      // Mark the first still-running stage as the failure point.
      setStages((prev) => {
        const idx = prev.findIndex((s) => s.status === "running");
        return idx === -1
          ? prev
          : prev.map((s, i) => (i === idx ? { ...s, status: "error", note: message } : s));
      });
      toast.error(message, { id: toastId });
    } finally {
      setRunning(false);
    }
  }, [
    running,
    canRun,
    blockedReason,
    avs,
    mergeAvs,
    patchStage,
    resolveScriptLines,
    extensionEvents,
    zoomSegments,
    duration,
    videoUrl,
    savedDemoId,
    sidebarTitle,
    selectedBackground,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
  ]);

  return {
    stages,
    running,
    canRun,
    blockedReason,
    exportedUrl,
    run,
  };
}
