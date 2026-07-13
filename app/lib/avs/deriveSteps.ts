// Step model for AVS (AI Script, Voiceover & Audio Synchronization).
//
// A "step" is an editable slice of the demo video. Steps are auto-derived from
// the Chrome-extension click-capture timestamps already ingested by the
// auto-zoom feature (#216), then refined by the user (split / merge / adjust)
// in the AVS panel timeline. All operations here are PURE functions over
// `Step[]` so they are trivial to reason about and reuse.
//
// Downstream AVS stages degrade gracefully: if there are no clicks (or no click
// data survives a reload) the whole video becomes a single step.

import type { Step } from "@/app/types/avs";

/**
 * Minimum length (seconds) of a step, and therefore the minimum gap enforced
 * between two adjacent boundaries. Prevents zero-width steps from rapid clicks
 * and keeps split/adjust interactions from collapsing a step to nothing.
 */
export const MIN_STEP_DURATION = 0.5;

/**
 * Deterministic id for a step starting at `startTime`. Boundaries are always
 * spaced by at least MIN_STEP_DURATION, so rounding to the millisecond yields a
 * stable, collision-free id — handy as a React key and for diffing on autosave.
 */
export function createStepId(startTime: number): string {
  return `step-${Math.max(0, Math.round(startTime * 1000))}`;
}

/** Re-number `index` to match array order after an insert/remove. */
function reindex(steps: Step[]): Step[] {
  return steps.map((step, i) => (step.index === i ? step : { ...step, index: i }));
}

/**
 * Build steps from click timestamps and the video duration.
 *
 * Each step spans from one click to the next: the first step starts at 0 and the
 * last ends at `duration`. Clicks are sanitized first — dropped if out of range
 * or non-finite, sorted, and thinned so no two boundaries sit closer than
 * MIN_STEP_DURATION (and never within MIN_STEP_DURATION of 0 or `duration`).
 *
 * FALLBACK: with no usable clicks this returns a single step covering the whole
 * video. Returns `[]` only when `duration` is not a positive number.
 */
export function deriveSteps(clickTimes: number[], duration: number): Step[] {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (safeDuration <= 0) {
    return [];
  }

  const boundaries: number[] = [];
  const sorted = [...clickTimes]
    .filter(
      (t) => Number.isFinite(t) && t > MIN_STEP_DURATION && t < safeDuration - MIN_STEP_DURATION
    )
    .sort((a, b) => a - b);

  for (const t of sorted) {
    const last = boundaries[boundaries.length - 1];
    if (last === undefined || t - last >= MIN_STEP_DURATION) {
      boundaries.push(t);
    }
  }

  const marks = [0, ...boundaries, safeDuration];
  const steps: Step[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    steps.push({
      id: createStepId(marks[i]),
      index: i,
      startTime: marks[i],
      endTime: marks[i + 1],
    });
  }
  return steps;
}

/**
 * Split the step containing `time` into two steps at `time`. The left half keeps
 * the original id and label; the right half gets a fresh id. No-op if `time`
 * does not fall strictly inside a step with room for MIN_STEP_DURATION on both
 * sides of the cut.
 */
export function splitStepAt(steps: Step[], time: number): Step[] {
  const idx = steps.findIndex(
    (s) => time > s.startTime + MIN_STEP_DURATION && time < s.endTime - MIN_STEP_DURATION
  );
  if (idx === -1) {
    return steps;
  }

  const step = steps[idx];
  const left: Step = { ...step, endTime: time };
  const right: Step = {
    id: createStepId(time),
    index: idx + 1,
    startTime: time,
    endTime: step.endTime,
  };

  return reindex([...steps.slice(0, idx), left, right, ...steps.slice(idx + 1)]);
}

/**
 * Merge the step at `index` with the following step, extending it to the next
 * step's end. The kept step retains its id and label. No-op when there is no
 * following step.
 */
export function mergeStepWithNext(steps: Step[], index: number): Step[] {
  if (index < 0 || index >= steps.length - 1) {
    return steps;
  }
  const merged: Step = { ...steps[index], endTime: steps[index + 1].endTime };
  return reindex([...steps.slice(0, index), merged, ...steps.slice(index + 2)]);
}

/**
 * Move the boundary shared by step `index` and step `index + 1` to `time`,
 * clamped so neither step shrinks below MIN_STEP_DURATION. Indices are
 * unchanged. No-op when `index` is not an interior boundary.
 */
export function adjustStepBoundary(steps: Step[], index: number, time: number): Step[] {
  if (index < 0 || index >= steps.length - 1) {
    return steps;
  }

  const prev = steps[index];
  const next = steps[index + 1];
  const min = prev.startTime + MIN_STEP_DURATION;
  const max = next.endTime - MIN_STEP_DURATION;
  if (max < min) {
    return steps;
  }

  const clamped = Math.min(max, Math.max(min, time));
  if (clamped === prev.endTime) {
    return steps;
  }

  return steps.map((s, i) => {
    if (i === index) {
      return { ...s, endTime: clamped };
    }
    if (i === index + 1) {
      return { ...s, startTime: clamped };
    }
    return s;
  });
}
