import { describe, expect, it } from "vitest";

import {
  FUNNEL_STAGES,
  deriveDemoFunnels,
  deriveFunnel,
  percent,
  type DemoEventTotal,
} from "./funnel";

describe("percent", () => {
  it("computes a one-decimal percentage", () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(1, 3)).toBe(33.3);
  });

  // THE POINT OF THIS MODULE. Every one of these renders as literal "NaN%" or
  // "Infinity%" on a dashboard if the guard is removed.
  it("never returns NaN or Infinity", () => {
    for (const value of [
      percent(0, 0),
      percent(5, 0),
      percent(Number.NaN, 10),
      percent(10, Number.NaN),
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
      expect(value).toBe(0);
    }
  });

  it("clamps above 100 rather than reporting a >100% conversion", () => {
    // Real: cta_click from a branching card can exceed video_completed, because
    // clicking the card navigates the viewer away from the video.
    expect(percent(150, 100)).toBe(100);
  });

  it("clamps a negative part to zero", () => {
    expect(percent(-10, 100)).toBe(0);
  });
});

describe("deriveFunnel", () => {
  it("always returns the five stages in order", () => {
    const funnel = deriveFunnel({});
    expect(funnel.steps.map((s) => s.stage)).toEqual([...FUNNEL_STAGES]);
  });

  it("derives counts and drop-off from a known rollup", () => {
    const funnel = deriveFunnel({
      video_start: 1000,
      gate_shown: 400,
      lead_submitted: 100,
      cta_click: 60,
      video_completed: 250,
      // Not a funnel stage. Present in the rollup, ignored here.
      gate_skipped: 300,
    });

    expect(funnel.starts).toBe(1000);
    expect(funnel.steps.map((s) => s.count)).toEqual([1000, 400, 100, 60, 250]);

    // Share of the previous stage. The first stage has no predecessor, so it is
    // not comparable and reports 0 rather than a meaningless 100%.
    expect(funnel.steps.map((s) => s.ofPreviousPct)).toEqual([0, 40, 25, 60, 100]);
    expect(funnel.steps.map((s) => s.comparable)).toEqual([false, true, true, true, true]);
    // Share of video_start.
    expect(funnel.steps.map((s) => s.ofStartPct)).toEqual([100, 40, 10, 6, 25]);
    // Drop-off against the previous stage, floored at zero.
    expect(funnel.steps.map((s) => s.dropOffPct)).toEqual([0, 60, 75, 40, 0]);
    expect(funnel.steps.map((s) => s.dropOffCount)).toEqual([0, 600, 300, 40, 0]);

    // gate_skipped is excluded from the total: totalEvents is the five stages.
    expect(funnel.totalEvents).toBe(1810);
  });

  // THE EMPTY-STATE CASE. A workspace with the flag off has zero events, and
  // every number on the page must be a real 0, not NaN and not Infinity.
  it("renders an all-zero funnel as zeroes, never NaN or Infinity", () => {
    const funnel = deriveFunnel({});

    expect(funnel.totalEvents).toBe(0);
    expect(funnel.starts).toBe(0);
    for (const step of funnel.steps) {
      expect(step.count).toBe(0);
      // No stage claims a 100% drop-off out of an empty table.
      expect(step.comparable).toBe(false);
      for (const value of [
        step.ofStartPct,
        step.ofPreviousPct,
        step.dropOffPct,
        step.dropOffCount,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBe(0);
      }
    }
  });

  // A SINGLE STAGE AT ZERO, mid-funnel. This is the common real case: a demo
  // with no lead gate configured has starts, no gate_shown, and completions.
  it("handles a zero stage in the middle without poisoning the stages after it", () => {
    const funnel = deriveFunnel({
      video_start: 500,
      gate_shown: 0,
      lead_submitted: 0,
      cta_click: 40,
      video_completed: 300,
    });

    const [start, gate, lead, cta, completed] = funnel.steps;

    // gate_shown has a real denominator (500 starts), so 0 of 500 IS a 100%
    // drop-off and says so.
    expect(gate.count).toBe(0);
    expect(gate.comparable).toBe(true);
    expect(gate.ofPreviousPct).toBe(0);
    expect(gate.dropOffPct).toBe(100);

    // lead_submitted's denominator is now 0. Undefined, not 0% and not 100%.
    expect(lead.comparable).toBe(false);
    expect(lead.ofPreviousPct).toBe(0);
    expect(lead.dropOffPct).toBe(0);
    expect(Number.isNaN(lead.ofPreviousPct)).toBe(false);

    // cta_click over a previous stage of 0 would be Infinity unguarded.
    expect(cta.comparable).toBe(false);
    expect(Number.isFinite(cta.ofPreviousPct)).toBe(true);
    expect(cta.dropOffPct).toBe(0);
    // Its share of STARTS is still meaningful and correct.
    expect(cta.ofStartPct).toBe(8);

    expect(start.ofStartPct).toBe(100);
    expect(completed.ofStartPct).toBe(60);
  });

  it("does not report a negative drop-off when a stage exceeds the one before it", () => {
    // cta_click > lead_submitted is normal — branching cards fire cta_click on
    // demos with no gate at all.
    const funnel = deriveFunnel({
      video_start: 100,
      gate_shown: 10,
      lead_submitted: 5,
      cta_click: 50,
      video_completed: 20,
    });

    for (const step of funnel.steps) {
      expect(step.dropOffPct).toBeGreaterThanOrEqual(0);
      expect(step.dropOffCount).toBeGreaterThanOrEqual(0);
    }
    // 50 clicks after 5 submissions is 1000%, reported as a clamped 100%.
    expect(funnel.steps[3].ofPreviousPct).toBe(100);
    expect(funnel.steps[3].dropOffPct).toBe(0);
  });

  it("floors a negative or non-finite count at zero", () => {
    const funnel = deriveFunnel({ video_start: -5, gate_shown: Number.NaN });
    expect(funnel.steps[0].count).toBe(0);
    expect(funnel.steps[1].count).toBe(0);
  });
});

describe("deriveDemoFunnels", () => {
  const totals: DemoEventTotal[] = [
    { demoId: "demo-a", name: "video_start", count: 100 },
    { demoId: "demo-a", name: "gate_shown", count: 40 },
    { demoId: "demo-a", name: "lead_submitted", count: 10 },
    { demoId: "demo-b", name: "video_start", count: 20 },
    { demoId: "demo-b", name: "video_completed", count: 5 },
  ];
  const titles = new Map([
    ["demo-a", "Onboarding walkthrough"],
    ["demo-b", "Pricing tour"],
    ["demo-c", "Never viewed"],
  ]);

  it("sums the workspace total across demos", () => {
    const { overall } = deriveDemoFunnels(totals, titles);
    expect(overall.starts).toBe(120);
    expect(overall.steps.map((s) => s.count)).toEqual([120, 40, 10, 0, 5]);
  });

  it("builds one funnel per demo that has events", () => {
    const { perDemo } = deriveDemoFunnels(totals, titles);
    expect(perDemo.map((d) => d.demoId)).toEqual(["demo-a", "demo-b"]);
    expect(perDemo[0].title).toBe("Onboarding walkthrough");
    expect(perDemo[0].funnel.steps[1].count).toBe(40);
  });

  it("omits demos with no events rather than listing rows of zeroes", () => {
    const { perDemo } = deriveDemoFunnels(totals, titles);
    expect(perDemo.some((d) => d.demoId === "demo-c")).toBe(false);
  });

  it("counts a deleted demo's rows in the total but gives them no row", () => {
    // PlayerEventDaily has no foreign key by design, so rows outlive their demo.
    const withDeleted: DemoEventTotal[] = [
      ...totals,
      { demoId: "demo-deleted", name: "video_start", count: 7 },
    ];
    const { overall, perDemo } = deriveDemoFunnels(withDeleted, titles);
    expect(overall.starts).toBe(127);
    expect(perDemo.map((d) => d.demoId)).toEqual(["demo-a", "demo-b"]);
  });

  it("returns an empty, non-NaN result for no rows at all", () => {
    const { overall, perDemo } = deriveDemoFunnels([], new Map());
    expect(perDemo).toEqual([]);
    expect(overall.totalEvents).toBe(0);
    expect(overall.steps.every((s) => Number.isFinite(s.ofStartPct))).toBe(true);
  });

  it("orders demos by starts, deterministically", () => {
    const tied: DemoEventTotal[] = [
      { demoId: "demo-b", name: "video_start", count: 10 },
      { demoId: "demo-a", name: "video_start", count: 10 },
    ];
    const { perDemo } = deriveDemoFunnels(
      tied,
      new Map([
        ["demo-a", "A"],
        ["demo-b", "B"],
      ])
    );
    expect(perDemo.map((d) => d.demoId)).toEqual(["demo-a", "demo-b"]);
  });
});
