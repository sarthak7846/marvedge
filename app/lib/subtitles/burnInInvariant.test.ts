import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { insertCue, mergeCues, normalizeCues, splitCueAt } from "./cues";
import type { SubtitleCue } from "./types";

/**
 * THE BURN-IN INVARIANT TEST (PR 7 / PRD §13).
 *
 * `remapSubtitleCuesToTrimmedTimeline()` in cloudrun-worker/render.js assumes
 * the cue list it is handed is **sorted and non-overlapping**, and two
 * overlapping ASS `Dialogue` lines render stacked on top of each other rather
 * than one after the other. Until PR 2 that assumption held by luck: the worker
 * was the only producer of cues, and its clustering never overlaps.
 *
 * That is no longer true. A user can now drag a cue's edge over its neighbour,
 * split one, merge two, add one into a gap and retype another — PRD §13 lists an
 * overlapping cue set as an explicit edge case. `normalizeCues()` is the single
 * place the invariant is re-established, and every mutation in the subtitle store
 * ends in it.
 *
 * WHAT THIS TEST IS FOR, AND WHY IT IS NOT IN cues.test.ts. cues.test.ts already
 * proves `normalizeCues` produces a sorted, non-overlapping list. What it cannot
 * prove is that the property SURVIVES the rest of the pipeline — the chunk slice,
 * the trim remap, and the ASS serialization with its centisecond rounding. This
 * suite drives the REAL worker functions, end to end, on cue lists built by
 * actually performing the edits, and asserts the invariant on the Dialogue lines
 * that come out the far end. That is the only place it actually matters.
 *
 * If this fails, subtitles will render stacked in an exported video. Fix the
 * pipeline; do not relax the assertion.
 */

const require_ = createRequire(import.meta.url);
const worker = require_(path.join(process.cwd(), "cloudrun-worker", "render.js")) as {
  writeAssSubtitles: (
    tempDir: string,
    cues: SubtitleCue[],
    w: number,
    h: number,
    style?: unknown,
    language?: unknown
  ) => string;
  remapSubtitleCuesToTrimmedTimeline: (
    rawCues: readonly SubtitleCue[],
    keepSegments: readonly { start: number; end: number }[],
    removeSegments: readonly { start: number; end: number }[]
  ) => SubtitleCue[];
  overlapSliceAbsolute: <T>(
    items: readonly T[],
    chunkStart: number,
    chunkEnd: number,
    mapItem: (item: T) => SubtitleCue
  ) => SubtitleCue[];
  normalizeRemoveSegments: (
    raw: readonly { start: number | string; end: number | string }[],
    duration: number
  ) => { start: number; end: number }[];
  invertToKeepSegments: (
    removeSegments: readonly { start: number; end: number }[],
    duration: number
  ) => { start: number; end: number }[];
};

/** One parsed `Dialogue:` line, in centiseconds — the resolution ASS stores. */
interface DialogueLine {
  startCs: number;
  endCs: number;
  text: string;
}

/** `0:01:02.34` -> 6234 centiseconds. */
function assTimeToCs(stamp: string): number {
  const m = stamp.match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) {
    throw new Error(`Unparseable ASS timestamp: ${stamp}`);
  }
  return Number(m[1]) * 360000 + Number(m[2]) * 6000 + Number(m[3]) * 100 + Number(m[4]);
}

/**
 * Run the worker's real serializer and read back what it wrote.
 *
 * Deliberately goes through the file rather than asserting on the cue array: the
 * file is what ffmpeg's `subtitles=` filter consumes, and the centisecond
 * rounding that happens on the way into it is exactly the step that could turn
 * two adjacent cues into two overlapping ones.
 */
