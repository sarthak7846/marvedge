import { describe, expect, it } from "vitest";

import { MIN_CUE_SECONDS, normalizeCues } from "@/app/lib/subtitles";
import type { SubtitleCue } from "@/app/(signed)/editor/types";
import {
  SUBTITLE_CLUSTER_MAX_PX,
  SUBTITLE_MIN_BLOCK_PX,
  cullSubtitleTrackItems,
  layoutSubtitleTrack,
  resolveCueDrag,
  scrollLeftForTime,
  snapSecondsForZoom,
  snapTime,
  zoomLevelForCluster,
} from "./subtitleTrackLayout";

/** The width `useTimelineRuler` falls back to before the container is measured. */
const BASE_WIDTH = 956;

/** `n` back-to-back cues of `duration` seconds each, starting at 0. */
function denseCues(n: number, duration: number): SubtitleCue[] {
  return Array.from({ length: n }, (_, i) => ({
    start: i * duration,
    end: (i + 1) * duration,
    text: `cue ${i + 1}`,
  }));
}

function layoutAt(cues: SubtitleCue[], maxValue: number, zoomLevel: number) {
  return layoutSubtitleTrack(cues, {
    minValue: 0,
    maxValue,
    zoomedTimelineWidth: BASE_WIDTH * zoomLevel,
  });
}

describe("layoutSubtitleTrack", () => {
  it("renders every cue as its own block when there is room", () => {
    // 8 cues over 60s at 1x: ~120px each, comfortably draggable.
    const cues = denseCues(8, 7.5);
    const items = layoutAt(cues, 60, 1);

    expect(items).toHaveLength(8);
    expect(items.every((i) => i.kind === "cue")).toBe(true);
  });

  it("collapses a 10-minute transcript into a handful of clusters at default zoom", () => {
    // The density case from the PRD: ~150 cues over 10 minutes is ~6px a cue.
    const cues = denseCues(150, 4);
    const items = layoutAt(cues, 600, 1);

    expect(items.every((i) => i.kind === "cluster")).toBe(true);
    // Few enough to be legible, more than one so the track still shows WHERE
    // the subtitles are.
    expect(items.length).toBeGreaterThan(4);
    expect(items.length).toBeLessThan(30);
  });

  it("accounts for every cue exactly once, in order", () => {
    const cues = denseCues(150, 4);
    const items = layoutAt(cues, 600, 1);

    let expected = 0;
    for (const item of items) {
      if (item.kind === "cue") {
        expect(item.index).toBe(expected);
        expected += 1;
      } else {
        expect(item.fromIndex).toBe(expected);
        expect(item.toIndex).toBe(item.fromIndex + item.count - 1);
        expected += item.count;
      }
    }
    expect(expected).toBe(150);
  });

  it("never draws two items on top of each other", () => {
    // Mixed densities: long cues, a dense burst, a lone sliver with air after it.
    const cues: SubtitleCue[] = [
      { start: 0, end: 20, text: "long" },
      ...Array.from({ length: 40 }, (_, i) => ({
        start: 20 + i * 0.5,
        end: 20.5 + i * 0.5,
        text: `burst ${i}`,
      })),
      { start: 120, end: 120.3, text: "sliver" },
      { start: 200, end: 240, text: "tail" },
    ];
    const items = layoutAt(cues, 600, 1);

    for (let i = 1; i < items.length; i += 1) {
      expect(items[i].leftPx).toBeGreaterThanOrEqual(
        items[i - 1].leftPx + items[i - 1].widthPx - 1e-6
      );
    }
  });

  it("gives every item at least a minimum hit target", () => {
    const cues = denseCues(150, 4);
    for (const zoom of [1, 4, 20]) {
      for (const item of layoutAt(cues, 600, zoom)) {
        expect(item.widthPx).toBeGreaterThanOrEqual(SUBTITLE_MIN_BLOCK_PX - 1e-6);
      }
    }
  });

  it("caps how wide a cluster grows, so dense regions stay locatable", () => {
    const cues = denseCues(150, 4);
    for (const item of layoutAt(cues, 600, 1)) {
      // The cap is a stopping condition, not a hard ceiling: the run in flight
      // is finished before a new one starts. One cue's worth of overshoot.
      expect(item.widthPx).toBeLessThan(SUBTITLE_CLUSTER_MAX_PX * 2);
    }
  });

  it("resolves the same 150 cues into individual blocks once zoomed in", () => {
    const cues = denseCues(150, 4);
    const items = layoutAt(cues, 600, 20);

    expect(items).toHaveLength(150);
    expect(items.every((i) => i.kind === "cue")).toBe(true);
  });

  it("returns nothing for an empty list or a degenerate timeline", () => {
    expect(layoutAt([], 600, 1)).toEqual([]);
    expect(layoutAt(denseCues(4, 1), 0, 1)).toEqual([]);
  });
});

