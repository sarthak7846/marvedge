// Delivery orchestration: the database half of CRM fan-out.
//
// NO QUEUE (locked decision 10). A LeadDelivery row is the queue, `after()` is
// the worker, and POST /api/v3/leads/retry is the redrive. Standing up BullMQ to
// move a few hundred webhooks a day is not worth operating, and app/lib/queue.ts
// already contains one dead queue as evidence of what that costs.
//
// The shape follows dispatchVideoJob() in app/api/jobs/create/route.ts: the
// route answers first, `after()` runs this, and NOTHING in here may throw back
// into the request — the lead is already stored and the viewer already saw a
// success. A CRM being down is not the viewer's problem.
//
// IDEMPOTENCE, precisely:
//   · One LeadDelivery row per (leadId, connectionId), enforced by a unique
//     index, so a re-run cannot create a second row for the same pair.
//   · A DELIVERED row is never attempted again (shouldAttempt in ./state.ts).
//   Together: calling deliverLead() twice, or hitting the retry endpoint twice,
//   cannot deliver the same lead to the same CRM twice.
//
// PII: a lead's name and address are SENT here, which is the point, and are
// never LOGGED here. Every log line is a literal plus ids. Errors go through
// safeError(), which strips addresses out of provider responses before they
// reach LeadDelivery.lastError — see ./state.ts.

import { prisma } from "../prisma";
import { isOverlaysAllowed } from "../overlays/access";
import { isOverlaysCrmEnabled } from "../overlays/flags";
import { resolveConnection } from "./connection";
import { runDelivery } from "./index";
import { normalizeLead } from "./normalize";
import { nextDeliveryState, safeError, shouldAttempt } from "./state";
import type { NormalizedContact } from "./normalize";
import type { DeliveryStatus } from "./state";

/** Counts returned for logging and for the retry endpoint's response. */
export interface DeliverySummary {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
}

const EMPTY_SUMMARY: DeliverySummary = { attempted: 0, delivered: 0, failed: 0, skipped: 0 };

/**
 * Deliver one lead to every enabled connection its demo's owner has.
 *
 * NEVER REJECTS. It is called from `after()`, where a rejected promise is an
 * unhandled rejection with nobody to catch it and, on some runtimes, a crashed
 * invocation — for work whose failure the viewer has already been told nothing
 * about. A database outage here is logged as a code and swallowed; the leads are
 * already committed and stay deliverable through the retry endpoint.
 *
 * retryFailedDeliveries() below deliberately does NOT do this: it is awaited by
 * a route that should answer 500 if the database is down.
 */
export async function deliverLead(leadId: string): Promise<DeliverySummary> {
  try {
    return await runLeadDelivery(leadId);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? String(error.code) : "none";
    console.error(`[ovl-crm] delivery run failed lead=${leadId} code=${code}`);
    return EMPTY_SUMMARY;
  }
}