function renderDialogueLines(cues: SubtitleCue[]): DialogueLine[] {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sub-burnin-"));
  try {
    const assPath = worker.writeAssSubtitles(tempDir, cues, 1920, 1080);
    const contents = fs.readFileSync(assPath, "utf8");
    return contents
      .split("\n")
      .filter((line) => line.startsWith("Dialogue:"))
      .map((line) => {
        // Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
        const fields = line.slice("Dialogue:".length).split(",");
        return {
          startCs: assTimeToCs(fields[1].trim()),
          endCs: assTimeToCs(fields[2].trim()),
          text: fields.slice(9).join(","),
        };
      });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * The assertion this whole suite exists for: every Dialogue line starts at or
 * after the previous one ends, in the resolution the file is actually stored in.
 */
function expectOrderedAndNonOverlapping(lines: DialogueLine[]) {
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    expect(
      curr.startCs,
      `Dialogue line ${i} ("${curr.text}") starts at ${curr.startCs}cs, ` +
        `before line ${i - 1} ("${prev.text}") ends at ${prev.endCs}cs — ` +
        "these two will render stacked on top of each other."
    ).toBeGreaterThanOrEqual(prev.endCs);
    expect(curr.endCs).toBeGreaterThanOrEqual(curr.startCs);
  }
}

/**
 * The full export path for one 10-second chunk, exactly as
 * `renderChunkFromRecipe` runs it: slice the recipe's cues to the chunk window,
 * invert the trim segments into keep segments, remap the cues across them.
 */
function runExportPipeline(
  recipeCues: readonly SubtitleCue[],
  options: {
    chunkStart?: number;
    chunkEnd?: number;
    timelineDuration: number;
    trimSegments?: { start: number; end: number }[];
  }
): SubtitleCue[] {
  const chunkStart = options.chunkStart ?? 0;
  const chunkEnd = options.chunkEnd ?? options.timelineDuration;

  const sliced = worker.overlapSliceAbsolute(recipeCues, chunkStart, chunkEnd, (s) => ({
    start: Number(s.start),
    end: Number(s.end),
    text: String(s.text || ""),
  }));

  const removeSegments = worker.normalizeRemoveSegments(
    options.trimSegments ?? [],
    options.timelineDuration
  );
  const keepSegments = worker.invertToKeepSegments(removeSegments, options.timelineDuration);

  return worker.remapSubtitleCuesToTrimmedTimeline(sliced, keepSegments, removeSegments);
}

/** A clean, worker-shaped transcript: sorted, non-overlapping, ~2s per cue. */
const GENERATED: SubtitleCue[] = [
  { start: 0.4, end: 2.6, text: "Welcome to the product tour." },
  { start: 2.8, end: 5.1, text: "First we open the dashboard." },
  { start: 5.3, end: 7.4, text: "Every metric updates live." },
  { start: 7.6, end: 9.8, text: "Let's create a new report." },
  { start: 10.2, end: 12.5, text: "Pick a template to start from." },
  { start: 12.7, end: 15.0, text: "And share it with your team." },
];

describe("burn-in invariant: an edited cue set still renders ordered and non-overlapping", () => {
  it("holds for the untouched generated transcript (the baseline)", () => {
    const remapped = runExportPipeline(GENERATED, { timelineDuration: 16 });
    const lines = renderDialogueLines(remapped);
    expect(lines).toHaveLength(GENERATED.length);
    expectOrderedAndNonOverlapping(lines);
  });

  it("holds after a drag pulls one cue's start back over its neighbour", () => {
    // The gesture PRD §13 names: the user grabs cue 3's left edge and drags it
    // left, deep into cue 2. Built by hand rather than through the store so the
    // overlap is unambiguous — this list IS overlapping.
    const dragged = GENERATED.slice();
    dragged[2] = { ...dragged[2], start: 3.4 };
    expect(dragged[2].start).toBeLessThan(dragged[1].end); // overlapping by construction

    const normalized = normalizeCues(dragged, { durationSeconds: 16 });
    const remapped = runExportPipeline(normalized, { timelineDuration: 16 });
    const lines = renderDialogueLines(remapped);

    expect(lines.length).toBeGreaterThan(0);
    expectOrderedAndNonOverlapping(lines);
  });

  it("holds after a drag pushes one cue's end over the cue after it", () => {
    const dragged = GENERATED.slice();
    dragged[0] = { ...dragged[0], end: 4.9 };
    dragged[3] = { ...dragged[3], end: 11.4 };

    const normalized = normalizeCues(dragged, { durationSeconds: 16 });
    const remapped = runExportPipeline(normalized, { timelineDuration: 16 });
    expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
  });

  it("holds after a cue is dragged bodily on top of another", () => {
    // A move, not a resize: the whole block slides left and lands inside cue 1.
    const dragged = GENERATED.slice();
    const moved = dragged[4];
    const span = moved.end - moved.start;
    dragged[4] = { ...moved, start: 1.0, end: 1.0 + span };

    const normalized = normalizeCues(dragged, { durationSeconds: 16 });
    const remapped = runExportPipeline(normalized, { timelineDuration: 16 });
    expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
  });

  it("holds after split, merge and insert are composed without normalizing between them", () => {
    // The module header for cues.ts is explicit that the primitives do NOT
    // normalize and that composing them is expected to leave a list that only
    // normalizeCues() can make renderable. This is that composition.
    let cues: SubtitleCue[] = GENERATED.slice();

    const halves = splitCueAt(cues[1], 3.9);
    expect(halves).not.toBeNull();
    cues.splice(1, 1, halves![0], halves![1]);

    cues.splice(3, 2, mergeCues(cues[3], cues[4]));

    // An added cue landing right on top of an existing one.
    cues = insertCue(cues, { start: 6.0, end: 8.0, text: "Inserted over a neighbour" });

    const normalized = normalizeCues(cues, { durationSeconds: 16 });
    const remapped = runExportPipeline(normalized, { timelineDuration: 16 });
    expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
  });

  it("holds when a trim removes a span that overlapping cues straddle", () => {
    // The interesting composition: overlapping edits AND a trim, so a cue is
    // both de-overlapped and cut in two by the same export.
    const edited = GENERATED.slice();
    edited[1] = { ...edited[1], end: 6.2 }; // over cue 2
    edited[4] = { ...edited[4], start: 9.0 }; // over cue 3

    const normalized = normalizeCues(edited, { durationSeconds: 16 });
    const remapped = runExportPipeline(normalized, {
      timelineDuration: 16,
      trimSegments: [
        { start: 4.0, end: 6.0 },
        { start: 11.0, end: 12.0 },
      ],
    });

    expect(remapped.length).toBeGreaterThan(0);
    expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
  });

  it("holds across every 10s chunk of a trimmed, edited timeline", () => {
    // Exports are rendered in 10-second chunks and each chunk writes its own ASS
    // file, so the invariant has to hold per chunk, not just globally.
    const edited = GENERATED.concat([
      { start: 15.2, end: 17.9, text: "One more thing before we finish." },
      { start: 17.5, end: 20.4, text: "Overlapping on purpose." },
      { start: 20.0, end: 23.0, text: "And so is this one." },
    ]);
    const normalized = normalizeCues(edited, { durationSeconds: 24 });
    const trimSegments = [{ start: 8.5, end: 10.5 }];

    for (let chunk = 0; chunk < 3; chunk++) {
      const remapped = runExportPipeline(normalized, {
        chunkStart: chunk * 10,
        chunkEnd: (chunk + 1) * 10,
        timelineDuration: 24,
        trimSegments,
      });
      expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
    }
  });

  it("holds for a pathological list: many cues at the same instant", () => {
    // Rule 2 territory in normalizeCues — cues that start at, or within a hair
    // of, the same time have no earlier cue left to truncate and get pushed
    // instead. Pushing cascades, which is precisely where an off-by-one would
    // reintroduce an overlap.
    const pile: SubtitleCue[] = Array.from({ length: 12 }, (_, i) => ({
      start: 3 + i * 0.001,
      end: 5 + i * 0.001,
      text: `Simultaneous cue ${i}`,
    }));

    const normalized = normalizeCues(pile, { durationSeconds: 40 });
    const remapped = runExportPipeline(normalized, { timelineDuration: 40 });
    expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
  });

  it("holds when cues sit hard against a trim boundary", () => {
    // The centisecond-rounding case. A cue clipped to a sliver by a trim gets
    // its end pushed out to a 0.04s floor by the remapper; if the next cue
    // starts at that same instant, the floor is what would create the overlap.
    const cues: SubtitleCue[] = [
      { start: 0.0, end: 4.99, text: "Right up to the cut" },
      { start: 5.0, end: 6.0, text: "Removed entirely" },
      { start: 6.0, end: 9.0, text: "Straight after the cut" },
    ];
    const normalized = normalizeCues(cues, { durationSeconds: 10 });
    const remapped = runExportPipeline(normalized, {
      timelineDuration: 10,
      trimSegments: [{ start: 4.98, end: 6.0 }],
    });
    expectOrderedAndNonOverlapping(renderDialogueLines(remapped));
  });

  it("drops nothing that normalizeCues kept, for a list with no overlaps to resolve", () => {
    // Guards the other direction: hardening the invariant must not start eating
    // legitimate cues. An untrimmed export of a clean list is one Dialogue line
    // per cue, in order, with the text intact.
    const remapped = runExportPipeline(GENERATED, { timelineDuration: 16 });
    const lines = renderDialogueLines(remapped);
    expect(lines.map((l) => l.text)).toEqual(GENERATED.map((c) => c.text));
  });
});
