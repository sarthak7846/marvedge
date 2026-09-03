import { describe, expect, it } from "vitest";

import {
  COMPLETION_RATIO,
  bufferedEndAt,
  clampSeek,
  completionThresholdSec,
  crossedThreshold,
  formatClock,
  isCompleted,
  progressFraction,
  trackFraction,
} from "./playback";

describe("formatClock", () => {
  it("renders m:ss under an hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(599)).toBe("9:59");
    expect(formatClock(3599)).toBe("59:59");
  });

  it("grows an hours field once past an hour", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3661)).toBe("1:01:01");
    expect(formatClock(36000)).toBe("10:00:00");
  });

  it("floors rather than rounds, so the clock never shows a time not yet reached", () => {
    expect(formatClock(59.9)).toBe("0:59");
    expect(formatClock(3599.999)).toBe("59:59");
  });

  it("renders 0:00 for the values a media element actually produces before metadata", () => {
    // duration is NaN until loadedmetadata. This is the first-paint case, not an
    // error path, and "NaN:aN" would ship to production every single time.
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatClock(-1)).toBe("0:00");
  });
});

describe("crossedThreshold", () => {
  it("is true only for the tick that passes the threshold", () => {
    expect(crossedThreshold(9, 11, 10)).toBe(true);
    expect(crossedThreshold(11, 13, 10)).toBe(false);
    expect(crossedThreshold(1, 2, 10)).toBe(false);
  });

  it("counts landing exactly on the threshold", () => {
    expect(crossedThreshold(9, 10, 10)).toBe(true);
  });

  it("catches a scrub that jumps clean over the threshold", () => {
    // The reason this is a crossing test and not a setTimeout: no tick lands
    // near 55, but the viewer is now past it and PR 5 owes them the cards.
    expect(crossedThreshold(10, 59, 55)).toBe(true);
  });

  it("does not re-fire when the viewer seeks backwards over it", () => {
    expect(crossedThreshold(59, 10, 55)).toBe(false);
  });

  it("does not fire on a still playhead", () => {
    expect(crossedThreshold(10, 10, 10)).toBe(false);
  });

  it("never crosses a threshold at or below zero", () => {
    // There is no position before 0 to arrive from. "At the very start" is the
    // lead gate's own case and it must not be smuggled in as a crossing.
    expect(crossedThreshold(0, 1, 0)).toBe(false);
    expect(crossedThreshold(0, 1, -5)).toBe(false);
  });

  it("is false rather than throwing on the non-finite values a video reports", () => {
    expect(crossedThreshold(Number.NaN, 10, 5)).toBe(false);
    expect(crossedThreshold(0, Number.NaN, 5)).toBe(false);
    expect(crossedThreshold(0, 10, Number.NaN)).toBe(false);
    expect(crossedThreshold(0, 10, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("completionThresholdSec", () => {
  it("is the configured fraction of the duration", () => {
    expect(completionThresholdSec(100)).toBeCloseTo(95);
    expect(completionThresholdSec(60)).toBeCloseTo(60 * COMPLETION_RATIO);
  });

  it("accepts an explicit ratio", () => {
    expect(completionThresholdSec(100, 0.5)).toBeCloseTo(50);
  });

  it("is undefined for a duration a video cannot complete", () => {
    // Infinity is what a live stream reports; NaN is what every video reports
    // before metadata loads.
    expect(completionThresholdSec(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(completionThresholdSec(Number.NaN)).toBeUndefined();
    expect(completionThresholdSec(0)).toBeUndefined();
    expect(completionThresholdSec(-10)).toBeUndefined();
  });
});

describe("isCompleted", () => {
  it("trusts the ended flag above everything", () => {
    expect(isCompleted(0, Number.NaN, true)).toBe(true);
    expect(isCompleted(1, 1000, true)).toBe(true);
  });

  it("counts a viewer who scrubbed into the last 5%", () => {
    expect(isCompleted(95, 100, false)).toBe(true);
    expect(isCompleted(99.9, 100, false)).toBe(true);
  });

  it("does not count a viewer short of the threshold", () => {
    expect(isCompleted(94.9, 100, false)).toBe(false);
    expect(isCompleted(0, 100, false)).toBe(false);
  });

  it("cannot complete while the duration is unknown", () => {
    expect(isCompleted(500, Number.NaN, false)).toBe(false);
    expect(isCompleted(500, Number.POSITIVE_INFINITY, false)).toBe(false);
  });
});

describe("bufferedEndAt", () => {
  it("returns the end of the range covering the playhead", () => {
    expect(bufferedEndAt([{ start: 0, end: 30 }], 10)).toBe(30);
  });

  it("picks the covering range out of several", () => {
    const ranges = [
      { start: 0, end: 10 },
      { start: 40, end: 90 },
    ];
    expect(bufferedEndAt(ranges, 50)).toBe(90);
    expect(bufferedEndAt(ranges, 5)).toBe(10);
  });

  it("reports nothing buffered ahead when the playhead is in a gap", () => {
    // Returning the earlier range's end would paint the buffered bar BEHIND the
    // playhead after a seek into un-downloaded territory.
    const ranges = [
      { start: 0, end: 10 },
      { start: 40, end: 90 },
    ];
    expect(bufferedEndAt(ranges, 25)).toBe(25);
  });

  it("handles an empty buffer and a non-finite playhead", () => {
    expect(bufferedEndAt([], 12)).toBe(12);
    expect(bufferedEndAt([{ start: 0, end: 30 }], Number.NaN)).toBe(0);
  });
});

describe("clampSeek", () => {
  it("clamps into the video", () => {
    expect(clampSeek(-5, 100)).toBe(0);
    expect(clampSeek(150, 100)).toBe(100);
    expect(clampSeek(42, 100)).toBe(42);
  });

  it("passes the target through while the duration is unknown", () => {
    // Clamping to a NaN duration would produce NaN, and assigning NaN to
    // video.currentTime throws.
    expect(clampSeek(42, Number.NaN)).toBe(42);
    expect(clampSeek(42, Number.POSITIVE_INFINITY)).toBe(42);
    expect(clampSeek(-1, Number.NaN)).toBe(0);
  });

  it("never returns NaN", () => {
    expect(clampSeek(Number.NaN, 100)).toBe(0);
  });
});

describe("trackFraction", () => {
  it("maps a pointer position onto the track", () => {
    expect(trackFraction(100, 100, 200)).toBe(0);
    expect(trackFraction(200, 100, 200)).toBe(0.5);
    expect(trackFraction(300, 100, 200)).toBe(1);
  });

  it("clamps a drag that leaves the track", () => {
    // Pointer capture keeps delivering moves after the finger leaves the bar.
    expect(trackFraction(-40, 100, 200)).toBe(0);
    expect(trackFraction(9999, 100, 200)).toBe(1);
  });

  it("returns 0 for a track with no width, rather than NaN", () => {
    expect(trackFraction(100, 100, 0)).toBe(0);
    expect(trackFraction(Number.NaN, 100, 200)).toBe(0);
  });
});

describe("progressFraction", () => {
  it("is the played fraction", () => {
    expect(progressFraction(25, 100)).toBe(0.25);
    expect(progressFraction(0, 100)).toBe(0);
  });

  it("clamps past the end", () => {
    // currentTime can exceed duration by a frame at the very end.
    expect(progressFraction(101, 100)).toBe(1);
  });

  it("is 0 while the duration is unknown", () => {
    expect(progressFraction(10, Number.NaN)).toBe(0);
    expect(progressFraction(10, 0)).toBe(0);
  });
});
