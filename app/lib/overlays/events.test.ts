import { describe, expect, it } from "vitest";

import {
  MAX_EVENTS_PER_BATCH,
  MAX_META_BYTES,
  PLAYER_EVENT_NAMES,
  isPlayerEventName,
  parsePlayerEventBatch,
  playerEventBatchSchema,
  selectKnownEvents,
} from "./events";

function batch(events: unknown[], extra: Record<string, unknown> = {}) {
  return { demoId: "demo-1", events, ...extra };
}

function event(name: string, extra: Record<string, unknown> = {}) {
  return { name, at: 1700000000000, ...extra };
}

describe("PLAYER_EVENT_NAMES", () => {
  it("carries the five from the issue plus the two additive extras", () => {
    // A drifted copy of this list is how the funnel silently loses a step.
    expect([...PLAYER_EVENT_NAMES]).toEqual([
      "video_start",
      "gate_shown",
      "gate_skipped",
      "lead_submitted",
      "cta_click",
      "meeting_booked",
      "video_completed",
    ]);
  });

  it("recognises exactly those names", () => {
    for (const name of PLAYER_EVENT_NAMES) {
      expect(isPlayerEventName(name)).toBe(true);
    }
    for (const name of ["video_started", "VIDEO_START", "", "toString", undefined, 42, null]) {
      expect(isPlayerEventName(name)).toBe(false);
    }
  });

  it("is not fooled by inherited Object properties", () => {
    expect(isPlayerEventName("constructor")).toBe(false);
    expect(isPlayerEventName("__proto__")).toBe(false);
  });
});

describe("playerEventBatchSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = playerEventBatchSchema.safeParse(
      batch([
        event("video_start", { positionSec: 0 }),
        event("video_completed", { positionSec: 30.5 }),
      ])
    );
    expect(parsed.success).toBe(true);
  });

  it("accepts an exportedVideoId instead of a demoId", () => {
    const parsed = playerEventBatchSchema.safeParse({
      exportedVideoId: "ev-1",
      events: [event("video_start")],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts exactly the cap and rejects one over it", () => {
    const atCap = Array.from({ length: MAX_EVENTS_PER_BATCH }, () => event("video_start"));
    expect(playerEventBatchSchema.safeParse(batch(atCap)).success).toBe(true);

    const overCap = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => event("video_start"));
    // Rejected wholesale, not truncated: a client sending this is broken or
    // hostile, and neither is improved by storing the first 50.
    expect(playerEventBatchSchema.safeParse(batch(overCap)).success).toBe(false);
  });

  it("rejects an empty or missing events array", () => {
    expect(playerEventBatchSchema.safeParse(batch([])).success).toBe(false);
    expect(playerEventBatchSchema.safeParse({ demoId: "demo-1" }).success).toBe(false);
  });

  it("rejects an event missing its name or its `at`", () => {
    expect(playerEventBatchSchema.safeParse(batch([{ at: 1 }])).success).toBe(false);
    expect(playerEventBatchSchema.safeParse(batch([{ name: "video_start" }])).success).toBe(false);
  });

  it("rejects a negative or non-finite positionSec", () => {
    expect(
      playerEventBatchSchema.safeParse(batch([event("video_start", { positionSec: -1 })])).success
    ).toBe(false);
    expect(
      playerEventBatchSchema.safeParse(
        batch([event("video_start", { positionSec: Number.POSITIVE_INFINITY })])
      ).success
    ).toBe(false);
  });

  it("does NOT reject an unknown event name at the schema layer", () => {
    // Deliberate: the route must drop an unknown name silently rather than 400
    // the batch, so a stale cached client cannot spam the error logs or take
    // its batch's valid events down with it. selectKnownEvents does that.
    expect(playerEventBatchSchema.safeParse(batch([event("some_future_event")])).success).toBe(
      true
    );
  });

  it("bounds the free-string identifiers", () => {
    expect(playerEventBatchSchema.safeParse(batch([event("x".repeat(200))])).success).toBe(false);
    expect(
      playerEventBatchSchema.safeParse(batch([event("video_start")], { demoId: "d".repeat(200) }))
        .success
    ).toBe(false);
  });
});