async function runLeadDelivery(leadId: string): Promise<DeliverySummary> {
  // The flag is checked HERE rather than only at the call site, so every future
  // caller (the retry endpoint, a cron, a test button) inherits the same gate.
  // With OVERLAYS_CRM_ENABLED off, leads are still captured and stored — no
  // delivery rows are created at all, so turning the flag on later starts from a
  // clean ledger rather than a backlog of PENDING rows nobody expected.
  if (!isOverlaysCrmEnabled()) {
    return EMPTY_SUMMARY;
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      companySize: true,
      referrer: true,
      consentText: true,
      consentAt: true,
      createdAt: true,
      demo: {
        select: {
          id: true,
          title: true,
          publicLink: true,
          userId: true,
          user: { select: { plan: true } },
        },
      },
    },
  });

  if (!lead) {
    return EMPTY_SUMMARY;
  }

  // Decision 14, re-resolved server-side. An owner who downgrades stops
  // forwarding to their CRM at the same moment they stop collecting.
  if (!isOverlaysAllowed(lead.demo.user?.plan)) {
    return EMPTY_SUMMARY;
  }

  const connections = await prisma.crmConnection.findMany({
    where: { userId: lead.demo.userId, enabled: true },
    select: { id: true, provider: true, credentials: true, fieldMap: true },
  });

  if (connections.length === 0) {
    return EMPTY_SUMMARY;
  }

  const contact = normalizeLead({
    email: lead.email,
    name: lead.name,
    companySize: lead.companySize,
    referrer: lead.referrer,
    createdAt: lead.createdAt,
    demoId: lead.demo.id,
    demoTitle: lead.demo.title,
    demoUrl: shareUrlFor(lead.demo.publicLink),
    consentText: lead.consentText,
    consentAt: lead.consentAt,
  });

  const summary = { ...EMPTY_SUMMARY };

  for (const connection of connections) {
    // Upsert so a re-submission (the Lead row is itself upserted on
    // @@unique([demoId, email])) reuses the existing ledger row. `update: {}`
    // deliberately changes nothing: if that row already reads DELIVERED, the
    // attempt below is skipped and the CRM is not written to twice.
    const delivery = await prisma.leadDelivery.upsert({
      where: { leadId_connectionId: { leadId: lead.id, connectionId: connection.id } },
      create: { leadId: lead.id, connectionId: connection.id, status: "PENDING" },
      update: {},
      select: { id: true, status: true, attempts: true, lastError: true, deliveredAt: true },
    });

    if (!shouldAttempt({ connectionEnabled: true, status: delivery.status as DeliveryStatus })) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    const result = await attemptOne({
      connection,
      deliveryId: delivery.id,
      current: {
        status: delivery.status as DeliveryStatus,
        attempts: delivery.attempts,
        lastError: delivery.lastError,
        deliveredAt: delivery.deliveredAt,
      },
      leadId: lead.id,
      contact,
    });

    if (result === "DELIVERED") {
      summary.delivered += 1;
    } else {
      summary.failed += 1;
    }
  }

  console.log(
    `[ovl-crm] delivered lead=${lead.id} attempted=${summary.attempted} ok=${summary.delivered} failed=${summary.failed} skipped=${summary.skipped}`
  );
  return summary;
}

/**
 * Retry FAILED deliveries.
 *
 * `userId` scopes the sweep to one owner's connections, which is what the
 * owner-facing endpoint passes. `connectionId` narrows it further for the "retry
 * this connection" button in settings.
 *
 * DELIVERED rows are never selected, so this is safe to call repeatedly — by a
 * human clicking twice or by a cron on a schedule.
 */
export async function retryFailedDeliveries(options: {
  userId: string;
  connectionId?: string;
  limit?: number;
}): Promise<DeliverySummary> {
  if (!isOverlaysCrmEnabled()) {
    return EMPTY_SUMMARY;
  }

  const failed = await prisma.leadDelivery.findMany({
    where: {
      status: "FAILED",
      ...(options.connectionId ? { connectionId: options.connectionId } : {}),
      connection: { userId: options.userId, enabled: true },
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(options.limit ?? 50, 1), 200),
    select: {
      id: true,
      leadId: true,
      status: true,
      attempts: true,
      lastError: true,
      deliveredAt: true,
      connection: { select: { id: true, provider: true, credentials: true, fieldMap: true } },
      lead: {
        select: {
          id: true,
          name: true,
          email: true,
          companySize: true,
          referrer: true,
          consentText: true,
          consentAt: true,
          createdAt: true,
          demo: {
            select: { id: true, title: true, publicLink: true, user: { select: { plan: true } } },
          },
        },
      },
    },
  });

  const summary = { ...EMPTY_SUMMARY };

  for (const row of failed) {
    if (!isOverlaysAllowed(row.lead.demo.user?.plan)) {
      summary.skipped += 1;
      continue;
    }

    const contact = normalizeLead({
      email: row.lead.email,
      name: row.lead.name,
      companySize: row.lead.companySize,
      referrer: row.lead.referrer,
      createdAt: row.lead.createdAt,
      demoId: row.lead.demo.id,
      demoTitle: row.lead.demo.title,
      demoUrl: shareUrlFor(row.lead.demo.publicLink),
      consentText: row.lead.consentText,
      consentAt: row.lead.consentAt,
    });

    summary.attempted += 1;
    const result = await attemptOne({
      connection: row.connection,
      deliveryId: row.id,
      current: {
        status: row.status as DeliveryStatus,
        attempts: row.attempts,
        lastError: row.lastError,
        deliveredAt: row.deliveredAt,
      },
      leadId: row.leadId,
      contact,
    });

    if (result === "DELIVERED") {
      summary.delivered += 1;
    } else {
      summary.failed += 1;
    }
  }

  console.log(
    `[ovl-crm] retry user=${options.userId} attempted=${summary.attempted} ok=${summary.delivered} failed=${summary.failed} skipped=${summary.skipped}`
  );
  return summary;
}

