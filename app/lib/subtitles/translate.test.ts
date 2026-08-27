import { describe, expect, it } from "vitest";

import { isSubtitleTranslateAllowed } from "./access";
import {
  TRANSLATION_BATCH_SIZE,
  TranslationAlignmentError,
  applyTranslations,
  buildTranslationBatches,
  buildTranslationPrompt,
  parseTranslationBatch,
  toTranslationSegments,
} from "./translate";
import type { SubtitleCue } from "./types";

const CUES: SubtitleCue[] = [
  { start: 0, end: 1.5, text: "Hello" },
  { start: 1.5, end: 3, text: "there" },
  { start: 3, end: 4.25, text: "friend" },
];

const json = (segments: unknown) => JSON.stringify({ segments });

describe("batching", () => {
  it("splits cues into ordered batches", () => {
    const cues = Array.from({ length: 95 }, (_, i) => ({ start: i, end: i + 1, text: `c${i}` }));
    const batches = buildTranslationBatches(cues, 40);
    expect(batches.map((b) => b.length)).toEqual([40, 40, 15]);
    expect(batches[0][0].text).toBe("c0");
    expect(batches[2][14].text).toBe("c94");
    expect(batches.flat()).toEqual(cues);
  });

  it("batches a 10-minute demo into a handful of requests", () => {
    // ~150 cues is the plan's stated figure for a 10-minute video.
    const cues = Array.from({ length: 150 }, (_, i) => ({ start: i, end: i + 1, text: `c${i}` }));
    expect(buildTranslationBatches(cues).length).toBe(Math.ceil(150 / TRANSLATION_BATCH_SIZE));
  });

  it("handles an empty list and a degenerate batch size", () => {
    expect(buildTranslationBatches([], 40)).toEqual([]);
    expect(buildTranslationBatches(CUES, 0).length).toBe(3);
  });

  it("sends indices and text but never timings", () => {
    const segments = toTranslationSegments(CUES);
    expect(segments).toEqual([
      { i: 0, text: "Hello" },
      { i: 1, text: "there" },
      { i: 2, text: "friend" },
    ]);
    // Assert on the KEYS, not on a substring of the payload — cue text like
    // "friend" contains "end" and would make a substring check lie.
    for (const segment of segments) {
      expect(Object.keys(segment).sort()).toEqual(["i", "text"]);
    }
  });

  it("asks for one entry per index in the prompt", () => {
    const prompt = buildTranslationPrompt(toTranslationSegments(CUES), "English", "Spanish");
    expect(prompt).toContain("English");
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("exactly one entry for each of the 3 input indices");
    expect(prompt).not.toContain("start");
  });
});

describe("parseTranslationBatch — alignment is verified, not assumed", () => {
  it("accepts a well-formed response and returns it in index order", () => {
    const content = json([
      { i: 2, text: "amigo" },
      { i: 0, text: "Hola" },
      { i: 1, text: "ahí" },
    ]);
    expect(parseTranslationBatch(content, 3)).toEqual(["Hola", "ahí", "amigo"]);
  });

  it("THROWS when a segment is missing rather than shifting everything after it", () => {
    const content = json([
      { i: 0, text: "Hola" },
      { i: 2, text: "amigo" },
    ]);
    expect(() => parseTranslationBatch(content, 3)).toThrow(TranslationAlignmentError);
    expect(() => parseTranslationBatch(content, 3)).toThrow(/2 of 3 subtitles/);
    expect(() => parseTranslationBatch(content, 3)).toThrow(/missing 1/);
  });

  it("THROWS on a duplicated index even though the count would look right", () => {
    // Right length, wrong content — a count check alone would let this through.
    const content = json([
      { i: 0, text: "Hola" },
      { i: 1, text: "ahí" },
      { i: 1, text: "otra vez" },
    ]);
    expect(() => parseTranslationBatch(content, 3)).toThrow(/more than once/);
  });

  it("THROWS on an out-of-range index", () => {
    const content = json([
      { i: 0, text: "Hola" },
      { i: 1, text: "ahí" },
      { i: 9, text: "fuera" },
    ]);
    expect(() => parseTranslationBatch(content, 3)).toThrow(TranslationAlignmentError);
  });

  it("THROWS on a blank translation rather than saving an empty subtitle", () => {
    const content = json([
      { i: 0, text: "Hola" },
      { i: 1, text: "   " },
      { i: 2, text: "amigo" },
    ]);
    expect(() => parseTranslationBatch(content, 3)).toThrow(TranslationAlignmentError);
  });

  it("THROWS on malformed JSON and on a missing segments array", () => {
    expect(() => parseTranslationBatch("not json", 3)).toThrow(/not valid JSON/);
    expect(() => parseTranslationBatch("{}", 3)).toThrow(/no segments/);
    expect(() => parseTranslationBatch(json("nope"), 3)).toThrow(/no segments/);
  });

  it("THROWS on extra segments beyond the batch", () => {
    const content = json([
      { i: 0, text: "Hola" },
      { i: 1, text: "ahí" },
      { i: 2, text: "amigo" },
      { i: 3, text: "extra" },
    ]);
    expect(() => parseTranslationBatch(content, 3)).toThrow(TranslationAlignmentError);
  });

  it("THROWS on a malformed entry instead of skipping it", () => {
    expect(() => parseTranslationBatch(json([{ i: 0, text: "Hola" }, null]), 1)).toThrow(
      /malformed/
    );
  });

  it("trims whitespace the model adds", () => {
    expect(parseTranslationBatch(json([{ i: 0, text: "  Hola  " }]), 1)).toEqual(["Hola"]);
  });
});

describe("applyTranslations — timings survive verbatim", () => {
  it("replaces text and copies start/end exactly", () => {
    const out = applyTranslations(CUES, ["Hola", "ahí", "amigo"]);
    expect(out).toEqual([
      { start: 0, end: 1.5, text: "Hola" },
      { start: 1.5, end: 3, text: "ahí" },
      { start: 3, end: 4.25, text: "amigo" },
    ]);
    // Same count, same order, same instants — only the words moved.
    expect(out.map((c) => [c.start, c.end])).toEqual(CUES.map((c) => [c.start, c.end]));
  });

  it("throws rather than truncating when the lengths disagree", () => {
    expect(() => applyTranslations(CUES, ["Hola"])).toThrow(TranslationAlignmentError);
    expect(() => applyTranslations(CUES, ["a", "b", "c", "d"])).toThrow(/Refusing/);
  });

  it("does not mutate the source cues", () => {
    const source = CUES.map((c) => ({ ...c }));
    applyTranslations(source, ["Hola", "ahí", "amigo"]);
    expect(source).toEqual(CUES);
  });
});

describe("plan gate", () => {
  it("allows only PRO and ENTERPRISE", () => {
    expect(isSubtitleTranslateAllowed("PRO")).toBe(true);
    expect(isSubtitleTranslateAllowed("ENTERPRISE")).toBe(true);
    expect(isSubtitleTranslateAllowed("FREE")).toBe(false);
    expect(isSubtitleTranslateAllowed(null)).toBe(false);
    expect(isSubtitleTranslateAllowed(undefined)).toBe(false);
    expect(isSubtitleTranslateAllowed("")).toBe(false);
    expect(isSubtitleTranslateAllowed("pro")).toBe(false);
  });
});
