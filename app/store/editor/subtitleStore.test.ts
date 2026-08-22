import { beforeEach, describe, expect, it } from "vitest";

import { SUBTITLE_UNDO_LIMIT, useSubtitleStore } from "./subtitleStore";
import {
  applyDemoEditing,
  buildEditingPayload,
  type DemoEditing,
} from "@/app/(signed)/editor/utils/editingDraft";
import type { SubtitleCue } from "@/app/(signed)/editor/types";

/**
 * The subtitle store's editing actions. The cue arithmetic itself is covered by
 * app/lib/subtitles/cues.test.ts; what matters here is that the store composes
 * it correctly — every mutation normalizes, every mutation is undoable, and no
 * mutation can leave the list overlapping.
 */

const store = () => useSubtitleStore.getState();

/** The invariant the render worker depends on: sorted and non-overlapping. */
function isSortedAndNonOverlapping(cues: readonly SubtitleCue[]): boolean {
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].start > cues[i + 1].start || cues[i].end > cues[i + 1].start + 1e-6) {
      return false;
    }
  }
  return cues.every((c) => c.end > c.start && c.text.trim().length > 0);
}

const CUES: SubtitleCue[] = [
  { start: 0, end: 2, text: "hello there" },
  { start: 2, end: 5, text: "this is a long cue to split" },
  { start: 6, end: 7, text: "last" },
];

beforeEach(() => {
  store().reset();
  store().setSubtitleCues(CUES.map((c) => ({ ...c })));
});