describe("cullSubtitleTrackItems", () => {
  it("keeps only what is near the viewport", () => {
    const cues = denseCues(150, 4);
    const items = layoutAt(cues, 600, 20);
    const visible = cullSubtitleTrackItems(items, 0, BASE_WIDTH);

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(items.length);
    expect(visible[0]).toBe(items[0]);
  });

  it("keeps everything when the viewport width is unknown", () => {
    const items = layoutAt(denseCues(10, 4), 600, 1);
    expect(cullSubtitleTrackItems(items, 0, 0)).toHaveLength(items.length);
  });
});

describe("zoomLevelForCluster", () => {
  it("zooms far enough that the cluster's cues become draggable", () => {
    const cues = denseCues(150, 4);
    const [cluster] = layoutAt(cues, 600, 1);
    if (cluster.kind !== "cluster") {
      throw new Error("expected a cluster at default zoom");
    }

    const zoom = zoomLevelForCluster(cues, cluster, {
      minValue: 0,
      maxValue: 600,
      baseTimelineWidth: BASE_WIDTH,
    });

    const after = layoutAt(cues, 600, zoom).filter(
      (i) => i.kind === "cue" && i.index >= cluster.fromIndex && i.index <= cluster.toIndex
    );
    expect(after.length).toBe(cluster.count);
  });

  it("clamps into the zoom range the timeline actually supports", () => {
    const cues = [
      { start: 0, end: 0.2, text: "a" },
      { start: 0.2, end: 0.4, text: "b" },
    ];
    const [cluster] = layoutAt(cues, 3600, 1);
    if (cluster.kind !== "cluster") {
      throw new Error("expected a cluster");
    }

    const zoom = zoomLevelForCluster(cues, cluster, {
      minValue: 0,
      maxValue: 3600,
      baseTimelineWidth: BASE_WIDTH,
    });
    expect(zoom).toBeLessThanOrEqual(20);
    expect(zoom).toBeGreaterThanOrEqual(1);
  });
});

describe("scrollLeftForTime", () => {
  const options = { minValue: 0, maxValue: 600, zoomedTimelineWidth: 9560, viewportWidthPx: 956 };

  it("centres the requested moment", () => {
    expect(scrollLeftForTime(300, options)).toBeCloseTo(9560 / 2 - 478, 6);
  });

  it("clamps to the ends of the track", () => {
    expect(scrollLeftForTime(0, options)).toBe(0);
    expect(scrollLeftForTime(600, options)).toBe(9560 - 956);
  });
});

describe("snapTime", () => {
  it("takes the nearest target inside the tolerance", () => {
    expect(snapTime(5.05, [4, 5, 6], 0.1)).toBe(5);
  });

  it("leaves a value alone when nothing is close enough", () => {
    expect(snapTime(5.5, [4, 5, 6], 0.1)).toBe(5.5);
  });

  it("ignores a zero tolerance and non-finite targets", () => {
    expect(snapTime(5.05, [5], 0)).toBe(5.05);
    expect(snapTime(5.05, [Number.NaN, Number.POSITIVE_INFINITY], 0.1)).toBe(5.05);
  });
});

describe("snapSecondsForZoom", () => {
  it("keeps the snap radius constant on screen while zoomed in", () => {
    // 8px at 32 px/s is a quarter second, capped to the shortest legal cue.
    expect(snapSecondsForZoom(32)).toBeCloseTo(0.25 > MIN_CUE_SECONDS ? MIN_CUE_SECONDS : 0.25, 6);
    expect(snapSecondsForZoom(160)).toBeCloseTo(0.05, 6);
  });

  it("caps the radius so a zoomed-out track cannot fling a cue", () => {
    // 956px for a 10-minute demo is 1.6 px/s: 8px would be five seconds.
    expect(snapSecondsForZoom(956 / 600)).toBe(MIN_CUE_SECONDS);
  });

  it("is zero for a degenerate scale", () => {
    expect(snapSecondsForZoom(0)).toBe(0);
    expect(snapSecondsForZoom(Number.NaN)).toBe(0);
  });
});

