import { describe, expect, it } from "vitest";

import {
  OVERLAY_PRIORITY,
  areControlsLocked,
  resolveActiveOverlay,
  shouldHoldPlayback,
  type OverlayKind,
  type OverlaySlot,
} from "./overlayHost";

function slot(id: string, kind: OverlayKind, open: boolean, blocking = false): OverlaySlot {
  return { id, kind, open, blocking };
}

describe("OVERLAY_PRIORITY", () => {
  it("orders gate above scheduler above branching", () => {
    // PRs 3, 5 and 6 register against this order. Reshuffling it silently
    // changes which overlay a viewer sees at the end of a gated video.
    expect(OVERLAY_PRIORITY.gate).toBeGreaterThan(OVERLAY_PRIORITY.scheduler);
    expect(OVERLAY_PRIORITY.scheduler).toBeGreaterThan(OVERLAY_PRIORITY.branching);
  });
});

describe("resolveActiveOverlay", () => {
  it("is null when nothing is registered or nothing is open", () => {
    expect(resolveActiveOverlay([])).toBeNull();
    expect(
      resolveActiveOverlay([slot("a", "gate", false), slot("b", "branching", false)])
    ).toBeNull();
  });

  it("renders the only open slot", () => {
    const active = resolveActiveOverlay([slot("a", "branching", true)]);
    expect(active?.id).toBe("a");
  });

  it("renders EXACTLY ONE overlay when several want to show", () => {
    const active = resolveActiveOverlay([
      slot("branch", "branching", true),
      slot("gate", "gate", true, true),
      slot("sched", "scheduler", true),
    ]);
    expect(active?.id).toBe("gate");
  });

  it("ignores registration order in favour of priority", () => {
    // Mount order is an accident of the JSX; it must not decide this.
    expect(
      resolveActiveOverlay([slot("sched", "scheduler", true), slot("gate", "gate", true)])?.id
    ).toBe("gate");
    expect(
      resolveActiveOverlay([slot("gate", "gate", true), slot("sched", "scheduler", true)])?.id
    ).toBe("gate");
  });

  it("breaks a same-kind tie on registration order, deterministically", () => {
    const active = resolveActiveOverlay([
      slot("first", "gate", true),
      slot("second", "gate", true),
    ]);
    expect(active?.id).toBe("first");
  });
});

// The transition table from PlayerOverlayHost.tsx's file header, asserted.
// These are the three questions PRs 3, 5 and 6 will each ask, and the answers
// have to survive a refactor of the component that renders them.
describe("transition table", () => {
  it("a branch card that opens under a live gate waits, and is not cancelled", () => {
    const gated = [slot("gate", "gate", true, true), slot("branch", "branching", true)];
    expect(resolveActiveOverlay(gated)?.id).toBe("gate");

    // The branch slot stayed registered and stayed open the whole time. When the
    // gate resolves, the SAME array re-resolves to it — its owner never had to
    // notice it lost, and never has to re-request.
    const resolved = [slot("gate", "gate", false, true), slot("branch", "branching", true)];
    expect(resolveActiveOverlay(resolved)?.id).toBe("branch");
  });

  it("a gate resolving with nothing waiting clears the layer", () => {
    expect(resolveActiveOverlay([slot("gate", "gate", false, true)])).toBeNull();
  });

  it("keeps the scheduler up regardless of playback ending", () => {
    // `ended` closes no overlay. A viewer halfway through a booking form must
    // not have it yanked away because the video ran out; video_completed is
    // emitted either way, so nothing is lost by leaving the widget alone.
    const open = [slot("sched", "scheduler", true)];
    expect(resolveActiveOverlay(open)?.id).toBe("sched");
    expect(shouldHoldPlayback(resolveActiveOverlay(open))).toBe(true);
  });

  it("promotes the scheduler over branch cards when the video ends mid-booking", () => {
    const atTheEnd = [slot("branch", "branching", true), slot("sched", "scheduler", true)];
    expect(resolveActiveOverlay(atTheEnd)?.id).toBe("sched");
  });
});

describe("areControlsLocked", () => {
  it("locks only behind a blocking overlay", () => {
    expect(areControlsLocked(slot("gate", "gate", true, true))).toBe(true);
    expect(areControlsLocked(slot("gate", "gate", true, false))).toBe(false);
    expect(areControlsLocked(slot("branch", "branching", true, false))).toBe(false);
  });

  it("leaves the controls live when nothing is showing", () => {
    expect(areControlsLocked(null)).toBe(false);
  });
});

describe("shouldHoldPlayback", () => {
  it("holds for ANY overlay, blocking or not", () => {
    // Opening an overlay is the only thing allowed to pause the video, so this
    // must not narrow to blocking overlays only.
    expect(shouldHoldPlayback(slot("gate", "gate", true, true))).toBe(true);
    expect(shouldHoldPlayback(slot("branch", "branching", true, false))).toBe(true);
    expect(shouldHoldPlayback(slot("sched", "scheduler", true, false))).toBe(true);
  });

  it("does not hold when the layer is clear", () => {
    expect(shouldHoldPlayback(null)).toBe(false);
  });
});
