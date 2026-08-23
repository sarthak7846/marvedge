import { beforeEach, describe, expect, it } from "vitest";

import { SUBTITLE_UNDO_LIMIT, useSubtitleStore } from "./subtitleStore";
import { SUBTITLE_FONT_PCT_MAX } from "@/app/lib/subtitles";
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
      subtitleStyle: store().subtitleStyle,
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
      setSubtitleStyle: store().setSubtitleStyle,
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

  /**
   * SUB PR 4 persists the style the same way, through `editing.subtitleStyle`.
   * The important half is the NEGATIVE case: a demo that was never styled must
   * round-trip back to `null`, not to the defaults, because "no style config" is
   * exactly what makes its export byte-identical to master.
   */
  it("round-trips a subtitle style, and keeps an unstyled demo unstyled", () => {
    const unstyled = buildEditingPayload({
      segments: [],
      zoomSegments: [],
      selectedBackground: null,
      backgroundType: "",
      subtitleCues: [],
      subtitleStyle: null,
      textOverlays: [],
      aspectRatio: "native",
      browserFrameMode: "default",
      browserFrameDrawShadow: true,
      browserFrameDrawBorder: false,
      avs: null,
      wtm: null,
    });
    expect(unstyled.subtitleStyle).toBeNull();

    const noop = () => {};
    const setters = {
      setSegments: noop,
      setCurrentSegments: noop,
      setZoomSegments: noop,
      setSubtitleCues: store().setSubtitleCues,
      setSubtitleStyle: store().setSubtitleStyle,
      setTextOverlays: noop,
      setSelectedBackground: noop,
      setBackgroundType: noop,
      setAspectRatio: noop,
      setBrowserFrameMode: noop,
      setBrowserFrameDrawShadow: noop,
      setBrowserFrameDrawBorder: noop,
      setAvs: noop,
      setWtm: noop,
    };

    store().reset();
    applyDemoEditing(JSON.parse(JSON.stringify(unstyled)) as DemoEditing, setters);
    expect(store().subtitleStyle).toBeNull();

    store().setSubtitleStyle({ alignment: "top", color: "#8A76FC" });
    const styled = store().subtitleStyle;
    expect(styled).toMatchObject({ alignment: "top", color: "#8A76FC" });

    const payload = buildEditingPayload({
      segments: [],
      zoomSegments: [],
      selectedBackground: null,
      backgroundType: "",
      subtitleCues: [],
      subtitleStyle: styled,
      textOverlays: [],
      aspectRatio: "native",
      browserFrameMode: "default",
      browserFrameDrawShadow: true,
      browserFrameDrawBorder: false,
      avs: null,
      wtm: null,
    });

    store().reset();
    expect(store().subtitleStyle).toBeNull();
    applyDemoEditing(JSON.parse(JSON.stringify(payload)) as DemoEditing, setters);
    expect(store().subtitleStyle).toEqual(styled);
  });

  it("sanitizes a style on the way into the store", () => {
    store().reset();
    store().setSubtitleStyle({ alignment: "sideways" as never, fontSizePct: 999 });
    expect(store().subtitleStyle?.alignment).toBe("bottom");
    expect(store().subtitleStyle?.fontSizePct).toBe(SUBTITLE_FONT_PCT_MAX);
    store().setSubtitleStyle(null);
    expect(store().subtitleStyle).toBeNull();
  });
});

describe("selection", () => {
  it("selects a cue and bumps the focus nonce", () => {
    const before = store().cueFocusNonce;
    store().selectCue(1);
    expect(store().selectedCueIndex).toBe(1);
    expect(store().cueFocusNonce).toBe(before + 1);
  });

  it("bumps the nonce again when the same cue is re-selected", () => {
    // The sidebar list scrolls the selected row into view off the nonce, so
    // clicking the same timeline block twice has to be observable.
    store().selectCue(1);
    const nonce = store().cueFocusNonce;
    store().selectCue(1);
    expect(store().cueFocusNonce).toBe(nonce + 1);
  });

  it("treats an out-of-range index as no selection", () => {
    store().selectCue(9);
    expect(store().selectedCueIndex).toBeNull();
  });

  it("does nothing when clearing an already-empty selection", () => {
    const nonce = store().cueFocusNonce;
    store().selectCue(null);
    expect(store().cueFocusNonce).toBe(nonce);
  });

  it("drops a selection a delete has left pointing past the end", () => {
    store().selectCue(2);
    store().removeCue(2);
    expect(store().selectedCueIndex).toBeNull();
  });

  it("drops the selection when the whole list is replaced", () => {
    store().selectCue(1);
    store().setSubtitleCues([{ start: 0, end: 1, text: "different demo" }]);
    expect(store().selectedCueIndex).toBeNull();
  });
});

describe("timeline drag", () => {
  /** Re-time cue 1 as a whole-list candidate, the way resolveCueDrag does. */
  const moved = (start: number, end: number): SubtitleCue[] => {
    const next = store().subtitleCues.map((c) => ({ ...c }));
    next[1] = { ...next[1], start, end };
    return next;
  };

  it("ignores a move with no gesture open", () => {
    store().dragCues(moved(2.5, 5.5));
    expect(store().subtitleCues).toEqual(CUES);
  });

  it("applies frames while a gesture is open", () => {
    store().beginCueDrag();
    store().dragCues(moved(2.5, 5.5));
    expect(store().subtitleCues[1]).toEqual({ start: 2.5, end: 5.5, text: CUES[1].text });
  });

  it("spends exactly one undo step on a whole drag, however many frames", () => {
    store().beginCueDrag();
    for (let i = 1; i <= 40; i++) {
      store().dragCues(moved(2 + i * 0.01, 5 + i * 0.01));
    }
    expect(store().subtitleUndoStack).toHaveLength(0); // Nothing banked mid-drag.
    store().endCueDrag();

    expect(store().subtitleUndoStack).toHaveLength(1);
    store().undoCueEdit();
    expect(store().subtitleCues).toEqual(CUES);
  });

  it("spends no undo step when the drag ends where it started", () => {
    store().beginCueDrag();
    store().dragCues(moved(2.5, 5.5));
    store().dragCues(moved(2, 5));
    store().endCueDrag();
    expect(store().subtitleUndoStack).toHaveLength(0);
  });

  it("keeps the original snapshot if the gesture is re-opened mid-drag", () => {
    // A zoom change under a live drag re-subscribes the listener; re-snapshotting
    // there would make dragging back restore the half-dragged list.
    store().beginCueDrag();
    store().dragCues(moved(2.5, 5.5));
    store().beginCueDrag();
    expect(store().subtitleDragOrigin).toEqual(CUES);
  });

  it("normalizes every frame, so a drag can never leave an overlap", () => {
    store().beginCueDrag();
    const next = store().subtitleCues.map((c) => ({ ...c }));
    next[1] = { ...next[1], start: 1, end: 6.5 }; // Straddles both neighbours.
    store().dragCues(next, { durationSeconds: 10 });
    expect(isSortedAndNonOverlapping(store().subtitleCues)).toBe(true);
    store().endCueDrag();
  });

  it("clears an in-flight gesture when the whole list is replaced", () => {
    store().beginCueDrag();
    store().setSubtitleCues([{ start: 0, end: 1, text: "different demo" }]);
    expect(store().subtitleDragOrigin).toBeNull();
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
