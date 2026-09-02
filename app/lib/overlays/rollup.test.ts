import { describe, expect, it } from "vitest";

import {
  DEFAULT_EVENT_RETENTION_DAYS,
  DEFAULT_LEAD_RETENTION_DAYS,
  parseRetentionDays,
  retentionCutoff,
  rollupPlayerEvents,
  utcDateKey,
  utcDayEnd,
  utcDayStart,
  type RollupSourceEvent,
} from "./rollup";

const DAY = "2026-09-01";
const dayStart = new Date(`${DAY}T00:00:00.000Z`);

function event(demoId: string | null, name: string, iso: string): RollupSourceEvent {
  return { demoId, name, timestamp: new Date(iso) };
}

describe("utcDayStart / utcDayEnd / utcDateKey", () => {
  it("snaps to midnight UTC regardless of the time of day", () => {
    expect(utcDayStart(new Date("2026-09-01T23:59:59.999Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z"
    );
    expect(utcDayStart(new Date("2026-09-01T00:00:00.000Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z"
    );
  });

  it("dates by UTC, not by the host timezone", () => {
    // 23:30 in Los Angeles on Aug 31 is 06:30 UTC on Sep 1. The UTC day wins —
    // that is the rule the whole rollup is built on.
    expect(utcDateKey(new Date("2026-09-01T06:30:00.000Z"))).toBe("2026-09-01");
    // And 22:00 UTC on Sep 1 is still Sep 1 even though it is Sep 2 in Berlin.
    expect(utcDateKey(new Date("2026-09-01T22:00:00.000Z"))).toBe("2026-09-01");
  });

  it("ends a day exactly 24h after it starts", () => {
    expect(utcDayEnd(dayStart).getTime() - utcDayStart(dayStart).getTime()).toBe(86400000);
  });
});

describe("rollupPlayerEvents", () => {
  it("counts by (demoId, name) for the given day", () => {
    const result = rollupPlayerEvents(
      [
        event("demo-a", "video_start", `${DAY}T01:00:00.000Z`),
        event("demo-a", "video_start", `${DAY}T02:00:00.000Z`),
        event("demo-a", "gate_shown", `${DAY}T02:00:05.000Z`),
        event("demo-b", "video_start", `${DAY}T03:00:00.000Z`),
      ],
      dayStart
    );

    expect(result.rows).toEqual([
      { demoId: "demo-a", name: "gate_shown", date: dayStart, count: 1 },
      { demoId: "demo-a", name: "video_start", date: dayStart, count: 2 },
      { demoId: "demo-b", name: "video_start", date: dayStart, count: 1 },
    ]);
    expect(result.skippedNoDemo).toBe(0);
    expect(result.skippedUnknownName).toBe(0);
    expect(result.skippedOutOfRange).toBe(0);
  });

  // FIXTURE: an empty day. A workspace with the flag off produces exactly this,
  // every day, and it must be an empty result rather than a throw or a row of
  // zeroes that would overwrite a real count on a re-run.
  it("returns no rows for an empty day", () => {
    const result = rollupPlayerEvents([], dayStart);
    expect(result.rows).toEqual([]);
    expect(result.skippedNoDemo).toBe(0);
    expect(result.skippedUnknownName).toBe(0);
    expect(result.skippedOutOfRange).toBe(0);
  });

  // FIXTURE: unknown event names. A stale cached client emitting a retired name
  // must not take the day's valid events down with it — the same rule the ingest
  // route holds in selectKnownEvents().
  it("drops unknown event names and counts them separately", () => {
    const result = rollupPlayerEvents(
      [
        event("demo-a", "video_start", `${DAY}T01:00:00.000Z`),
        event("demo-a", "overlay_opened", `${DAY}T01:00:01.000Z`),
        event("demo-a", "", `${DAY}T01:00:02.000Z`),
        event("demo-a", "VIDEO_START", `${DAY}T01:00:03.000Z`),
      ],
      dayStart
    );

    expect(result.rows).toEqual([
      { demoId: "demo-a", name: "video_start", date: dayStart, count: 1 },
    ]);
    expect(result.skippedUnknownName).toBe(3);
  });

  it("skips events with no demo and counts them separately", () => {
    // Export-only playback: PlayerEvent.exportedVideoId is set and demoId is
    // null. PlayerEventDaily.demoId is required, so there is nothing to count
    // these under. Normal, not an error.
    const result = rollupPlayerEvents(
      [
        event(null, "video_start", `${DAY}T01:00:00.000Z`),
        event("demo-a", "video_start", `${DAY}T01:00:01.000Z`),
      ],
      dayStart
    );

    expect(result.rows).toHaveLength(1);
    expect(result.skippedNoDemo).toBe(1);
  });

  // FIXTURE: the UTC boundary. The interval is [00:00:00.000, 24:00:00.000) —
  // midnight belongs to the day starting, not to the day ending, and one
  // millisecond before midnight belongs to the previous day.
  it("includes midnight and excludes the following midnight", () => {
    const result = rollupPlayerEvents(
      [
        event("demo-a", "video_start", "2026-08-31T23:59:59.999Z"),
        event("demo-a", "video_start", "2026-09-01T00:00:00.000Z"),
        event("demo-a", "video_start", "2026-09-01T23:59:59.999Z"),
        event("demo-a", "video_start", "2026-09-02T00:00:00.000Z"),
      ],
      dayStart
    );

    expect(result.rows).toEqual([
      { demoId: "demo-a", name: "video_start", date: dayStart, count: 2 },
    ]);
    expect(result.skippedOutOfRange).toBe(2);
  });

  it("rolls up the same events into two different days without overlap", () => {
    const events = [
      event("demo-a", "video_start", "2026-09-01T23:59:59.999Z"),
      event("demo-a", "video_completed", "2026-09-02T00:00:00.000Z"),
    ];

    const first = rollupPlayerEvents(events, new Date("2026-09-01T12:00:00.000Z"));
    const second = rollupPlayerEvents(events, new Date("2026-09-02T12:00:00.000Z"));

    expect(first.rows).toEqual([
      { demoId: "demo-a", name: "video_start", date: dayStart, count: 1 },
    ]);
    expect(second.rows).toEqual([
      {
        demoId: "demo-a",
        name: "video_completed",
        date: new Date("2026-09-02T00:00:00.000Z"),
        count: 1,
      },
    ]);
    // Every event landed in exactly one day. Nothing counted twice, nothing lost.
    expect(first.rows.length + second.rows.length).toBe(2);
  });

  it("accepts any time of day as the date argument and snaps it", () => {
    const result = rollupPlayerEvents(
      [event("demo-a", "cta_click", `${DAY}T08:00:00.000Z`)],
      new Date(`${DAY}T17:45:12.345Z`)
    );
    expect(result.rows[0].date.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("skips an invalid timestamp rather than producing an Invalid Date row", () => {
    const result = rollupPlayerEvents(
      [{ demoId: "demo-a", name: "video_start", timestamp: new Date("nonsense") }],
      dayStart
    );
    expect(result.rows).toEqual([]);
    expect(result.skippedOutOfRange).toBe(1);
  });

  it("is deterministic in its row order", () => {
    const events = [
      event("demo-z", "video_start", `${DAY}T01:00:00.000Z`),
      event("demo-a", "video_start", `${DAY}T01:00:01.000Z`),
      event("demo-a", "cta_click", `${DAY}T01:00:02.000Z`),
    ];
    const a = rollupPlayerEvents(events, dayStart);
    const b = rollupPlayerEvents([...events].reverse(), dayStart);
    expect(a.rows).toEqual(b.rows);
    expect(a.rows.map((r) => `${r.demoId}/${r.name}`)).toEqual([
      "demo-a/cta_click",
      "demo-a/video_start",
      "demo-z/video_start",
    ]);
  });
});

describe("retentionCutoff", () => {
  it("subtracts whole days from midnight UTC of the given day", () => {
    const cutoff = retentionCutoff(new Date("2026-09-01T17:45:00.000Z"), 90);
    expect(cutoff.toISOString()).toBe("2026-06-03T00:00:00.000Z");
  });

  it("is the same whatever time of day the sweep runs", () => {
    const morning = retentionCutoff(new Date("2026-09-01T00:00:01.000Z"), 90);
    const evening = retentionCutoff(new Date("2026-09-01T23:59:59.000Z"), 90);
    expect(morning.getTime()).toBe(evening.getTime());
  });

  it("collapses a non-positive or non-finite window to the start of today", () => {
    const now = new Date("2026-09-01T17:45:00.000Z");
    // Never the epoch, and never NaN: a misconfigured window must not delete
    // everything, and must not produce an unbounded comparison.
    expect(retentionCutoff(now, 0).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(retentionCutoff(now, -5).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(retentionCutoff(now, Number.NaN).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("parseRetentionDays", () => {
  it("uses the documented defaults", () => {
    expect(DEFAULT_EVENT_RETENTION_DAYS).toBe(90);
    expect(DEFAULT_LEAD_RETENTION_DAYS).toBe(730);
  });

  it("reads a valid positive integer", () => {
    expect(parseRetentionDays("30", 90)).toBe(30);
    expect(parseRetentionDays(" 365 ", 90)).toBe(365);
  });

  it("falls back rather than throwing or resolving to zero", () => {
    // Every one of these would otherwise become a cutoff of "midnight today"
    // and delete the entire table.
    expect(parseRetentionDays(undefined, 90)).toBe(90);
    expect(parseRetentionDays("", 90)).toBe(90);
    expect(parseRetentionDays("   ", 90)).toBe(90);
    expect(parseRetentionDays("0", 90)).toBe(90);
    expect(parseRetentionDays("-1", 90)).toBe(90);
    expect(parseRetentionDays("ninety", 90)).toBe(90);
    expect(parseRetentionDays("30.5", 90)).toBe(90);
    expect(parseRetentionDays("Infinity", 90)).toBe(90);
  });
});
