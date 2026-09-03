import { describe, expect, it } from "vitest";

import {
  MIN_CUE_SECONDS,
  cuesToSearchText,
  deleteCue,
  findActiveCue,
  insertCue,
  mergeCues,
  normalizeCues,
  readCueList,
  splitCueAt,
} from "./cues";
import type { SubtitleCue } from "./types";

// Tolerance for floating-point duration comparisons.
const EPS = 1e-6;

/** The invariant the render worker depends on: sorted and non-overlapping. */
function isSortedAndNonOverlapping(cues: SubtitleCue[]): boolean {
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].end > cues[i + 1].start + EPS) {
      return false;
    }
    if (cues[i].start > cues[i + 1].start + EPS) {
      return false;
    }
  }
  return cues.every((c) => c.end > c.start);
}

describe("normalizeCues", () => {
  it("sorts cues by start time", () => {
    const out = normalizeCues([
      { start: 3, end: 4, text: "c" },
      { start: 0, end: 1, text: "a" },
      { start: 1, end: 2, text: "b" },
    ]);
    expect(out.map((c) => c.text)).toEqual(["a", "b", "c"]);
  });

  it("clamps cues into [0, durationSeconds]", () => {
    const out = normalizeCues(
      [
        { start: -5, end: 2, text: "early" },
        { start: 8, end: 20, text: "late" },
      ],
      { durationSeconds: 10 }
    );
    expect(out[0].start).toBe(0);
    expect(out[1].end).toBe(10);
  });

  it("drops a cue that starts at or past the end of the video", () => {
    const out = normalizeCues([{ start: 12, end: 15, text: "past the end" }], {
      durationSeconds: 10,
    });
    expect(out).toEqual([]);
  });

  it("enforces a minimum duration on zero-width and inverted cues", () => {
    const out = normalizeCues([
      { start: 1, end: 1, text: "zero width" },
      { start: 5, end: 3, text: "inverted" },
    ]);
    expect(out[0].end).toBeCloseTo(1 + MIN_CUE_SECONDS, 6);
    expect(out[1].start).toBe(5);
    expect(out[1].end).toBeCloseTo(5 + MIN_CUE_SECONDS, 6);
  });

  it("drops unusable cues", () => {
    const out = normalizeCues([
      { start: 0, end: 1, text: "keep" },
      { start: 2, end: 3, text: "   " },
      { start: Number.NaN, end: 5, text: "nan" },
      null,
      "nonsense",
    ]);
    expect(out).toEqual([{ start: 0, end: 1, text: "keep" }]);
  });

  // --- the overlap rule ----------------------------------------------------

  it("resolves a partial overlap by truncating the earlier cue", () => {
    const out = normalizeCues([
      { start: 0, end: 5, text: "a" },
      { start: 3, end: 7, text: "b" },
    ]);
    expect(out).toEqual([
      { start: 0, end: 3, text: "a" },
      { start: 3, end: 7, text: "b" },
    ]);
  });

  it("resolves a cue fully contained inside another (the adversarial case)", () => {
    const out = normalizeCues([
      { start: 0, end: 10, text: "outer" },
      { start: 2, end: 3, text: "inner" },
    ]);
    // The outer cue is truncated at the inner one's start, leaving a gap after
    // it rather than two Dialogue lines stacked on top of each other.
    expect(out).toEqual([
      { start: 0, end: 2, text: "outer" },
      { start: 2, end: 3, text: "inner" },
    ]);
    expect(isSortedAndNonOverlapping(out)).toBe(true);
  });

  it("pushes the later cue when two cues share a start", () => {
    const out = normalizeCues([
      { start: 0, end: 10, text: "long" },
      { start: 0, end: 3, text: "short" },
    ]);
    // Truncating would erase the earlier cue, so the later one is moved after
    // it instead. Both texts survive.
    expect(out).toEqual([
      { start: 0, end: 3, text: "short" },
      { start: 3, end: 10, text: "long" },
    ]);
  });

  it("drops a pushed cue only when it has nowhere left to live", () => {
    const out = normalizeCues(
      [
        { start: 0, end: 5, text: "fills the video" },
        { start: 0, end: 5, text: "no room" },
      ],
      { durationSeconds: 5 }
    );
    expect(out).toEqual([{ start: 0, end: 5, text: "fills the video" }]);
  });

  it("produces a sorted, non-overlapping list from a badly tangled input", () => {
    const out = normalizeCues(
      [
        { start: 4, end: 9, text: "d" },
        { start: 0, end: 6, text: "a" },
        { start: 0, end: 2, text: "b" },
        { start: 1.5, end: 8, text: "c" },
        { start: 9.5, end: 30, text: "e" },
      ],
      { durationSeconds: 12 }
    );
    expect(isSortedAndNonOverlapping(out)).toBe(true);
    expect(out.every((c) => c.start >= 0 && c.end <= 12)).toBe(true);
  });

  it("does not mutate its input", () => {
    const input = [
      { start: 0, end: 5, text: "a" },
      { start: 3, end: 7, text: "b" },
    ];
    normalizeCues(input);
    expect(input[0].end).toBe(5);
  });
});