describe("text editing", () => {
  it("replaces one cue's text", () => {
    store().setCueText(0, "hello world");
    expect(store().subtitleCues[0].text).toBe("hello world");
    expect(store().subtitleCues).toHaveLength(3);
  });

  it("ignores a blank edit rather than dropping the cue", () => {
    store().setCueText(0, "   ");
    expect(store().subtitleCues).toHaveLength(3);
    expect(store().subtitleCues[0].text).toBe("hello there");
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("ignores an out-of-range index", () => {
    store().setCueText(9, "nope");
    expect(store().subtitleCues).toEqual(CUES);
  });
});

describe("timing editing", () => {
  it("re-times a cue and keeps the list sorted", () => {
    store().setCueTiming(0, { start: 5.5, end: 5.9 });
    expect(isSortedAndNonOverlapping(store().subtitleCues)).toBe(true);
    expect(store().subtitleCues.map((c) => c.text)).toEqual([
      "this is a long cue to split",
      "hello there",
      "last",
    ]);
  });

  it("resolves an overlap it creates instead of storing one", () => {
    // Drag cue 0's end deep into cue 1.
    store().setCueTiming(0, { end: 4 });
    expect(isSortedAndNonOverlapping(store().subtitleCues)).toBe(true);
    // The later cue's start wins; the earlier one is truncated at it.
    expect(store().subtitleCues[0].end).toBe(2);
    // Truncated straight back to where it began: nothing changed, so it must
    // not leave an undo step that appears to do nothing when spent.
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("clamps to the video duration", () => {
    store().setCueTiming(2, { end: 99 }, { durationSeconds: 10 });
    expect(store().subtitleCues[2].end).toBe(10);
  });
});

describe("split / merge / delete / add", () => {
  it("splits at a time inside the cue", () => {
    store().splitCue(1, 3.5);
    expect(store().subtitleCues).toHaveLength(4);
    expect(store().subtitleCues[1].end).toBe(3.5);
    expect(store().subtitleCues[2].start).toBe(3.5);
    expect(isSortedAndNonOverlapping(store().subtitleCues)).toBe(true);
  });

  it("does not split outside the cue", () => {
    store().splitCue(1, 9);
    expect(store().subtitleCues).toHaveLength(3);
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("merges a cue with the next one", () => {
    store().mergeCueWithNext(0);
    expect(store().subtitleCues).toHaveLength(2);
    expect(store().subtitleCues[0]).toMatchObject({
      start: 0,
      end: 5,
      text: "hello there this is a long cue to split",
    });
  });

  it("does not merge past the end of the list", () => {
    store().mergeCueWithNext(2);
    expect(store().subtitleCues).toHaveLength(3);
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("deletes a cue", () => {
    store().removeCue(1);
    expect(store().subtitleCues.map((c) => c.text)).toEqual(["hello there", "last"]);
  });

  it("adds a cue in a gap", () => {
    store().addCue(5.2);
    expect(store().subtitleCues).toHaveLength(4);
    expect(store().subtitleCues[2]).toMatchObject({ start: 5.2, end: 6 });
    expect(isSortedAndNonOverlapping(store().subtitleCues)).toBe(true);
  });

  it("refuses to add under an existing cue", () => {
    store().addCue(3);
    expect(store().subtitleCues).toHaveLength(3);
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("refuses to add where there is no room", () => {
    store().addCue(5.95);
    expect(store().subtitleCues).toHaveLength(3);
  });
});

describe("undo", () => {
  it("restores the list from before the last mutation", () => {
    store().removeCue(1);
    expect(store().subtitleCues).toHaveLength(2);
    store().undoCueEdit();
    expect(store().subtitleCues).toEqual(CUES);
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("is a no-op with nothing to undo", () => {
    store().undoCueEdit();
    expect(store().subtitleCues).toEqual(CUES);
  });

  it("stays bounded over a long editing session", () => {
    for (let i = 0; i < SUBTITLE_UNDO_LIMIT + 25; i++) {
      store().setCueText(0, `edit ${i}`);
    }
    expect(store().subtitleUndoStack).toHaveLength(SUBTITLE_UNDO_LIMIT);
  });

  it("is dropped when the whole list is replaced", () => {
    store().removeCue(0);
    expect(store().subtitleUndoStack).toHaveLength(1);
    store().setSubtitleCues([{ start: 0, end: 1, text: "regenerated" }]);
    expect(store().subtitleUndoStack).toHaveLength(0);
  });
});

describe("persistence", () => {
  /**
   * SUB PR 2 deliberately adds no save path: edits are expected to reach
   * `Demo.editing.subtitles` through the autosave that already serializes this
   * store's cues. This walks that round trip — mutate, serialize, JSON, restore
   * — so the claim is checked rather than assumed.
   */
  it("survives the existing editing-draft round trip", () => {
    store().setCueText(0, "hello world");
    store().splitCue(1, 3.5);
    store().removeCue(3);
    const edited = store().subtitleCues;

    const payload = buildEditingPayload({
      segments: [],
      zoomSegments: [],
      selectedBackground: null,
      backgroundType: "",
      subtitleCues: edited,
      textOverlays: [],
      aspectRatio: "native",
      browserFrameMode: "default",
      browserFrameDrawShadow: true,
      browserFrameDrawBorder: false,
      avs: null,
      wtm: null,
    });
    expect(payload.subtitles).toEqual(edited);

    // Through the wire (backend column or localStorage draft) and back.
    const restored = JSON.parse(JSON.stringify(payload)) as DemoEditing;
    store().reset();
    expect(store().subtitleCues).toHaveLength(0);

    const noop = () => {};
    applyDemoEditing(restored, {
      setSegments: noop,
      setCurrentSegments: noop,
      setZoomSegments: noop,
      setSubtitleCues: store().setSubtitleCues,
      setTextOverlays: noop,
      setSelectedBackground: noop,
      setBackgroundType: noop,
      setAspectRatio: noop,
      setBrowserFrameMode: noop,
      setBrowserFrameDrawShadow: noop,
      setBrowserFrameDrawBorder: noop,
      setAvs: noop,
      setWtm: noop,
    });

    expect(store().subtitleCues).toEqual(edited);
  });
});

describe("existing setter contract", () => {
  it("still accepts a functional update", () => {
    store().setSubtitleCues((prev) => prev.slice(0, 1));
    expect(store().subtitleCues).toHaveLength(1);
    store().setSubtitlesLoading((prev) => !prev);
    expect(store().subtitlesLoading).toBe(true);
  });
});
