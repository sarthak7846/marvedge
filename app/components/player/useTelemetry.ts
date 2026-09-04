"use client";

// Player telemetry: buffer events, flush them in batches, and never let any of
// it touch playback.
//
// THE ONE RULE HERE IS THAT NOTHING IN THIS FILE MAY BE ABLE TO BREAK A VIDEO.
// Every send is fire-and-forget, every failure is swallowed, and no code path
// awaits a network call before something the viewer can see. A share page on a
// customer's own domain that stops playing because our analytics endpoint is
// slow would be a far worse outcome than losing the analytics.
//
// The batch envelope, the event names and the caps all come from
// app/lib/overlays/events.ts (PR 1). This file adds no vocabulary of its own —
// if a later PR needs a new event, it goes in that union, not here.

import { useCallback, useEffect, useMemo, useRef } from "react";

import { postBeacon } from "@/app/lib/overlays/beacon";
import { MAX_EVENTS_PER_BATCH, type PlayerEventName } from "@/app/lib/overlays/events";
import { isCompleted } from "@/app/lib/overlays/playback";

/**
 * Relative on purpose. middleware.ts rewrites a non-apex host to
 * /hub/<domainKey>/… but skips everything under /api — in both its explicit
 * `startsWith("/api")` early return and its matcher's negative lookahead — so a
 * player served on demos.acme.com posts same-origin to
 * https://demos.acme.com/api/v3/events and reaches the same handler in the same
 * deployment, with the same mv_sid cookie scope. An absolute NEXT_PUBLIC_APP_URL
 * here would turn every event into a cross-origin request with a third-party
 * cookie, which is the one arrangement guaranteed to be dropped.
 */
const EVENTS_ENDPOINT = "/api/v3/events";

/** How often a partial batch is flushed while the page is open. */
const FLUSH_INTERVAL_MS = 10_000;

/**
 * Hard ceiling on the buffer between flushes.
 *
 * The queue flushes as soon as it reaches MAX_EVENTS_PER_BATCH, so reaching
 * this means flushes are failing to drain it — an offline viewer, most likely.
 * Dropping the newest events past this point bounds the memory a tab can hold
 * and keeps us from ever assembling a batch the ingest route would reject
 * wholesale for being over its cap.
 */
const MAX_QUEUE = MAX_EVENTS_PER_BATCH * 4;

interface QueuedEvent {
  name: PlayerEventName;
  positionSec?: number;
  at: number;
  meta?: Record<string, unknown>;
}

export interface TelemetryEmitter {
  /** Queue an event. Returns immediately; never throws. */
  emit(name: PlayerEventName, positionSec?: number, meta?: Record<string, unknown>): void;
  /** Send whatever is queued now. Safe to call during unload. */
  flush(): void;
}

export interface UseTelemetryOptions {
  demoId?: string;
  exportedVideoId?: string;
  /** False turns every method into a no-op — the flag-off path emits nothing. */
  enabled: boolean;
}

const NOOP_EMITTER: TelemetryEmitter = {
  emit: () => {},
  flush: () => {},
};