describe("splitCueAt", () => {
  it("splits mid-cue, apportioning text by position", () => {
    const split = splitCueAt({ start: 0, end: 4, text: "one two three four" }, 2);
    expect(split).toEqual([
      { start: 0, end: 2, text: "one two" },
      { start: 2, end: 4, text: "three four" },
    ]);
  });

  it("keeps at least one word on each side of a lopsided split", () => {
    const split = splitCueAt({ start: 0, end: 10, text: "alpha beta" }, 9.5);
    expect(split).not.toBeNull();
    expect(split?.[0].text).toBe("alpha");
    expect(split?.[1].text).toBe("beta");
  });

  it("refuses to split at a cue boundary", () => {
    const cue = { start: 0, end: 4, text: "one two" };
    expect(splitCueAt(cue, 0)).toBeNull();
    expect(splitCueAt(cue, 4)).toBeNull();
  });

  it("refuses a split that would leave a sliver", () => {
    const cue = { start: 0, end: 4, text: "one two" };
    expect(splitCueAt(cue, MIN_CUE_SECONDS / 2)).toBeNull();
    expect(splitCueAt(cue, 4 - MIN_CUE_SECONDS / 2)).toBeNull();
  });

  it("carries the text into both halves when the cue is a single word", () => {
    const split = splitCueAt({ start: 0, end: 4, text: "indivisible" }, 2);
    expect(split).toEqual([
      { start: 0, end: 2, text: "indivisible" },
      { start: 2, end: 4, text: "indivisible" },
    ]);
  });
});

describe("mergeCues", () => {
  it("keeps the outer timings and both texts", () => {
    expect(
      mergeCues({ start: 0, end: 2, text: "hello" }, { start: 2, end: 5, text: "there" })
    ).toEqual({ start: 0, end: 5, text: "hello there" });
  });

  it("is insensitive to argument order", () => {
    const a = { start: 0, end: 2, text: "hello" };
    const b = { start: 2, end: 5, text: "there" };
    expect(mergeCues(b, a)).toEqual(mergeCues(a, b));
  });

  it("spans a cue contained inside another", () => {
    expect(
      mergeCues({ start: 0, end: 10, text: "outer" }, { start: 2, end: 3, text: "inner" })
    ).toEqual({ start: 0, end: 10, text: "outer inner" });
  });
});

