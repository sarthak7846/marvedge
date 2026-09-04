// THE event vocabulary. One definition, imported by the client emitter, the
// ingest route and (in PR 7) the rollup.
//
// A drifted copy of this union is how this feature rots: the player starts
// emitting a name the ingest route does not know, the route silently drops it
// exactly as designed, and the funnel quietly loses a step with nothing in the
// logs to say so. If you need a new event, add it HERE and nowhere else.

import { z } from "zod";

/**
 * Every event the player may emit, closed.
 *
 * The five named in issue #302 are video_start, gate_shown, lead_submitted,
 * cta_click and video_completed. `gate_skipped` and `meeting_booked` are
 * additive extras with no consumer yet — PR 3 emits gate_skipped when a soft
 * gate is dismissed, and PR 6 emits meeting_booked from the scheduling widget's
 * callback. They live here from day one so that neither PR has to touch this
 * union (and so neither is tempted to invent its own name for them).
 */
export const PLAYER_EVENT_NAMES = [
  "video_start",
  "gate_shown",
  "gate_skipped",
  "lead_submitted",
  "cta_click",
  "meeting_booked",
  "video_completed",
] as const;

export type PlayerEventName = (typeof PLAYER_EVENT_NAMES)[number];

const PLAYER_EVENT_NAME_SET: ReadonlySet<string> = new Set(PLAYER_EVENT_NAMES);

export function isPlayerEventName(value: unknown): value is PlayerEventName {
  return typeof value === "string" && PLAYER_EVENT_NAME_SET.has(value);
}

// --- Caps ------------------------------------------------------------------

/**
 * Batches are flushed on visibilitychange/pagehide, so a long session can
 * accumulate a few events — not fifty. The cap is an abuse bound, not a
 * capacity plan: a batch over it is rejected wholesale rather than truncated,
 * because a client sending 500 events is broken or hostile and neither case is
 * improved by storing the first 50.
 */
export const MAX_EVENTS_PER_BATCH = 50;

/** Serialized bytes of `meta` per event. Oversized meta is dropped, not stored. */
export const MAX_META_BYTES = 1024;

/** Generous upper bound on a position: 24h of video. */
const MAX_POSITION_SEC = 86400;

// --- Envelope schema -------------------------------------------------------

export const playerEventSchema = z.object({
  // Deliberately a plain bounded string, NOT the enum. The route must drop an
  // unknown name silently rather than 400 the batch — a stale cached client
  // emitting a retired name must not be able to spam the error logs, and it
  // must not take its batch's valid events down with it. selectKnownEvents()
  // below does the narrowing.
  name: z.string().min(1).max(64),
  positionSec: z.number().finite().nonnegative().max(MAX_POSITION_SEC).optional(),
  /**
   * Client clock, epoch ms, used ONLY to order events within a batch. It is
   * never written to PlayerEvent.timestamp: the client can set it to anything,
   * and a forged value would let anyone write rows into last quarter's rollup.
   * The DB default (now()) is the recorded time.
   */
  at: z.number().finite(),
  meta: z.unknown().optional(),
});

export const playerEventBatchSchema = z.object({
  /**
   * Present for a future cross-origin embed, where a third-party cookie may be
   * blocked. THE INGEST ROUTE IGNORES IT: the mv_sid cookie is the only source
   * of session identity, because a client-supplied id is trivially forgeable
   * and honouring it would let anyone write events under someone else's
   * session. Nothing authorises on mv_sid either — it is an analytics id.
   */
  sessionId: z.string().max(128).optional(),
  demoId: z.string().max(64).optional(),
  exportedVideoId: z.string().max(64).optional(),
  events: z.array(playerEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

export type PlayerEventBatch = z.infer<typeof playerEventBatchSchema>;

/** An event that survived validation and is known to this version. */
export interface NormalizedPlayerEvent {
  name: PlayerEventName;
  positionSec?: number;
  at: number;
  meta?: Record<string, unknown>;
}

export interface SelectedEvents {
  events: NormalizedPlayerEvent[];
  /** Counters only — the route logs these, never the payload they came from. */
  droppedUnknown: number;
  droppedMeta: number;
}

/** Serialized size of a value, or undefined when it will not serialize. */
function jsonByteLength(value: unknown): number | undefined {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json.length : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Narrow a validated batch's events to the ones this version knows, dropping
 * the rest and reporting how many went.
 *
 * Two independent drops, counted separately so the route can tell "an old
 * client is deployed somewhere" (droppedUnknown) apart from "someone is
 * stuffing the meta field" (droppedMeta). An event with oversized meta keeps
 * the event and loses the meta — the funnel step is the valuable part.
 */
export function selectKnownEvents(
  events: readonly z.infer<typeof playerEventSchema>[]
): SelectedEvents {
  const selected: NormalizedPlayerEvent[] = [];
  let droppedUnknown = 0;
  let droppedMeta = 0;

  for (const event of events) {
    if (!isPlayerEventName(event.name)) {
      droppedUnknown++;
      continue;
    }

    let meta: Record<string, unknown> | undefined;
    if (event.meta !== undefined && event.meta !== null) {
      const isPlainObject = typeof event.meta === "object" && !Array.isArray(event.meta);
      const size = isPlainObject ? jsonByteLength(event.meta) : undefined;
      if (isPlainObject && size !== undefined && size <= MAX_META_BYTES) {
        meta = event.meta as Record<string, unknown>;
      } else {
        droppedMeta++;
      }
    }

    selected.push({
      name: event.name,
      ...(event.positionSec !== undefined ? { positionSec: event.positionSec } : {}),
      at: event.at,
      ...(meta ? { meta } : {}),
    });
  }

  // Client clock only, and only relative to itself — see `at` above.
  selected.sort((a, b) => a.at - b.at);

  return { events: selected, droppedUnknown, droppedMeta };
}

export type ParsedBatch =
  | { ok: true; batch: PlayerEventBatch }
  | { ok: false; reason: "not_json" | "invalid_shape" };

/**
 * Parse a raw request body into a batch.
 *
 * Takes the RAW STRING rather than a parsed object because sendBeacon with a
 * Blob does not reliably set a JSON content-type, so the route reads text and
 * parses it here — one place that knows both failure modes.
 *
 * Never throws, and never returns the offending input in its result: the route
 * answers 204 either way and must not echo caller data into a log line.
 */
export function parsePlayerEventBatch(rawBody: string): ParsedBatch {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const parsed = playerEventBatchSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_shape" };
  }
  return { ok: true, batch: parsed.data };
}
