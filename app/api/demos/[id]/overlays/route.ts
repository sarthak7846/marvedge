// GET/PUT /api/demos/[id]/overlays — owner-scoped overlay config CRUD.
//
// Owner-facing config stays under /api/demos/[id]/... deliberately. Only the
// public, unauthenticated, viewer-facing endpoints live under /api/v3 — mixing
// a session-authenticated admin write into the versioned public namespace would
// make that namespace's "no session, safe to embed" contract untrue.
//
// Shape copied from app/api/demos/[id]/ctas/route.ts: resolveOwnedDemo() scopes
// every query through `userId`, so "no such demo" and "not your demo" collapse
// into one 404 and the endpoint cannot be used to enumerate other people's ids.

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { isOverlaysAllowed } from "@/app/lib/overlays/access";
import { BRANCH_SLOTS } from "@/app/lib/overlays/branch";
import { overlayConfigFromRow, sanitizeOverlayConfig } from "@/app/lib/overlays/config";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";
import type { BranchingConfig } from "@/app/lib/overlays/types";

export const runtime = "nodejs";

/**
 * Resolve a demo the caller owns, along with the OWNER'S REAL PLAN read from the
 * database in the same query. The plan is never taken from the client, and never
 * from a session claim that could be stale — decision 14 says re-resolve
 * server-side, and this is where that happens.
 */
async function resolveOwnedDemo(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const demo = await prisma.demo.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: { id: true, user: { select: { plan: true } } },
  });

  if (!demo) {
    return {
      error: NextResponse.json({ error: "Demo not found" }, { status: 404 }),
    };
  }

  return { demo, plan: demo.user.plan };
}

/**
 * Mirror the two branch cards into `Cta` rows.
 *
 * DECISION 6: A BRANCH CARD IS A CTA. It has to be a real row, not a notion —
 * POST /api/cta-clicks has always required a `ctaId` and `CtaClick.ctaId` is a
 * foreign key, so without these rows a card click could not be recorded at all
 * and the CTA numbers on app/(signed)/analytics/page.tsx would not move for the
 * one overlay whose entire job is getting clicked.
 *
 * The row is the ANALYTICS ANCHOR, not a second source of truth: the overlay
 * renders from the config, and `label`/`url` are rewritten from it here on every
 * save so `CtaClick.label` reads as whatever the card actually said. `url` is the
 * root-relative share path for a demo target, which resolves on marvedge.com and
 * on a customer hub alike; the href the viewer actually follows is rebuilt per
 * request by resolveBranchHref() and is never read from here.
 *
 * ROWS ARE NEVER DELETED, only rewritten — not when branching is switched off,
 * and not when a target changes. Deleting one would null out the `ctaId` on every
 * historical `CtaClick` that pointed at it (onDelete: SetNull) and detach clicks
 * an owner has already been shown. Both share routes and the owner-facing CTA
 * list filter these placements out, so a stale row is invisible until branching
 * is turned back on.
 *
 * Failure is swallowed: losing the mirror costs analytics on the cards, and that
 * is not worth failing the owner's save over.
 */
async function syncBranchCtas(demoId: string, branching: BranchingConfig): Promise<void> {
  try {
    const existing = await prisma.cta.findMany({
      where: { demoId, placement: { in: BRANCH_SLOTS.map((slot) => slot.placement) } },
      select: { id: true, placement: true },
    });

    await Promise.all(
      BRANCH_SLOTS.map(({ key, placement }, index) => {
        const card = branching[key];
        const label = card.label.trim() || placement;
        const url =
          card.target.kind === "demo"
            ? `/share/${encodeURIComponent(card.target.demoId)}`
            : card.target.href;
        const row = existing.find((cta) => cta.placement === placement);
        return row
          ? prisma.cta.update({ where: { id: row.id }, data: { label, url } })
          : prisma.cta.create({ data: { demoId, label, url, placement, order: index } });
      })
    );
  } catch (error) {
    // Never the card's contents — this is an owner string, but the precedent in
    // app/api/views/route.ts is to log a literal and nothing derived from input.
    console.error("Failed to sync branch CTA rows", error instanceof Error ? error.name : "error");
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isOverlaysEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const owned = await resolveOwnedDemo(id);
  if ("error" in owned) {
    return owned.error;
  }

  const row = await prisma.videoOverlayConfig.findUnique({ where: { demoId: id } });

  // A demo with no row reads as the defaults rather than 404ing, so the editor
  // panel has something to render before anything has ever been saved.
  return NextResponse.json({
    success: true,
    config: overlayConfigFromRow(row),
    leadGateAllowed: isOverlaysAllowed(owned.plan),
  });
}

/**
 * Intentionally thin. The three sections are `unknown` here because
 * sanitizeOverlayConfig() is the real schema — it is total, it rebuilds every
 * field from a whitelist, and it is the SAME function the editor previews with,
 * so a second zod description of the same shape would just be a copy to drift
 * against. Zod's job at this boundary is to reject a body that is not an object
 * at all with a clear 400.
 */
const putOverlaysSchema = z.object({
  enabled: z.boolean().optional(),
  leadGate: z.unknown().optional(),
  branching: z.unknown().optional(),
  scheduling: z.unknown().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isOverlaysEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const owned = await resolveOwnedDemo(id);
  if ("error" in owned) {
    return owned.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = putOverlaysSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Re-sanitised SERVER-SIDE before it is written. The editor runs the same
  // function for its preview, but that copy is a convenience — this is the
  // enforcement point, and it must never trust the client's version of it.
  const config = sanitizeOverlayConfig(parsed.data);

  // The lead gate is PRO/ENTERPRISE (decision 14). Branching and scheduling are
  // free on every plan and are not checked here. Answering 403 rather than
  // silently saving the gate as disabled: a switch that turns itself back off
  // with no explanation is worse than a refusal that says why.
  if (config.leadGate.enabled && !isOverlaysAllowed(owned.plan)) {
    return NextResponse.json(
      { error: "The lead capture gate is available on the Pro and Enterprise plans." },
      { status: 403 }
    );
  }

  // Ownership was established above, in this request, so upserting on the unique
  // demoId is already scoped — there is no second row this could reach.
  const row = await prisma.videoOverlayConfig.upsert({
    where: { demoId: id },
    create: {
      demoId: id,
      enabled: config.enabled,
      leadGate: config.leadGate as unknown as Prisma.InputJsonValue,
      branching: config.branching as unknown as Prisma.InputJsonValue,
      scheduling: config.scheduling as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: config.enabled,
      leadGate: config.leadGate as unknown as Prisma.InputJsonValue,
      branching: config.branching as unknown as Prisma.InputJsonValue,
      scheduling: config.scheduling as unknown as Prisma.InputJsonValue,
    },
  });

  // Awaited rather than fired into after(): the panel re-reads the config right
  // after this responds, and an owner who saves and immediately opens the share
  // link should not get cards whose clicks are not being counted yet.
  await syncBranchCtas(id, config.branching);

  // Echo the stored row back through the same reader the public page uses, so
  // the editor sees exactly what a viewer will get rather than what it sent.
  return NextResponse.json({ success: true, config: overlayConfigFromRow(row) });
}
