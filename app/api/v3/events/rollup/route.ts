// POST /api/v3/events/rollup — roll one UTC day of PlayerEvent rows into
// PlayerEventDaily, then apply the retention windows.
//
// ============================================================================
// NOT A PUBLIC ROUTE, DESPITE THE /api/v3 PREFIX
// ============================================================================
// /api/v3 is otherwise the public, unauthenticated, viewer-facing namespace
// (locked decision 2). This is the second exception after /api/v3/leads/retry,
// and it sits here because it is the maintenance half of /api/v3/events and
// belongs beside it. IT IS GUARDED BY A SHARED SECRET, stated loudly rather than
// inferred from the neighbourhood.
//
// The secret arrives in a HEADER, never a query parameter: query strings land in
// access logs, proxy logs, browser history and Referer headers, and a secret
// that authorises row deletion has no business in any of them. It is compared
// with timingSafeEqual, the same primitive app/lib/crm/signature.ts uses.
//
// WITH OVERLAYS_ROLLUP_SECRET UNSET THE ROUTE IS CLOSED (503), not open. A
// maintenance endpoint that deletes rows must fail shut when nobody has
// configured who may call it.
//
// ============================================================================
// NO SCHEDULER IN THIS PR
// ============================================================================
// Deliberately, per the PR scope: this is an endpoint, not a cron service, and
// no queue is introduced (locked decision 10). Invoke it however the deployment
// already schedules things — Vercel Cron, Cloud Scheduler, a GitHub Action, or
// by hand:
//
//   curl -X POST https://<host>/api/v3/events/rollup \
//        -H "x-marvedge-rollup-secret: $OVERLAYS_ROLLUP_SECRET" \
//        -H "content-type: application/json" \
//        -d '{"date":"2026-09-01"}'
//
// `date` is optional and defaults to YESTERDAY in UTC — the last day that is
// certainly complete. Rolling up "today" is legal and useful for a spot check,
// it simply produces a partial count that the next run overwrites.
//
// IDEMPOTENT. Every write is an upsert keyed on the (demoId, name, date) unique
// constraint and SETS the count rather than incrementing it, so running the same
// day twice — a retried cron, a double-click, two overlapping schedulers — lands
// exactly the same numbers. That is also what makes re-running a day safe after
// a bug fix.

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { eventRetentionDays, leadRetentionDays, rollupSecret } from "@/app/lib/overlays/flags";
import {
  retentionCutoff,
  rollupPlayerEvents,
  utcDateKey,
  utcDayEnd,
  utcDayStart,
} from "@/app/lib/overlays/rollup";

// prisma over a node TCP client, and node:crypto — neither runs on the edge.
export const runtime = "nodejs";

// A day of events for a busy workspace is a large read followed by a bounded
// number of upserts. Same ceiling as app/api/jobs/create/route.ts.
export const maxDuration = 300;

/** Where the shared secret travels. A header, never a query param — see above. */
const SECRET_HEADER = "x-marvedge-rollup-secret";

/**
 * Rows read from PlayerEvent in one page. The rollup is a full-day scan, and
 * paging keeps a heavy day from being one enormous result set in memory.
 */
const READ_PAGE_SIZE = 5000;

/** Upserts issued per transaction. Bounded so one busy day is not one huge tx. */
const WRITE_CHUNK_SIZE = 100;

/**
 * Constant-time secret comparison.
 *
 * Length-checked first because timingSafeEqual throws on a length mismatch
 * rather than returning false. The length itself does leak through timing, which
 * is not worth defending: the secret is long and random, and an attacker who
 * learns it is 43 characters has learned nothing usable.
 */
function secretMatches(expected: string, provided: string | null): boolean {
  if (typeof provided !== "string") {
    return false;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Midnight UTC yesterday — the most recent day that is certainly complete. */
function defaultRollupDate(now: Date): Date {
  return new Date(utcDayStart(now).getTime() - 86400000);
}

/**
 * Parse a `YYYY-MM-DD` request date as a UTC day.
 *
 * Strict, and NOT `new Date(value)` on a free-form string: "2026-09-01" parses
 * as UTC but "2026/09/01" parses as LOCAL, so a lenient parser would silently
 * roll up the wrong day on any server not running in UTC.
 */
function parseRequestedDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || utcDateKey(parsed) !== value) {
    return null;
  }
  return parsed;
}

interface RollupSummary {
  date: string;
  eventsRead: number;
  rowsUpserted: number;
  skippedNoDemo: number;
  skippedUnknownName: number;
  skippedOutOfRange: number;
}

/**
 * Roll one UTC day into PlayerEventDaily.
 *
 * Reads raw events in id-ordered pages, aggregates with the PURE
 * rollupPlayerEvents(), and upserts the result. The aggregation itself is not in
 * this file on purpose — it is the part with the edge cases, and it is tested
 * against fixtures in app/lib/overlays/rollup.test.ts without a database.
 */