describe("insertCue / deleteCue", () => {
  const cues: SubtitleCue[] = [
    { start: 0, end: 1, text: "a" },
    { start: 4, end: 5, text: "c" },
  ];

  it("inserts at the chronological position", () => {
    const out = insertCue(cues, { start: 2, end: 3, text: "b" });
    expect(out.map((c) => c.text)).toEqual(["a", "b", "c"]);
  });

  it("appends a cue that starts after every existing one", () => {
    const out = insertCue(cues, { start: 9, end: 10, text: "z" });
    expect(out.map((c) => c.text)).toEqual(["a", "c", "z"]);
  });

  it("deletes by index without mutating the input", () => {
    const out = deleteCue(cues, 0);
    expect(out.map((c) => c.text)).toEqual(["c"]);
    expect(cues).toHaveLength(2);
  });

  it("treats an out-of-range delete as a no-op copy", () => {
    expect(deleteCue(cues, 7)).toEqual(cues);
    expect(deleteCue(cues, -1)).toEqual(cues);
    expect(deleteCue(cues, 0)).not.toBe(cues);
  });
});

describe("findActiveCue", () => {
  const cues: SubtitleCue[] = [
    { start: 1, end: 2, text: "first" },
    { start: 2, end: 4, text: "second" },
    { start: 6, end: 8, text: "third" },
  ];

  it("returns null before the first cue", () => {
    expect(findActiveCue(cues, 0)).toBeNull();
    expect(findActiveCue(cues, 0.999)).toBeNull();
  });

  it("returns null after the last cue", () => {
    expect(findActiveCue(cues, 8.001)).toBeNull();
    expect(findActiveCue(cues, 1000)).toBeNull();
  });

  it("returns null inside a gap", () => {
    expect(findActiveCue(cues, 5)).toBeNull();
  });

  it("matches inclusively at both ends of a cue", () => {
    expect(findActiveCue(cues, 1)?.text).toBe("first");
    expect(findActiveCue(cues, 8)?.text).toBe("third");
  });

  it("gives a shared boundary to the later cue", () => {
    expect(findActiveCue(cues, 2)?.text).toBe("second");
  });

  it("finds a cue in the middle of a long list", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 1,
      text: `cue ${i}`,
    }));
    expect(findActiveCue(many, 617)?.text).toBe("cue 308");
    expect(findActiveCue(many, 617.5)).toBeNull();
  });

  it("handles an empty list and a non-finite time", () => {
    expect(findActiveCue([], 1)).toBeNull();
    expect(findActiveCue(cues, Number.NaN)).toBeNull();
  });
});

describe("readCueList / cuesToSearchText", () => {
  const cues = [
    { start: 0, end: 1, text: "hello" },
    { start: 1, end: 2, text: "world" },
  ];

  it("reads a bare cue array (what the generation route writes now)", () => {
    expect(readCueList(cues)).toEqual(cues);
  });

  it("reads the legacy { provider, language, cues } wrapper", () => {
    expect(readCueList({ provider: "deepgram", language: "multi", cues })).toEqual(cues);
  });

  it("returns an empty list for anything else", () => {
    expect(readCueList(null)).toEqual([]);
    expect(readCueList(undefined)).toEqual([]);
    expect(readCueList("subtitles")).toEqual([]);
    expect(readCueList({ provider: "deepgram" })).toEqual([]);
  });

  // The hub's subtitle search derivation. It used to inline
  // `Array.isArray(d.subtitles)`, which was always false against the object the
  // generation route wrote — so hub subtitle search matched nothing at all.
  it("derives the hub's searchable text from both persisted shapes", () => {
    expect(cuesToSearchText(cues)).toBe("hello world");
    expect(cuesToSearchText({ provider: "deepgram", language: "multi", cues })).toBe("hello world");
  });

  it("derives an empty string when a demo has no subtitles", () => {
    expect(cuesToSearchText(null)).toBe("");
    expect(cuesToSearchText({ cues: [] })).toBe("");
  });

  it("produces text a case-insensitive hub search can match", () => {
    const text = cuesToSearchText({ cues: [{ start: 0, end: 1, text: "Onboarding Flow" }] });
    expect(text.toLowerCase().includes("onboarding")).toBe(true);
  });
});