/**
 * One connection, one delivery row: resolve, attempt, record. Never throws — a
 * database failure while recording the outcome must not abort the loop over the
 * other connections.
 */
async function attemptOne(input: {
  connection: { id: string; provider: string; credentials: unknown; fieldMap: unknown };
  deliveryId: string;
  current: {
    status: DeliveryStatus;
    attempts: number;
    lastError: string | null;
    deliveredAt: Date | null;
  };
  leadId: string;
  contact: NormalizedContact;
}): Promise<DeliveryStatus> {
  const resolved = resolveConnection(input.connection);

  // A connection whose credentials will not decrypt or will not validate is a
  // configuration problem the owner has to fix, so it is recorded as a
  // non-retryable failure with a message that says what to do — not retried, and
  // not left silently PENDING.
  const run = resolved
    ? await runDelivery(resolved, input.leadId, input.contact)
    : {
        outcome: {
          ok: false as const,
          retryable: false,
          error:
            "Stored credentials could not be read. Re-enter this connection's credentials in Settings.",
        },
        attempts: 1,
      };

  const now = new Date();
  const next = nextDeliveryState(input.current, run.outcome, now, run.attempts);

  try {
    await prisma.leadDelivery.update({
      where: { id: input.deliveryId },
      data: {
        status: next.status,
        attempts: next.attempts,
        lastError: next.lastError,
        deliveredAt: next.deliveredAt,
      },
    });

    // The connection carries the LAST outcome so the settings page can show
    // "working" / "broken" without aggregating the ledger on every render.
    await prisma.crmConnection.update({
      where: { id: input.connection.id },
      data:
        next.status === "DELIVERED"
          ? { lastOkAt: now, lastError: null }
          : { lastError: next.lastError },
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? String(error.code) : "none";
    console.error(`[ovl-crm] failed to record delivery=${input.deliveryId} code=${code}`);
  }

  if (!run.outcome.ok) {
    // The error, already redacted by safeError(). Never the lead, never the
    // credential.
    console.warn(
      `[ovl-crm] delivery failed delivery=${input.deliveryId} connection=${input.connection.id}: ${safeError(run.outcome.error)}`
    );
  }

  return next.status;
}

/**
 * Absolute share URL for a demo, or null.
 *
 * Uses NEXT_PUBLIC_APP_URL, matching app/api/demos/[id]/share/route.ts. It is
 * deliberately the MARVEDGE origin rather than a customer hub domain: this URL
 * is written into a CRM record for the owner's own reference, and the owner's
 * canonical link is the one that works regardless of which domain the viewer
 * happened to arrive on.
 */
function shareUrlFor(publicLink: string | null): string | null {
  if (!publicLink) {
    return null;
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) {
    return null;
  }
  try {
    return new URL(`/share/${publicLink}`, origin).toString();
  } catch {
    return null;
  }
}
