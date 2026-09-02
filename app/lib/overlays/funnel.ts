// The overlay conversion funnel, derived from rolled-up daily counts.
//
// THE FIVE STAGES ARE THE ONES NAMED IN ISSUE #302 §2.x, in this order:
//
//   video_start -> gate_shown -> lead_submitted -> cta_click -> video_completed
//
// ===========================================================================
// THIS IS NOT A STRICT FUNNEL, AND THE UI MUST NOT PRETEND IT IS
// ===========================================================================
// A real funnel guarantees stage N+1 is a subset of stage N. This one does not,
// and cannot:
//
//   - gate_shown only fires where a lead gate is CONFIGURED. A demo with no gate
//     has starts and zero gate_shown, so stage 2 legitimately reads 0 while
//     stage 4 does not.
//   - cta_click fires from branching cards in the final seconds, and a viewer
//     who clicks one navigates away — so cta_click can exceed video_completed
//     for exactly the demos where the cards are working.
//   - a viewer who seeks past the gate trigger never sees it but still finishes.
//
// So a stage can be LARGER than the one before it, and `dropOffPct` would then
// be negative. `deriveFunnel` CLAMPS conversion to 0-100% and reports the raw
// counts unmodified, because a >100% conversion rate on a dashboard reads as a
// bug in the dashboard even when it is a true statement about the data.
//
// PURE: counts in, percentages out. No prisma, no Date.now(). The caller reads
// PlayerEventDaily (never raw PlayerEvent) and hands the totals here.

import type { PlayerEventName } from "./events";

/** The funnel's stages, in order. A subset of PLAYER_EVENT_NAMES, deliberately:
 *  gate_skipped and meeting_booked are real events but not funnel steps. */
export const FUNNEL_STAGES = [
  "video_start",
  "gate_shown",
  "lead_submitted",
  "cta_click",
  "video_completed",
] as const satisfies readonly PlayerEventName[];

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** Labels for the dashboard. Kept beside the union so a new stage cannot ship unlabelled. */
export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  video_start: "Video started",
  gate_shown: "Lead gate shown",
  lead_submitted: "Lead submitted",
  cta_click: "CTA clicked",
  video_completed: "Video completed",
};

/** Counts keyed by event name. Missing keys are zero, never undefined-as-NaN. */
export type EventCounts = Partial<Record<string, number>>;

export interface FunnelStep {
  stage: FunnelStage;
  label: string;
  count: number;
  /** Share of `video_start`, 0-100, rounded to one decimal. 0 when there are no starts. */
  ofStartPct: number;
  /** Share of the PREVIOUS stage, 0-100. 0 when `comparable` is false. */
  ofPreviousPct: number;
  /** 100 - ofPreviousPct, clamped to 0-100. 0 when `comparable` is false. */
  dropOffPct: number;
  /** Absolute loss against the previous stage, floored at 0. */
  dropOffCount: number;
  /**
   * Whether the comparison against the previous stage MEANS anything.
   *
   * False for the first stage (nothing precedes it) and whenever the previous
   * stage is 0 — 40 CTA clicks after 0 lead submissions is not a 0% conversion
   * and not a 100% one, it is an undefined ratio, and the panel renders a dash
   * for it. Picking a number here would put a confident falsehood on a dashboard
   * rather than admitting the denominator is empty.
   */
  comparable: boolean;
}

export interface Funnel {
  steps: FunnelStep[];
  /** Total events across the five stages. Zero means "nothing to show", not "0%". */
  totalEvents: number;
  /** video_start count, hoisted because every rate on the page is a share of it. */
  starts: number;
}

/**
 * Percent of `part` in `whole`, one decimal, clamped to 0-100.
 *
 * THE DIVIDE-BY-ZERO IS THE POINT. A workspace with the flag off has zero of
 * everything, and `0/0` is NaN — which React renders as the literal text "NaN%"
 * in a dashboard someone is paying for. A stage with zero events reads 0%, and
 * funnel.test.ts pins that it is never NaN and never Infinity.
 */
