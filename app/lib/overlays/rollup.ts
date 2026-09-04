// Raw PlayerEvent rows -> daily (demoId, name, date) counts.
//
// WHY THIS EXISTS AT ALL: the analytics page reads THE ROLLUP, NEVER RAW EVENTS
// (locked decision 9). `View` is one row per view and survives a findMany on the
// dashboard; PlayerEvent is 10-20x that — a video_start, a gate_shown, a
// cta_click and a video_completed for a single viewing — and the same query
// shape against it degrades with traffic instead of with customer count.
// PlayerEventDaily is bounded by demos × event names × days, so a page that
// reads it costs the same on day 1000 as on day 1.
//
// ===========================================================================
// THE TIMEZONE RULE: ROLLUPS ARE UTC-DATED. ALWAYS.
// ===========================================================================
// A row's day is the UTC calendar day of `timestamp`, never the server's local
// day and never the viewer's. `PlayerEventDaily.date` is a `@db.Date` holding
// midnight UTC of that day.
//
// This is a real product decision, not an implementation detail: an owner in
// Los Angeles sees a "day" that ends at 5pm their time. The alternative —
// dating by the owner's timezone — means the same PlayerEvent row rolls up to
// different days for different readers, so the rollup could no longer be a
// shared table, and a timezone change would silently rewrite history. UTC is
// wrong by a fixed, explainable offset; per-viewer dating is wrong in a way
// nobody can reconcile. The funnel panel says "UTC" on screen for this reason.
//
// PURE, and deliberately so: no Date.now(), no prisma, no env. The caller
// supplies both the rows and the day, so every edge below is a fixture rather
// than a clock the test has to mock.

import { isPlayerEventName, type PlayerEventName } from "./events";

/** The shape this module needs from a PlayerEvent row. */
export interface RollupSourceEvent {
  /**
   * Nullable, mirroring the column. An event carrying only an `exportedVideoId`
   * has no demo to be counted under and is skipped — see `skippedNoDemo`.
   */
  demoId: string | null;
  name: string;
  timestamp: Date;
}

/** One upsertable PlayerEventDaily row. */
export interface RollupRow {
  demoId: string;
  name: PlayerEventName;
  /** Midnight UTC of the rolled-up day. */
  date: Date;
  count: number;
}

export interface RollupResult {
  rows: RollupRow[];
  /** Counters only — the caller logs these, never the rows they came from. */
  skippedNoDemo: number;
  skippedUnknownName: number;
  skippedOutOfRange: number;
}

const DAY_MS = 86400000;

/**
 * Midnight UTC of the day a timestamp falls in.
 *
 * `Date.UTC` rather than setUTCHours on a clone: it cannot be affected by the
 * host timezone at any point, which is the whole property this module needs.
 */
export function utcDayStart(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0)
  );
}

/** Exclusive end of the UTC day a timestamp falls in. */
export function utcDayEnd(value: Date): Date {
  return new Date(utcDayStart(value).getTime() + DAY_MS);
}

/** `YYYY-MM-DD` in UTC. The key format the funnel and the charts speak. */
export function utcDateKey(value: Date): string {
  return utcDayStart(value).toISOString().slice(0, 10);
}

/**
 * Aggregate raw events into daily counts for ONE UTC day.
 *
 * Rows outside that day are skipped rather than counted or thrown on. The
 * function is total on purpose: the caller selects with a `timestamp` range, and
 * an off-by-one in that range must produce a visible counter here rather than a
 * silently mis-dated row that the unique constraint then makes permanent. That
 * is what the UTC-boundary fixture in rollup.test.ts pins.
 *
 * Three independent skips, counted separately because they mean different
 * things: `skippedNoDemo` is normal (export-only playback), `skippedUnknownName`
 * means a client is emitting a name this deployment does not know, and
 * `skippedOutOfRange` means the caller's query window and this argument disagree
 * — a bug.
 */
export function rollupPlayerEvents(events: readonly RollupSourceEvent[], date: Date): RollupResult {
  const dayStart = utcDayStart(date);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + DAY_MS;

  const counts = new Map<string, RollupRow>();
  let skippedNoDemo = 0;
  let skippedUnknownName = 0;
  let skippedOutOfRange = 0;

  for (const event of events) {
    if (!event.demoId) {
      skippedNoDemo++;
      continue;
    }
    if (!isPlayerEventName(event.name)) {
      skippedUnknownName++;
      continue;
    }
    const at = event.timestamp.getTime();
    if (!Number.isFinite(at) || at < dayStartMs || at >= dayEndMs) {
      skippedOutOfRange++;
      continue;
    }

    // A space cannot appear in a cuid or in an event name, so it is a separator
    // no id can smuggle a collision through.
    const key = `${event.demoId} ${event.name}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { demoId: event.demoId, name: event.name, date: dayStart, count: 1 });
    }
  }

  // Sorted so a diff of two runs is readable and the upsert order is stable.
  const rows = [...counts.values()].sort(
    (a, b) => a.demoId.localeCompare(b.demoId) || a.name.localeCompare(b.name)
  );

  return { rows, skippedNoDemo, skippedUnknownName, skippedOutOfRange };
}

// --- Retention -------------------------------------------------------------

/** Raw PlayerEvent rows are kept for this many days (locked decision 15). */
export const DEFAULT_EVENT_RETENTION_DAYS = 90;

/** Leads are kept for 24 months (locked decision 15). */
export const DEFAULT_LEAD_RETENTION_DAYS = 730;

/**
 * The timestamp before which rows are deletable: midnight UTC of `now`, minus
 * `days`.
 *
 * Snapped to a UTC day boundary rather than "now minus N×86400s" so a retention
 * sweep deletes the same set whenever it runs that day. An unsnapped cutoff
 * makes the boundary depend on the minute the cron fired, which turns "has day X
 * been deleted yet?" into a question nobody can answer from the schedule.
 *
 * A non-positive or non-finite `days` collapses to the start of today rather
 * than to the epoch or to NaN: a misconfigured env var must delete nothing
 * outside today, never everything.
 */
export function retentionCutoff(now: Date, days: number): Date {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  return new Date(utcDayStart(now).getTime() - safeDays * DAY_MS);
}

/**
 * Read a retention window out of an env string, falling back on anything that
 * is not a positive whole number of days.
 *
 * FALLS BACK RATHER THAN THROWS. A typo in OVERLAYS_LEAD_RETENTION_DAYS must not
 * take down the endpoint that also runs the rollup, and it must never resolve to
 * 0 — which would be read by retentionCutoff as "midnight today" and delete
 * every lead older than this morning. The documented default is the safe value;
 * a bad value gets it.
 */
export function parseRetentionDays(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}
