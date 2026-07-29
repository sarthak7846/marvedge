import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  deleteCustomDomain,
  getCustomDomainStatus,
  listCustomHostnames,
} from "@/app/lib/cloudflare";
import { isBdhEnabled } from "@/app/lib/bdh/flags";

/**
 * Asynchronous custom-domain maintenance (PRD §4.3 / §4.4).
 *
 * PRD §4.3 requires an asynchronous backend process that verifies ownership and
 * requests SSL certificates rather than relying on the user sitting on the
 * settings page hitting refresh. §4.4 additionally requires that a hostname
 * belonging to a deleted account is removed from the zone, since it would
 * otherwise keep routing to us.
 *
 * This route covers both and is driven by Vercel Cron (see vercel.json):
 *
 *   1. Poll every hub whose SSL is not yet active and persist the latest status,
 *      so a domain flips to "active" on its own once DNS propagates.
 *   2. Sweep the zone for hostnames with no hub behind them any more.
 *
 * The sweep is REPORT-ONLY by default. Deleting hostnames from a zone we may
 * share with other things is destructive and irreversible, so actually removing
 * orphans requires opting in with BDH_RECONCILE_DELETE=true. Until then it logs
 * loudly, which is enough to act on.
 */

// Bounded so one run cannot exceed the serverless execution limit.
const MAX_DOMAINS_PER_RUN = 25;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Without a configured secret, only allow this outside production so local
  // runs work but a public deployment never exposes an open maintenance route.
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBdhEnabled()) {
    return NextResponse.json({ success: true, skipped: "BDH disabled" });
  }

  const startedAt = Date.now();
  const checked: Array<{ hostname: string; sslStatus: string | null }> = [];
  const errors: string[] = [];

  try {
    // 1. Poll hubs whose certificate has not been issued yet.
    const pending = await prisma.hubSettings.findMany({
      where: {
        customDomain: { not: null },
        cloudflareId: { not: null },
        NOT: { sslStatus: "active" },
      },
      select: { id: true, customDomain: true, cloudflareId: true, sslStatus: true },
      orderBy: { updatedAt: "asc" },
      take: MAX_DOMAINS_PER_RUN,
    });

    for (const hub of pending) {
      const status = await getCustomDomainStatus(hub.cloudflareId!, hub.customDomain!);

      if (!status.success) {
        errors.push(`${hub.customDomain}: ${status.error}`);
        continue;
      }

      await prisma.hubSettings.update({
        where: { id: hub.id },
        data: {
          sslStatus: status.sslStatus || hub.sslStatus,
          dnsVerification: status.dnsVerification
            ? JSON.parse(JSON.stringify(status.dnsVerification))
            : undefined,
        },
      });

      checked.push({ hostname: hub.customDomain!, sslStatus: status.sslStatus ?? null });
    }

    // 2. Reconcile the zone against our records to catch orphaned hostnames.
    const orphans: string[] = [];
    const deleted: string[] = [];
    const zone = await listCustomHostnames();

    if (!zone.success) {
      errors.push(`zone listing: ${zone.error}`);
    } else if (zone.hostnames.length > 0) {
      const known = await prisma.hubSettings.findMany({
        where: { customDomain: { not: null } },
        select: { customDomain: true },
      });
      const knownSet = new Set(known.map((row) => row.customDomain));

      for (const entry of zone.hostnames) {
        if (knownSet.has(entry.hostname)) {
          continue;
        }

        orphans.push(entry.hostname);

        if (process.env.BDH_RECONCILE_DELETE === "true") {
          const removal = await deleteCustomDomain(entry.id);
          if (removal.success) {
            deleted.push(entry.hostname);
          } else {
            errors.push(`orphan ${entry.hostname}: ${removal.error}`);
          }
        }
      }

      if (orphans.length > 0 && process.env.BDH_RECONCILE_DELETE !== "true") {
        console.warn(
          `[hub-domains] ${orphans.length} Cloudflare hostname(s) have no hub behind them and are still routing: ${orphans.join(", ")}. Set BDH_RECONCILE_DELETE=true to remove them automatically.`
        );
      }
    }

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      polled: checked.length,
      activated: checked.filter((c) => c.sslStatus === "active").length,
      orphans,
      deleted,
      errors,
    });
  } catch (error) {
    console.error("[hub-domains] cron failed:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message, errors },
      { status: 500 }
    );
  }
}
