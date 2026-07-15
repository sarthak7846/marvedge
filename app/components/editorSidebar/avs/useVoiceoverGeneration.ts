import React from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import type {
  AvsState,
  PronunciationRule,
  ScriptLine,
  Step,
  VoiceoverTrack,
} from "@/app/types/avs";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { DEFAULT_AVS_VOICE, isAvsVoiceId } from "@/app/lib/avs/voices";

// Synthetic stepId used for the no-steps fallback (whole script = one segment).
const RAW_STEP_ID = "raw";

export interface VoiceoverGeneration {
  /** Currently selected Aura voice id. */
  voiceId: string;
  setVoiceId: (voiceId: string) => void;
  /** Whether there is any script text to synthesize. */
  hasContent: boolean;
  generating: boolean;
  /** The persisted voiceover track (audio preview), if any. */
  voiceover: VoiceoverTrack | undefined;
  handleGenerate: () => void;
  /** Pronunciation dictionary applied before TTS. */
  pronunciation: PronunciationRule[];
  addPronunciation: () => void;
  updatePronunciation: (index: number, patch: Partial<PronunciationRule>) => void;
  removePronunciation: (index: number) => void;
}

/**
 * Owns the AVS voiceover for the panel (AVS-2.2): builds the per-step script
 * lines, lets the user pick a Deepgram Aura voice and a pronunciation
 * dictionary, and triggers `/api/avs/voiceover` (which calls the Cloud Run
 * worker). The returned track is written back to `avs.voiceover`, which the
 * existing autosave persists into `Demo.editing.avs`.
 *
 * Degrades gracefully: with no steps it sends the raw script blob as one
 * segment; with no script text the generate action is disabled.
 */
export function useVoiceoverGeneration(): VoiceoverGeneration {
  const { avs, setAvs } = useEditorStore(
    useShallow((s) => ({
      avs: s.avs,
      setAvs: s.setAvs,
    }))
  );

  const steps = React.useMemo<Step[]>(() => avs?.steps ?? [], [avs?.steps]);
  const script = avs?.script;
  const voiceover = avs?.voiceover;
  const pronunciation = React.useMemo<PronunciationRule[]>(
    () => avs?.pronunciation ?? [],
    [avs?.pronunciation]
  );

  const hasSteps = steps.length > 0;

  const [generating, setGenerating] = React.useState(false);
  const [voiceId, setVoiceIdState] = React.useState<string>(
    isAvsVoiceId(voiceover?.voiceId) ? (voiceover?.voiceId as string) : DEFAULT_AVS_VOICE
  );

  // The script lines to synthesize: per-step text merged over the current step
  // list (so split/merge stays consistent), or the raw blob as one segment.
  const lines = React.useMemo<ScriptLine[]>(() => {
    if (hasSteps) {
      const stored = new Map((script?.lines ?? []).map((l) => [l.stepId, l.text]));
      return steps
        .map((step) => ({ stepId: step.id, text: (stored.get(step.id) ?? "").trim() }))
        .filter((l) => l.text.length > 0);
    }
    const raw = (script?.raw ?? "").trim();
    return raw ? [{ stepId: RAW_STEP_ID, text: raw }] : [];
  }, [hasSteps, steps, script?.lines, script?.raw]);

  const hasContent = lines.length > 0;

  const setVoiceId = React.useCallback((next: string) => {
    setVoiceIdState(isAvsVoiceId(next) ? next : DEFAULT_AVS_VOICE);
  }, []);

  // Preserve other AVS fields (steps, script, …) when only the voiceover changes.
  const setVoiceover = React.useCallback(
    (track: VoiceoverTrack) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        return { ...base, voiceover: track };
      });
    },
    [setAvs]
  );

  const updatePronunciation = React.useCallback(
    (index: number, patch: Partial<PronunciationRule>) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        const rules = [...(base.pronunciation ?? [])];
        if (index < 0 || index >= rules.length) {
          return base;
        }
        rules[index] = { ...rules[index], ...patch };
        return { ...base, pronunciation: rules };
      });
    },
    [setAvs]
  );

  const addPronunciation = React.useCallback(() => {
    setAvs((prev) => {
      const base: AvsState = prev ?? { steps: [] };
      const rules = [...(base.pronunciation ?? []), { term: "", phonetic: "" }];
      return { ...base, pronunciation: rules };
    });
  }, [setAvs]);

  const removePronunciation = React.useCallback(
    (index: number) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        const rules = (base.pronunciation ?? []).filter((_, i) => i !== index);
        return { ...base, pronunciation: rules };
      });
    },
    [setAvs]
  );

  const handleGenerate = React.useCallback(async () => {
    if (generating) {
      return;
    }
    if (!hasContent) {
      toast.error("Add or seed some script text first");
      return;
    }

    // Only send complete pronunciation rows to the worker.
    const rules = pronunciation.filter(
      (r) => r.term.trim().length > 0 && r.phonetic.trim().length > 0
    );

    const toastId = toast.loading("Generating voiceover…");
    setGenerating(true);
    try {
      const res = await axios.post("/api/avs/voiceover", {
        lines,
        voiceId,
        pronunciation: rules,
      });
      const data = res.data as Partial<VoiceoverTrack>;
      if (typeof data.audioUrl !== "string" || !data.audioUrl) {
        throw new Error("No audio was returned");
      }
      const track: VoiceoverTrack = {
        audioUrl: data.audioUrl,
        duration: typeof data.duration === "number" ? data.duration : 0,
        voiceId: isAvsVoiceId(data.voiceId) ? (data.voiceId as string) : voiceId,
        stepTimings: Array.isArray(data.stepTimings) ? data.stepTimings : [],
      };
      setVoiceover(track);
      toast.success("Voiceover ready", { id: toastId });
    } catch (e: unknown) {
      const message =
        axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
          ? e.response.data.error
          : e instanceof Error
            ? e.message
            : "Failed to generate voiceover";
      toast.error(message, { id: toastId });
    } finally {
      setGenerating(false);
    }
  }, [generating, hasContent, lines, voiceId, pronunciation, setVoiceover]);

  return {
    voiceId,
    setVoiceId,
    hasContent,
    generating,
    voiceover,
    handleGenerate,
    pronunciation,
    addPronunciation,
    updatePronunciation,
    removePronunciation,
  };
}
