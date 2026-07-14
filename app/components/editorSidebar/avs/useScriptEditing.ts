import React from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import type { AvsState, ScriptDoc, ScriptLine, Step } from "@/app/types/avs";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";
import { seedScriptLines, seedScriptRaw } from "@/app/lib/avs/seedScript";
import { SCRIPT_TONES, type ScriptTone } from "@/app/lib/avs/tones";

export interface ScriptEditing {
  /** True when the demo has steps → per-step editing; false → single-blob fallback. */
  hasSteps: boolean;
  /** One line per current step (stored text merged over the step list). */
  lines: ScriptLine[];
  /** The single free-form blob used when there are no steps. */
  raw: string;
  /** Currently selected tone (persisted to `avs.script.tone`). */
  tone: ScriptTone;
  /** Whether a transcript is available to seed from. */
  hasTranscript: boolean;
  /** Whether there is any script text to rewrite. */
  hasContent: boolean;
  rewriting: boolean;
  setTone: (tone: ScriptTone) => void;
  updateLine: (stepId: string, text: string) => void;
  setRaw: (text: string) => void;
  seedFromTranscript: () => void;
  handleRewrite: () => void;
}

/**
 * Owns the AVS script for the panel (AVS-2.1): seeds per-step narration from the
 * Deepgram transcript, keeps it editable, and rewrites it into a tone via
 * `/api/avs/script` (OpenAI, server-side). Text is written back to
 * `avs.script`, which the existing autosave persists into `Demo.editing.avs`.
 *
 * Degrades gracefully: with no steps it edits a single raw blob seeded from the
 * whole transcript; with no transcript it just starts empty.
 */
export function useScriptEditing(): ScriptEditing {
  const { duration, avs, setAvs } = useEditorStore(
    useShallow((s) => ({
      duration: s.duration,
      avs: s.avs,
      setAvs: s.setAvs,
    }))
  );

  const cues = useSubtitleStore((s) => s.subtitleCues);

  const steps = React.useMemo<Step[]>(() => avs?.steps ?? [], [avs?.steps]);
  const script = avs?.script;
  const hasSteps = steps.length > 0;
  const hasTranscript = cues.length > 0;

  const [rewriting, setRewriting] = React.useState(false);

  // Preserve other AVS fields (steps, voiceover, …) when only the script changes.
  const updateScript = React.useCallback(
    (updater: (prev: ScriptDoc) => ScriptDoc) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        const prevScript: ScriptDoc = base.script ?? { lines: [] };
        return { ...base, script: updater(prevScript) };
      });
    },
    [setAvs]
  );

  // Effective per-step lines: stored text merged over the current step list, so
  // steps added by split/merge always get a (possibly empty) editable line.
  const lines = React.useMemo<ScriptLine[]>(() => {
    const stored = new Map((script?.lines ?? []).map((l) => [l.stepId, l.text]));
    return steps.map((step) => ({ stepId: step.id, text: stored.get(step.id) ?? "" }));
  }, [steps, script?.lines]);

  const raw = script?.raw ?? "";
  const tone: ScriptTone = script?.tone ?? SCRIPT_TONES[0].id;

  const hasContent = hasSteps ? lines.some((l) => l.text.trim().length > 0) : raw.trim().length > 0;

  const seedFromTranscript = React.useCallback(() => {
    if (hasSteps) {
      const seeded = seedScriptLines(steps, cues);
      updateScript((prev) => ({ ...prev, lines: seeded }));
    } else {
      updateScript((prev) => ({ ...prev, raw: seedScriptRaw(cues) }));
    }
  }, [hasSteps, steps, cues, updateScript]);

  // Auto-seed narration from the transcript the first time we have one and the
  // script is still empty, so the headline flow is one click (pick tone →
  // rewrite). Separate guards per mode avoid the brief window where the
  // transcript is ready but steps haven't been derived yet.
  const seededLinesRef = React.useRef(false);
  const seededRawRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasTranscript) {
      return;
    }
    if (hasSteps && !seededLinesRef.current) {
      const hasLineText = (script?.lines ?? []).some((l) => l.text.trim().length > 0);
      if (!hasLineText) {
        updateScript((prev) => ({ ...prev, lines: seedScriptLines(steps, cues) }));
      }
      seededLinesRef.current = true;
    } else if (!hasSteps && duration > 0 && !seededRawRef.current) {
      if (!(script?.raw ?? "").trim()) {
        updateScript((prev) => ({ ...prev, raw: seedScriptRaw(cues) }));
      }
      seededRawRef.current = true;
    }
  }, [hasTranscript, hasSteps, steps, cues, duration, script?.lines, script?.raw, updateScript]);

  const setTone = React.useCallback(
    (next: ScriptTone) => {
      updateScript((prev) => ({ ...prev, tone: next }));
    },
    [updateScript]
  );

  const updateLine = React.useCallback(
    (stepId: string, text: string) => {
      updateScript((prev) => {
        const next = [...prev.lines];
        const idx = next.findIndex((l) => l.stepId === stepId);
        if (idx === -1) {
          next.push({ stepId, text });
        } else {
          next[idx] = { stepId, text };
        }
        return { ...prev, lines: next };
      });
    },
    [updateScript]
  );

  const setRaw = React.useCallback(
    (text: string) => {
      updateScript((prev) => ({ ...prev, raw: text }));
    },
    [updateScript]
  );

  const handleRewrite = React.useCallback(async () => {
    if (rewriting) {
      return;
    }
    if (!hasContent) {
      toast.error("Add or seed some script text first");
      return;
    }

    const toastId = toast.loading("Rewriting script...");
    setRewriting(true);
    try {
      if (hasSteps) {
        const payloadLines = lines.filter((l) => l.text.trim().length > 0);
        const res = await axios.post("/api/avs/script", { lines: payloadLines, tone });
        const returned = (res.data?.lines ?? []) as ScriptLine[];
        const rewritten = new Map(returned.map((l) => [l.stepId, l.text]));
        updateScript((prev) => {
          const existing = new Map(prev.lines.map((l) => [l.stepId, l.text]));
          const merged = steps.map((step) => ({
            stepId: step.id,
            text: rewritten.get(step.id) ?? existing.get(step.id) ?? "",
          }));
          return { ...prev, tone, lines: merged };
        });
      } else {
        const res = await axios.post("/api/avs/script", { raw, tone });
        const returnedRaw = typeof res.data?.raw === "string" ? res.data.raw : raw;
        updateScript((prev) => ({ ...prev, tone, raw: returnedRaw }));
      }
      toast.success("Script rewritten", { id: toastId });
    } catch (e: unknown) {
      const message =
        axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
          ? e.response.data.error
          : e instanceof Error
            ? e.message
            : "Failed to rewrite script";
      toast.error(message, { id: toastId });
    } finally {
      setRewriting(false);
    }
  }, [rewriting, hasContent, hasSteps, lines, raw, tone, steps, updateScript]);

  return {
    hasSteps,
    lines,
    raw,
    tone,
    hasTranscript,
    hasContent,
    rewriting,
    setTone,
    updateLine,
    setRaw,
    seedFromTranscript,
    handleRewrite,
  };
}