export function percent(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return 0;
  }
  const raw = (part / whole) * 100;
  const clamped = Math.min(100, Math.max(0, raw));
  return Math.round(clamped * 10) / 10;
}

/** A count that is safe to render: non-finite and negative collapse to 0. */
function safeCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Build the five-step funnel from a map of event name -> total count.
 *
 * Always returns five steps, even when every count is zero — the panel decides
 * whether to render an empty state, and it should not have to guess from an
 * array length whether it got data or a bug.
 */
export function deriveFunnel(counts: EventCounts): Funnel {
  const steps: FunnelStep[] = [];
  const starts = safeCount(counts.video_start);
  let previous = 0;
  let totalEvents = 0;

  FUNNEL_STAGES.forEach((stage, index) => {
    const count = safeCount(counts[stage]);
    totalEvents += count;

    // An empty denominator is not a 0% conversion — see `comparable` above.
    const comparable = index > 0 && previous > 0;
    const ofPreviousPct = comparable ? percent(count, previous) : 0;

    steps.push({
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      count,
      ofStartPct: index === 0 ? (count > 0 ? 100 : 0) : percent(count, starts),
      ofPreviousPct,
      dropOffPct: comparable ? Math.max(0, Math.round((100 - ofPreviousPct) * 10) / 10) : 0,
      dropOffCount: comparable ? Math.max(0, previous - count) : 0,
      comparable,
    });
    previous = count;
  });

  return { steps, totalEvents, starts };
}

/** One row of the rollup as the analytics page reads it back. */
export interface DemoEventTotal {
  demoId: string;
  name: string;
  count: number;
}

export interface DemoFunnel {
  demoId: string;
  title: string;
  funnel: Funnel;
}

/**
 * Aggregate totals + a demo title lookup -> one funnel per demo, plus the
 * workspace total.
 *
 * Demos with no events at all are omitted rather than listed as five zeroes: a
 * list of empty funnels is noise, and the panel's empty state already says
 * "nothing yet" better than fifty zero rows would.
 *
 * A `demoId` with no matching title is ALSO omitted. PlayerEventDaily has no
 * foreign key by design (the rollup outlives its demo so historical totals do
 * not rewrite themselves), so rows for deleted demos are expected here — they
 * still count toward the workspace total, they simply have no row to name.
 */
export function deriveDemoFunnels(
  totals: readonly DemoEventTotal[],
  titlesByDemoId: ReadonlyMap<string, string>
): { overall: Funnel; perDemo: DemoFunnel[] } {
  const overallCounts: Record<string, number> = {};
  const byDemo = new Map<string, Record<string, number>>();

  for (const row of totals) {
    const count = safeCount(row.count);
    if (count === 0) {
      continue;
    }
    overallCounts[row.name] = (overallCounts[row.name] ?? 0) + count;

    let demoCounts = byDemo.get(row.demoId);
    if (!demoCounts) {
      demoCounts = {};
      byDemo.set(row.demoId, demoCounts);
    }
    demoCounts[row.name] = (demoCounts[row.name] ?? 0) + count;
  }

  const perDemo: DemoFunnel[] = [];
  for (const [demoId, demoCounts] of byDemo) {
    const title = titlesByDemoId.get(demoId);
    if (title === undefined) {
      continue;
    }
    const funnel = deriveFunnel(demoCounts);
    if (funnel.totalEvents === 0) {
      continue;
    }
    perDemo.push({ demoId, title, funnel });
  }

  // Most starts first, then most total activity, then id — a total order, so the
  // list does not reshuffle between two renders of identical data.
  perDemo.sort(
    (a, b) =>
      b.funnel.starts - a.funnel.starts ||
      b.funnel.totalEvents - a.funnel.totalEvents ||
      a.demoId.localeCompare(b.demoId)
  );

  return { overall: deriveFunnel(overallCounts), perDemo };
}