describe("resolveCueDrag", () => {
  const bounds = { minValue: 0, maxValue: 60, snapSeconds: 0 };

  /** Three cues with a 1s gap between each, so there is room to move. */
  const origin: SubtitleCue[] = [
    { start: 0, end: 4, text: "one" },
    { start: 5, end: 9, text: "two" },
    { start: 10, end: 14, text: "three" },
  ];

  it("moves a block by the dragged distance", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds: 0.5 },
      bounds
    );
    expect(next?.[1]).toEqual({ start: 5.5, end: 9.5, text: "two" });
    // Neighbours untouched: the move stayed inside the gap.
    expect(next?.[0]).toEqual(origin[0]);
    expect(next?.[2]).toEqual(origin[2]);
  });

  it("makes the neighbour yield when the block is dragged into it", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds: 2 },
      bounds
    );
    expect(next?.[1]).toEqual({ start: 7, end: 11, text: "two" });
    // The cue being dragged wins; the one it moved into is truncated.
    expect(next?.[2]).toEqual({ start: 11, end: 14, text: "three" });
  });

  it("clamps rather than consuming a neighbour entirely", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds: 100 },
      bounds
    );
    // "three" keeps its structural minimum and the drag stops there.
    expect(next?.[1].end).toBeCloseTo(14 - MIN_CUE_SECONDS, 6);
    expect(next?.[2].start).toBeCloseTo(14 - MIN_CUE_SECONDS, 6);
    expect(next?.[2].end).toBe(14);
  });

  it("keeps cue order stable however far the drag goes", () => {
    for (const deltaSeconds of [-100, -3, 0, 3, 100]) {
      const next = resolveCueDrag(
        origin,
        { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds },
        bounds
      );
      expect(next).not.toBeNull();
      const starts = (next as SubtitleCue[]).map((c) => c.start);
      expect([...starts].sort((a, b) => a - b)).toEqual(starts);
      expect((next as SubtitleCue[])[1].text).toBe("two");
    }
  });

  it("restores a yielded neighbour when the drag is taken back", () => {
    // Every frame is resolved against the ORIGIN, so reversing the gesture is
    // lossless — this is what lets a whole drag be one undo step.
    resolveCueDrag(
      origin,
      { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds: 3 },
      bounds
    );
    const back = resolveCueDrag(
      origin,
      { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds: 0 },
      bounds
    );
    expect(back).toEqual(origin);
  });

  it("resizes from the left edge without moving the right one", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "edge", side: "left", startValue: 5, deltaSeconds: -0.5 },
      bounds
    );
    expect(next?.[1]).toEqual({ start: 4.5, end: 9, text: "two" });
  });

  it("resizes from the right edge without moving the left one", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "edge", side: "right", startValue: 9, deltaSeconds: 0.5 },
      bounds
    );
    expect(next?.[1]).toEqual({ start: 5, end: 9.5, text: "two" });
  });

  it("enforces the minimum cue duration on a resize", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "edge", side: "left", startValue: 5, deltaSeconds: 100 },
      bounds
    );
    expect(next?.[1].start).toBeCloseTo(9 - MIN_CUE_SECONDS, 6);
    expect(next?.[1].end).toBe(9);
  });

  it("snaps to a neighbouring cue boundary", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "edge", side: "left", startValue: 5, deltaSeconds: -0.94 },
      { ...bounds, snapSeconds: 0.1 }
    );
    expect(next?.[1].start).toBe(4); // "one" ends at 4.
  });

  it("snaps to the playhead", () => {
    const next = resolveCueDrag(
      origin,
      { index: 1, mode: "segment", startValue: 5, endValue: 9, deltaSeconds: 0.47 },
      { ...bounds, snapSeconds: 0.1, playheadSeconds: 5.5 }
    );
    expect(next?.[1]).toEqual({ start: 5.5, end: 9.5, text: "two" });
  });

  it("holds a block inside the timeline", () => {
    const next = resolveCueDrag(
      origin,
      { index: 0, mode: "segment", startValue: 0, endValue: 4, deltaSeconds: -10 },
      bounds
    );
    expect(next?.[0]).toEqual({ start: 0, end: 4, text: "one" });
  });

  it("returns null for an index that addresses no cue", () => {
    expect(
      resolveCueDrag(origin, { index: 9, mode: "segment", startValue: 0, deltaSeconds: 1 }, bounds)
    ).toBeNull();
  });

  it("never produces an overlap, at any drag distance, on a dense list", () => {
    // The acceptance criterion: 150 back-to-back cues, dragged every which way.
    const dense = denseCues(150, 4);
    for (const index of [0, 1, 74, 148, 149]) {
      for (const deltaSeconds of [-50, -4.1, -0.05, 0.05, 4.1, 50]) {
        for (const gesture of [
          { mode: "segment" as const, startValue: dense[index].start, endValue: dense[index].end },
          { mode: "edge" as const, side: "left" as const, startValue: dense[index].start },
          { mode: "edge" as const, side: "right" as const, startValue: dense[index].end },
        ]) {
          const next = resolveCueDrag(
            dense,
            { index, ...gesture, deltaSeconds },
            { minValue: 0, maxValue: 600, snapSeconds: 0.05, playheadSeconds: 300 }
          );
          expect(next).not.toBeNull();
          const cues = next as SubtitleCue[];
          for (let i = 1; i < cues.length; i += 1) {
            expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end - 1e-9);
            expect(cues[i].end).toBeGreaterThan(cues[i].start);
          }
          // And normalizing — which the store runs on every frame — changes
          // nothing, because the drag never breaks the invariant in the first
          // place.
          expect(normalizeCues(cues, { durationSeconds: 600 })).toHaveLength(cues.length);
        }
      }
    }
  });
});