export function useTelemetry({
  demoId,
  exportedVideoId,
  enabled,
}: UseTelemetryOptions): TelemetryEmitter {
  const queueRef = useRef<QueuedEvent[]>([]);

  // An event attached to neither a demo nor an export is unattributable and the
  // ingest route drops it, so do not spend a request on it.
  const active = enabled && Boolean(demoId || exportedVideoId);

  const targetRef = useRef({ demoId, exportedVideoId, active });
  targetRef.current = { demoId, exportedVideoId, active };

  const flush = useCallback(() => {
    const target = targetRef.current;
    const queued = queueRef.current;
    if (!target.active || queued.length === 0) {
      return;
    }
    // Clear BEFORE sending. postBeacon hands the payload off synchronously, so
    // there is nothing to roll back on failure — and re-queueing a failed batch
    // would let an unreachable endpoint grow the queue without bound.
    queueRef.current = [];

    try {
      postBeacon(
        EVENTS_ENDPOINT,
        JSON.stringify({
          ...(target.demoId ? { demoId: target.demoId } : {}),
          ...(target.exportedVideoId ? { exportedVideoId: target.exportedVideoId } : {}),
          // `sessionId` is deliberately omitted: the ingest route reads mv_sid
          // from the cookie and ignores any client-supplied id, so sending one
          // would only imply it mattered.
          events: queued,
        })
      );
    } catch {
      // JSON.stringify can throw on a circular `meta`. Losing the batch is the
      // correct outcome; throwing out of a pagehide handler is not.
    }
  }, []);

  const emit = useCallback<TelemetryEmitter["emit"]>(
    (name, positionSec, meta) => {
      if (!targetRef.current.active) {
        return;
      }
      const queued = queueRef.current;
      if (queued.length >= MAX_QUEUE) {
        return;
      }
      queued.push({
        name,
        // The ingest route rejects a negative or non-finite position and would
        // drop the whole event with it, so leave the field off rather than send
        // a value we know is bad.
        ...(typeof positionSec === "number" && Number.isFinite(positionSec) && positionSec >= 0
          ? { positionSec }
          : {}),
        at: Date.now(),
        ...(meta ? { meta } : {}),
      });
      if (queued.length >= MAX_EVENTS_PER_BATCH) {
        flush();
      }
    },
    [flush]
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);

    // BOTH events, deliberately. `visibilitychange` is the only one iOS Safari
    // reliably fires when a tab is backgrounded or the phone is locked, and
    // `pagehide` is the only one that fires when a page is taken from the
    // back/forward cache. Firing twice is harmless — the second flush finds an
    // empty queue and returns.
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    const onPageHide = () => flush();

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, [active, flush]);

  return useMemo(() => (active ? { emit, flush } : NOOP_EMITTER), [active, emit, flush]);
}

// --- Milestones -------------------------------------------------------------

/**
 * Claim a one-per-tab marker, failing open.
 *
 * Backs the video_start dedupe. sessionStorage rather than localStorage is a
 * deliberate choice about what "per session" should mean here: mv_sid lasts a
 * year, and deduping against it would mean a viewer who comes back next month
 * never counts as a second start, quietly flattening the funnel month over
 * month. A tab is the unit that matches "the first play only" without erasing
 * genuine return visits.
 *
 * Blocked storage (private mode, a sandboxed iframe, a browser set to reject
 * site data) returns true: over-counting a start slightly is a much smaller
 * problem than losing the top of the funnel for everyone in that mode.
 */
function claimOnce(key: string): boolean {
  try {
    if (typeof sessionStorage === "undefined") {
      return true;
    }
    if (sessionStorage.getItem(key) !== null) {
      return false;
    }
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export interface UsePlaybackMilestonesOptions {
  telemetry: TelemetryEmitter;
  /** Identifies the video for the per-tab start dedupe. */
  targetKey: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
}

/**
 * Emit video_start and video_completed from observed playback state.
 *
 * video_start fires on the first moment the playhead is BOTH past zero AND not
 * paused, rather than on the `play` event. The difference matters as soon as PR
 * 3 lands: a hard gate configured to trigger at the start opens before the first
 * frame and the overlay host pauses immediately, so `play` fires for a video
 * that never actually plays. Counting that as a start would report a viewer who
 * bounced off the gate as a viewer who watched. Requiring real forward progress
 * cannot be fooled that way, and still catches the ordinary case, a scrub-then-
 * play, and a resume after the gate is satisfied.
 *
 * video_completed fires on `ended` OR at 95% coverage — see isCompleted(). Both
 * are latched for the life of the component, so a re-watch does not double-count
 * within one page view.
 */
export function usePlaybackMilestones({
  telemetry,
  targetKey,
  currentTime,
  duration,
  paused,
  ended,
}: UsePlaybackMilestonesOptions): void {
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current && !paused && currentTime > 0) {
      startedRef.current = true;
      if (claimOnce(`ovl:start:${targetKey}`)) {
        telemetry.emit("video_start", currentTime);
      }
    }

    if (!completedRef.current && isCompleted(currentTime, duration, ended)) {
      completedRef.current = true;
      telemetry.emit("video_completed", currentTime);
      // A completion is the end of the funnel and the viewer is quite likely to
      // close the tab next; do not sit on it for up to ten seconds.
      telemetry.flush();
    }
  }, [currentTime, duration, ended, paused, targetKey, telemetry]);
}
