// Transcript seeding for the AVS script (AVS-2.1).
//
// The Deepgram subtitle flow (see app/(signed)/editor/hooks/useSubtitles.ts)
// produces `SubtitleCue`s ({start, end, text}) on `Demo.subtitles`. These pure
// helpers turn that transcript into starting narration text for the script:
//   - with steps → one `ScriptLine` per step, seeded from the cues that fall in
//     that step's time range;
//   - without steps → a single raw blob of the whole transcript (the fallback
//     the panel edits in a single textarea).
//
// Everything here is a pure, deterministic function over its inputs so it is easy
// to reason about and reuse (panel seeding, tests).

import type { ScriptLine, Step } from "@/app/types/avs";

/** Minimal cue shape — matches `SubtitleCue` from the editor without importing it. */
export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

/** Midpoint of a cue; used to assign each cue to exactly one step. */
function cueMidpoint(cue: TranscriptCue): number {
  return (cue.start + cue.end) / 2;
}

/** Join cue texts into a single space-separated, trimmed string. */
function joinCues(cues: TranscriptCue[]): string {
  return cues
    .map((c) => c.text.trim())
    .filter((t) => t.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Seed one `ScriptLine` per step from the transcript. A cue is assigned to the
 * step whose `[startTime, endTime]` range contains the cue's midpoint (so each
 * cue lands in exactly one step, even when cues straddle a boundary). The last
 * step also absorbs any cues past the final boundary. Steps with no cues get an
 * empty string so the panel still renders an editable textarea for them.
 */
export function seedScriptLines(steps: Step[], cues: TranscriptCue[]): ScriptLine[] {
  const usable = cues.filter(
    (c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.text.trim().length > 0
  );

  return steps.map((step, i) => {
    const isLast = i === steps.length - 1;
    const inStep = usable.filter((c) => {
      const mid = cueMidpoint(c);
      // Half-open [start, end) for interior steps; the last step is inclusive so
      // trailing cues (or ones a touch past `duration`) are never dropped.
      return mid >= step.startTime && (isLast ? true : mid < step.endTime);
    });
    return { stepId: step.id, text: joinCues(inStep) };
  });
}

/** Flatten the whole transcript into one blob — the no-steps fallback seed. */
export function seedScriptRaw(cues: TranscriptCue[]): string {
  return joinCues(cues.filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end)));
}
