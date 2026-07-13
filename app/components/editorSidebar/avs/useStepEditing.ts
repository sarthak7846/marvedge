import React from "react";
import { useShallow } from "zustand/react/shallow";

import type { AvsState, Step } from "@/app/types/avs";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useZoomStore } from "@/app/store/editor/zoomStore";
import { resolveClickTimes } from "@/app/lib/avs/clickSources";
import {
  MIN_STEP_DURATION,
  adjustStepBoundary,
  deriveSteps,
  mergeStepWithNext,
  splitStepAt,
} from "@/app/lib/avs/deriveSteps";

export interface StepEditing {
  steps: Step[];
  duration: number;
  currentTime: number;
  selectedStepId: string | null;
  setSelectedStepId: (id: string | null) => void;
  clickTimes: number[];
  splittable: boolean;
  canMerge: boolean;
  handleSplit: () => void;
  handleMerge: () => void;
  handleAutoSlice: () => void;
  handleAdjustBoundary: (index: number, time: number) => void;
}

/**
 * Owns the AVS step model for the panel: reads live editor/zoom state, auto-
 * slices steps from click capture, and exposes split / merge / adjust / re-slice
 * actions. Steps are written back to the store's `avs.steps`, which the existing
 * autosave persists into `Demo.editing.avs`.
 */
export function useStepEditing(): StepEditing {
  const { duration, currentTime, avs, setAvs } = useEditorStore(
    useShallow((s) => ({
      duration: s.duration,
      currentTime: s.currentTime,
      avs: s.avs,
      setAvs: s.setAvs,
    }))
  );

  const { extensionEvents, zoomSegments } = useZoomStore(
    useShallow((s) => ({
      extensionEvents: s.extensionEvents,
      zoomSegments: s.zoomSegments,
    }))
  );

  const [selectedStepId, setSelectedStepId] = React.useState<string | null>(null);

  const steps = React.useMemo<Step[]>(() => avs?.steps ?? [], [avs?.steps]);

  const clickTimes = React.useMemo(
    () => resolveClickTimes(extensionEvents, zoomSegments),
    [extensionEvents, zoomSegments]
  );

  // Preserve other AVS fields (script, voiceover, …) when only steps change.
  const updateSteps = React.useCallback(
    (updater: (prevSteps: Step[]) => Step[]) => {
      setAvs((prev) => {
        const base: AvsState = prev ?? { steps: [] };
        return { ...base, steps: updater(base.steps) };
      });
    },
    [setAvs]
  );

  // Auto-slice once per demo when no steps exist yet. Click data from a fresh
  // recording arrives asynchronously from the extension, so if it isn't ready we
  // wait briefly before falling back to a single full-length step.
  const autoSliceDoneRef = React.useRef(false);
  React.useEffect(() => {
    if (autoSliceDoneRef.current || duration <= 0) {
      return;
    }
    if (steps.length > 0) {
      autoSliceDoneRef.current = true;
      return;
    }
    if (clickTimes.length > 0) {
      const derived = deriveSteps(clickTimes, duration);
      if (derived.length > 0) {
        updateSteps(() => derived);
        autoSliceDoneRef.current = true;
      }
      return;
    }
    const timer = setTimeout(() => {
      if (autoSliceDoneRef.current) {
        return;
      }
      const derived = deriveSteps([], duration);
      if (derived.length > 0) {
        updateSteps(() => derived);
      }
      autoSliceDoneRef.current = true;
    }, 1500);
    return () => clearTimeout(timer);
  }, [duration, steps.length, clickTimes, updateSteps]);

  const splittable = React.useMemo(
    () =>
      steps.some(
        (s) =>
          currentTime > s.startTime + MIN_STEP_DURATION &&
          currentTime < s.endTime - MIN_STEP_DURATION
      ),
    [steps, currentTime]
  );

  const handleSplit = React.useCallback(() => {
    updateSteps((prev) => splitStepAt(prev, currentTime));
    setSelectedStepId(null);
  }, [updateSteps, currentTime]);

  const handleMerge = React.useCallback(() => {
    if (!selectedStepId) {
      return;
    }
    const index = steps.findIndex((s) => s.id === selectedStepId);
    if (index === -1) {
      return;
    }
    // The last step has no "next" — merge it into its predecessor instead.
    const mergeIndex = index >= steps.length - 1 ? index - 1 : index;
    if (mergeIndex < 0) {
      return;
    }
    updateSteps((prev) => mergeStepWithNext(prev, mergeIndex));
    setSelectedStepId(null);
  }, [selectedStepId, steps, updateSteps]);

  const handleAdjustBoundary = React.useCallback(
    (index: number, time: number) => {
      updateSteps((prev) => adjustStepBoundary(prev, index, time));
    },
    [updateSteps]
  );

  const handleAutoSlice = React.useCallback(() => {
    const derived = deriveSteps(clickTimes, duration);
    if (derived.length > 0) {
      updateSteps(() => derived);
      setSelectedStepId(null);
    }
  }, [clickTimes, duration, updateSteps]);

  return {
    steps,
    duration,
    currentTime,
    selectedStepId,
    setSelectedStepId,
    clickTimes,
    splittable,
    canMerge: selectedStepId !== null && steps.length > 1,
    handleSplit,
    handleMerge,
    handleAutoSlice,
    handleAdjustBoundary,
  };
}