describe("selectKnownEvents", () => {
  const parse = (events: unknown[]) => {
    const parsed = playerEventBatchSchema.safeParse(batch(events));
    if (!parsed.success) {
      throw new Error("fixture did not parse");
    }
    return parsed.data.events;
  };

  it("keeps known names and drops unknown ones, counting the drops", () => {
    const result = selectKnownEvents(
      parse([event("video_start"), event("not_an_event"), event("cta_click"), event("also_not")])
    );
    expect(result.events.map((e) => e.name)).toEqual(["video_start", "cta_click"]);
    expect(result.droppedUnknown).toBe(2);
    expect(result.droppedMeta).toBe(0);
  });

  it("keeps a valid batch's good events when one is unknown", () => {
    const result = selectKnownEvents(parse([event("bogus"), event("video_completed")]));
    expect(result.events).toHaveLength(1);
  });

  it("keeps meta within the cap", () => {
    const result = selectKnownEvents(parse([event("cta_click", { meta: { ctaId: "c1" } })]));
    expect(result.events[0].meta).toEqual({ ctaId: "c1" });
    expect(result.droppedMeta).toBe(0);
  });

  it("drops oversized meta but keeps the event", () => {
    // The funnel step is the valuable part; the payload is not worth the row.
    const oversized = { blob: "x".repeat(MAX_META_BYTES + 100) };
    const result = selectKnownEvents(parse([event("cta_click", { meta: oversized })]));
    expect(result.events).toHaveLength(1);
    expect(result.events[0].meta).toBeUndefined();
    expect(result.droppedMeta).toBe(1);
  });

  it("drops meta that is not a plain object", () => {
    const result = selectKnownEvents(
      parse([event("cta_click", { meta: "a string" }), event("cta_click", { meta: [1, 2, 3] })])
    );
    expect(result.events).toHaveLength(2);
    expect(result.events.every((e) => e.meta === undefined)).toBe(true);
    expect(result.droppedMeta).toBe(2);
  });

  it("treats absent and null meta as no meta, without counting a drop", () => {
    const result = selectKnownEvents(
      parse([event("video_start"), event("video_start", { meta: null })])
    );
    expect(result.droppedMeta).toBe(0);
    expect(result.events.every((e) => e.meta === undefined)).toBe(true);
  });

  it("orders events by the client clock within the batch", () => {
    const result = selectKnownEvents(
      parse([
        { name: "video_completed", at: 300 },
        { name: "video_start", at: 100 },
        { name: "gate_shown", at: 200 },
      ])
    );
    expect(result.events.map((e) => e.name)).toEqual([
      "video_start",
      "gate_shown",
      "video_completed",
    ]);
  });

  it("returns nothing when every name is unknown", () => {
    const result = selectKnownEvents(parse([event("a_a"), event("b_b")]));
    expect(result.events).toEqual([]);
    expect(result.droppedUnknown).toBe(2);
  });
});

describe("parsePlayerEventBatch", () => {
  it("parses a text/plain sendBeacon body", () => {
    // sendBeacon with a Blob does not reliably set application/json, which is
    // why the route reads raw text and this function parses it.
    const result = parsePlayerEventBatch(JSON.stringify(batch([event("video_start")])));
    expect(result.ok).toBe(true);
  });

  it("reports non-JSON without throwing", () => {
    for (const junk of ["", "not json", "{", "undefined", "<html>"]) {
      const result = parsePlayerEventBatch(junk);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("not_json");
      }
    }
  });

  it("reports valid JSON of the wrong shape", () => {
    for (const junk of ["null", "42", '"a string"', "[]", "{}", '{"events":[]}']) {
      const result = parsePlayerEventBatch(junk);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("invalid_shape");
      }
    }
  });

  it("never returns the offending input in its result", () => {
    // The route logs counters only; nothing here may carry caller data into a log.
    const result = parsePlayerEventBatch('{"events":[{"name":"secret@example.com"}]}');
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
  });
});
