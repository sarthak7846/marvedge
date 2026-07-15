import { describe, expect, it } from "vitest";

import {
  countWords,
  cuesToVtt,
  cuesToWords,
  formatVttTimestamp,
  minCueDuration,
  stabilizeCues,
  type Cue,
} from "./karaoke";

// Tolerance for floating-point duration comparisons.
const EPS = 1e-6;

/** True when no cue overlaps the next (allowing a tiny FP margin). */
function hasNoOverlaps(cues: Cue[]): boolean {
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].end > cues[i + 1].start + EPS) {
      return false;
    }
  }
  return true;
}

describe("minCueDuration", () => {
  it("floors at 1.5s for short cues", () => {
    expect(minCueDuration(1)).toBe(1.5);
    expect(minCueDuration(4)).toBe(1.5); // 4 * 0.35 = 1.4 < 1.5
  });

  it("uses wordCount * 0.35 once it exceeds the floor", () => {
    expect(minCueDuration(10)).toBeCloseTo(3.5, 10);
  });
});

describe("countWords", () => {
  it("counts whitespace-delimited words", () => {
    expect(countWords("hello")).toBe(1);
    expect(countWords("  hello   there  ")).toBe(2);
    expect(countWords("")).toBe(0);
  });
});

describe("stabilizeCues", () => {
  it("pads a very short single-word cue to the 1.5s floor", () => {
    const out = stabilizeCues([{ start: 0, end: 0.2, text: "Hello" }]);
    expect(out).toHaveLength(1);
    expect(out[0].end - out[0].start).toBeCloseTo(1.5, 10);
  });

  it("extends a long cue to wordCount * 0.35 seconds", () => {
    const text = "one two three four five six seven eight nine ten"; // 10 words
    const out = stabilizeCues([{ start: 0, end: 1, text }]);
    expect(out).toHaveLength(1);
    expect(out[0].end - out[0].start).toBeCloseTo(10 * 0.35, 10); // 3.5s
  });

  it("never produces overlapping cues", () => {
    const cues: Cue[] = [
      { start: 0, end: 0.3, text: "a" },
      { start: 0.4, end: 0.7, text: "b" },
      { start: 0.8, end: 1.1, text: "c" },
      { start: 5, end: 5.2, text: "d" },
    ];
    const out = stabilizeCues(cues);
    expect(hasNoOverlaps(out)).toBe(true);
    // Every surviving cue meets its own minimum on-screen duration.
    for (const cue of out) {
      expect(cue.end - cue.start).toBeGreaterThanOrEqual(
        minCueDuration(countWords(cue.text)) - EPS
      );
    }
  });

  it("merges adjacent too-short cues when there is no room to extend", () => {
    const out = stabilizeCues([
      { start: 0, end: 0.3, text: "a" },
      { start: 0.4, end: 0.7, text: "b" },
      { start: 0.8, end: 1.1, text: "c" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("a b c");
    expect(out[0].end - out[0].start).toBeGreaterThanOrEqual(1.5 - EPS);
  });

  it("extends into the gap without touching the next cue", () => {
    const out = stabilizeCues([
      { start: 0, end: 0.3, text: "hi" },
      { start: 5, end: 6, text: "still here" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].end).toBeCloseTo(1.5, 10);
    expect(out[0].end).toBeLessThanOrEqual(out[1].start + EPS);
  });

  it("is pure and deterministic — same output, input untouched", () => {
    const input: Cue[] = [
      { start: 0, end: 0.3, text: "a" },
      { start: 0.4, end: 0.7, text: "b" },
    ];
    const snapshot = JSON.stringify(input);
    const first = stabilizeCues(input);
    const second = stabilizeCues(input);
    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(snapshot); // input not mutated
  });

  it("normalizes unsorted, empty, and invalid cues", () => {
    const out = stabilizeCues([
      { start: 5, end: 5.2, text: "second" },
      { start: 0, end: 0.2, text: "first" },
      { start: 1, end: 1.1, text: "   " }, // empty after trim → dropped
      { start: NaN, end: 2, text: "bad" }, // non-finite → dropped
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("first");
    expect(out[1].text).toBe("second");
    expect(hasNoOverlaps(out)).toBe(true);
  });
});

describe("cuesToWords", () => {
  it("distributes a cue's span evenly across its words", () => {
    const words = cuesToWords([{ start: 0, end: 2, text: "a b" }]);
    expect(words).toEqual([
      { word: "a", start: 0, end: 1 },
      { word: "b", start: 1, end: 2 },
    ]);
  });
});

describe("formatVttTimestamp", () => {
  it("formats seconds as HH:MM:SS.mmm", () => {
    expect(formatVttTimestamp(0)).toBe("00:00:00.000");
    expect(formatVttTimestamp(1.5)).toBe("00:00:01.500");
    expect(formatVttTimestamp(3661.5)).toBe("01:01:01.500");
  });
});

describe("cuesToVtt", () => {
  it("produces a valid WebVTT document", () => {
    const vtt = cuesToVtt([
      { start: 0, end: 1.5, text: "Hello" },
      { start: 1.5, end: 3, text: "there" },
    ]);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500\nHello");
    expect(vtt).toContain("00:00:01.500 --> 00:00:03.000\nthere");
  });
});