async function runRollup(date: Date): Promise<RollupSummary> {
  const dayStart = utcDayStart(date);
  const dayEnd = utcDayEnd(date);

  const events: { demoId: string | null; name: string; timestamp: Date }[] = [];
  let cursor: string | undefined;

  // Cursor-paged on the primary key rather than skip/take: an offset scan gets
  // quadratically slower across a large day, and a cursor is stable even though
  // this route may run while /api/v3/events is still writing.
  for (;;) {
    const page = await prisma.playerEvent.findMany({
      where: { timestamp: { gte: dayStart, lt: dayEnd } },
      select: { id: true, demoId: true, name: true, timestamp: true },
      orderBy: { id: "asc" },
      take: READ_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) {
      break;
    }
    for (const row of page) {
      events.push({ demoId: row.demoId, name: row.name, timestamp: row.timestamp });
    }
    if (page.length < READ_PAGE_SIZE) {
      break;
    }
    cursor = page[page.length - 1].id;
  }

  const { rows, skippedNoDemo, skippedUnknownName, skippedOutOfRange } = rollupPlayerEvents(
    events,
    dayStart
  );

  // `update: { count }` SETS rather than increments. That is what makes a re-run
  // idempotent: two runs of the same day land the same number, not double it.
  for (let i = 0; i < rows.length; i += WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + WRITE_CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.playerEventDaily.upsert({
          where: { demoId_name_date: { demoId: row.demoId, name: row.name, date: row.date } },
          create: { demoId: row.demoId, name: row.name, date: row.date, count: row.count },
          update: { count: row.count },
        })
      )
    );
  }

  return {
    date: utcDateKey(dayStart),
    eventsRead: events.length,
    rowsUpserted: rows.length,
    skippedNoDemo,
    skippedUnknownName,
    skippedOutOfRange,
  };
}

/**
 * Delete raw PlayerEvent rows older than `days`.
 *
 * ============================================================================
 * ORDERING: THIS RUNS *AFTER* THE ROLLUP, ALWAYS. NEVER BEFORE.
 * ============================================================================
 * PlayerEventDaily is the ONLY durable record of a funnel step — the analytics
 * page never reads raw events (locked decision 9), and PlayerEventDaily has no
 * foreign key so it survives its demo. Deleting a raw event that has not been
 * rolled up yet therefore does not lose a row, it loses a NUMBER, permanently
 * and silently: nothing anywhere would report that the count was ever different.
 *
 * The retention window (90 days) is nowhere near the rollup window (yesterday),
 * so in practice these two never touch the same rows. The ordering is enforced
 * anyway, in one sequential handler with no concurrency, because "the windows do
 * not currently overlap" is a property of two independently configurable env
 * vars — one edit to OVERLAYS_EVENT_RETENTION_DAYS is all it takes to make them
 * overlap, and the failure would be undetectable after the fact.
 */
async function deletePlayerEventsOlderThan(days: number, now: Date): Promise<number> {
  const cutoff = retentionCutoff(now, days);
  const { count } = await prisma.playerEvent.deleteMany({ where: { timestamp: { lt: cutoff } } });
  return count;
}

/**
 * Delete Lead rows older than `days`, and with them their LeadDelivery rows.
 *
 * The cascade is the schema's (Lead -> LeadDelivery is onDelete: Cascade), so
 * this cannot leave a delivery record pointing at PII that no longer exists.
 *
 * NO PII IN THE RETURN VALUE OR ANYWHERE NEAR IT. deleteMany reports a count and
 * nothing else, which is the entire reason it is used here rather than a
 * findMany-then-delete loop that would put names and email addresses in this
 * process's memory for no reason.
 */
async function deleteLeadsOlderThan(days: number, now: Date): Promise<number> {
  const cutoff = retentionCutoff(now, days);
  const { count } = await prisma.lead.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

export async function POST(request: NextRequest) {
  const secret = rollupSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Rollup endpoint is not configured (OVERLAYS_ROLLUP_SECRET)." },
      { status: 503 }
    );
  }

  if (!secretMatches(secret, request.headers.get(SECRET_HEADER))) {
    // 401 with no detail. A caller who got the secret wrong and a caller probing
    // for the endpoint get the same four words.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A body is optional; sending none rolls up yesterday.
  let body: unknown = null;
  try {
    const raw = await request.text();
    body = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const now = new Date();
  const requestedDate =
    body && typeof body === "object" && "date" in body
      ? parseRequestedDate((body as { date: unknown }).date)
      : defaultRollupDate(now);

  if (!requestedDate) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD (UTC)." }, { status: 400 });
  }

  // `skipRetention` exists for the backfill case: re-rolling last month's days
  // one at a time should not run the sweep thirty times.
  const skipRetention =
    body !== null &&
    typeof body === "object" &&
    (body as { skipRetention?: unknown }).skipRetention === true;

  try {
    const rollup = await runRollup(requestedDate);

    // ORDER IS LOAD-BEARING — see deletePlayerEventsOlderThan above. The rollup
    // has committed by this line, and only then does anything get deleted.
    // Written as sequential statements rather than a Promise.all or an object
    // literal of awaits so the ordering is a property of the code someone reads,
    // not of evaluation-order trivia.
    let retention: {
      eventRetentionDays: number;
      leadRetentionDays: number;
      playerEventsDeleted: number;
      leadsDeleted: number;
    } | null = null;

    if (!skipRetention) {
      const eventDays = eventRetentionDays();
      const leadDays = leadRetentionDays();
      const playerEventsDeleted = await deletePlayerEventsOlderThan(eventDays, now);
      const leadsDeleted = await deleteLeadsOlderThan(leadDays, now);
      retention = {
        eventRetentionDays: eventDays,
        leadRetentionDays: leadDays,
        playerEventsDeleted,
        leadsDeleted,
      };
    }

    // Counters and a date. No demo ids, no event payloads, and — because
    // retention touches the Lead table — no lead field of any kind.
    console.log(
      `[ovl-rollup] date=${rollup.date} events=${rollup.eventsRead} rows=${rollup.rowsUpserted} ` +
        `skipped(no-demo=${rollup.skippedNoDemo},unknown=${rollup.skippedUnknownName},range=${rollup.skippedOutOfRange}) ` +
        `deleted(events=${retention?.playerEventsDeleted ?? "skipped"},leads=${retention?.leadsDeleted ?? "skipped"})`
    );

    return NextResponse.json({ success: true, rollup, retention });
  } catch (error) {
    console.error("[ovl-rollup] failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Rollup failed." }, { status: 500 });
  }
}
