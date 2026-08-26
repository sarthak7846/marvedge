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
import { overlayConfigFromRow, sanitizeOverlayConfig } from "@/app/lib/overlays/config";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";

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

  // Echo the stored row back through the same reader the public page uses, so
  // the editor sees exactly what a viewer will get rather than what it sent.
  return NextResponse.json({ success: true, config: overlayConfigFromRow(row) });
}
