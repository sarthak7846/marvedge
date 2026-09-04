// The delivery state machine, and the redaction that keeps PII out of it.
//
// PURE, so the rules that decide whether a lead is "delivered" can be tested
// without a database or a network. There is no queue behind this (locked
// decision 10 — no BullMQ): a LeadDelivery row IS the queue, and these functions
// are the only thing that moves it.
//
//   PENDING   — the row exists, no attempt has finished yet.
//   DELIVERED — a provider accepted it. TERMINAL. Never re-attempted, which is
//               what makes POST /api/v3/leads/retry idempotent: calling it twice
//               cannot deliver a lead twice.
//   FAILED    — the last attempt did not succeed. Retryable by hand or by cron.
//
// There is no DEAD state and no attempt ceiling in the data model. A row that
// has failed forty times is still FAILED with `attempts: 40` and a readable
// error, which the settings UI can show — and an owner who fixes their token
// wants that row to go through, not to have been silently retired.

import type { DeliveryOutcome } from "./types";

export const DELIVERY_STATUSES = ["PENDING", "DELIVERED", "FAILED"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The mutable part of a LeadDelivery row. Not the Prisma type — this is pure. */
export interface DeliveryState {
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  deliveredAt: Date | null;
}

/** Bound on what goes into LeadDelivery.lastError. Long enough to be useful. */
export const MAX_ERROR_LENGTH = 300;

/**
 * Strip anything that looks like an email address, then truncate.
 *
 * NOT DECORATION. Provider error bodies quote the payload back at you —
 * HubSpot's 409 says which contact already exists, and its validation errors
 * name the offending property value. That payload is a viewer's name and email
 * address, and `lastError` is rendered in the owner's settings page and read by
 * whoever is debugging. app/api/v3/leads/route.ts holds the line that no lead
 * field is ever logged or stored outside the Lead row; this is the same line,
 * held at the other end of the feature.
 *
 * The address is replaced with a marker rather than deleted, so an error that
 * was ABOUT an address still reads as one ("[redacted] is invalid").
 */
export function safeError(value: unknown): string {
  const raw =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "Unknown delivery error";
  const redacted = raw.replace(/[^\s"'<>(),;:]+@[^\s"'<>(),;:]+\.[A-Za-z]{2,}/g, "[redacted]");
  const collapsed = redacted.replace(/\s+/g, " ").trim();
  const bounded = collapsed.length > 0 ? collapsed : "Unknown delivery error";
  return bounded.length > MAX_ERROR_LENGTH ? `${bounded.slice(0, MAX_ERROR_LENGTH - 1)}…` : bounded;
}

/**
 * Whether a delivery row should be attempted at all.
 *
 * DELIVERED is terminal, and a disabled connection is skipped WITHOUT touching
 * the row — an owner who switches a CRM off while a retry sweep is running gets
 * their leads left alone, not marked failed against a connection they turned
 * off on purpose.
 */
export function shouldAttempt(input: {
  connectionEnabled: boolean;
  status: DeliveryStatus;
}): boolean {
  return input.connectionEnabled && input.status !== "DELIVERED";
}

/**
 * Fold one attempt's outcome into the row.
 *
 * `attemptsMade` is how many HTTP requests the attempt actually consumed —
 * runDelivery() may burn two or three on a 503 before giving up, and a row that
 * says `attempts: 1` after three requests would misreport how hard we tried.
 * It is ADDED, never assigned, so a retry accumulates rather than resetting.
 *
 * A failure leaves `deliveredAt` untouched. It is null on a row that has never
 * succeeded, and a row that has succeeded is never attempted again, so it can
 * only ever mean "the moment this lead reached this CRM".
 */
export function nextDeliveryState(
  current: DeliveryState,
  outcome: DeliveryOutcome,
  now: Date,
  attemptsMade = 1
): DeliveryState {
  const attempts = current.attempts + Math.max(1, attemptsMade);

  if (outcome.ok) {
    return {
      status: "DELIVERED",
      attempts,
      lastError: null,
      deliveredAt: now,
    };
  }

  return {
    status: "FAILED",
    attempts,
    lastError: safeError(outcome.error),
    deliveredAt: current.deliveredAt,
  };
}

/**
 * Backoff between attempts INSIDE a single delivery, in milliseconds.
 *
 * SHORT AND BOUNDED because this runs in Next's `after()` on a serverless
 * invocation, not in a worker: the request has already been answered, but the
 * function is still billed and still has a wall-clock ceiling (`maxDuration`).
 * Two retries roughly two and a half seconds apart absorbs a rate-limit blip or
 * a single bad gateway. Anything longer is what the FAILED row and the retry
 * endpoint are for.
 */
export const RETRY_DELAYS_MS: readonly number[] = [500, 2000];

/** Total attempts one runDelivery() may make: the first, plus one per delay. */
export const MAX_ATTEMPTS_PER_RUN = RETRY_DELAYS_MS.length + 1;
