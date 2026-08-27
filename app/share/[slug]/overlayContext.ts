// Server-side resolution of everything the overlay layer needs, for all three
// share routes.
//
// It lives HERE rather than in app/lib/overlays/ on purpose. That library is
// isomorphic — one code path serves a React component, a route handler and the
// editor — and this module reads `next/headers` and talks to Prisma, neither of
// which belongs on a client. Environment-specific code goes in the component or
// the route, so this is colocated with the share route the other two already
// import ShareVideoPageClient from.
//
// RETURNS undefined WHEN THE FLAG IS OFF, before touching the database. With
// OVERLAYS_ENABLED unset this costs one boolean and the three share pages behave
// exactly as they did on master — no extra query, no cookie read, nothing that
// could opt a page out of a cache it is in today.

import { cookies } from "next/headers";

import { prisma } from "@/app/lib/prisma";
import { isOverlaysAllowed } from "@/app/lib/overlays/access";
import { overlayConfigFromRow } from "@/app/lib/overlays/config";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";
import { SID_COOKIE } from "@/app/lib/overlays/session";
import type { OverlayConfig } from "@/app/lib/overlays/types";

export interface ShareOverlayContext {
  /** Already sanitised, already plan-checked. Safe to serialize to the client. */
  overlays: OverlayConfig;
  /**
   * Substituted for `{owner}` in the consent sentence: the demo owner's name,
   * falling back to the hub title on a customer domain, then to a readable
   * phrase inside renderConsentText().
   */
  ownerName: string | null;
  /**
   * This browser has already given this demo a lead, so the gate must not mount
   * at all. Resolved at render precisely so there is nothing to flash.
   */
  leadCaptured: boolean;
}

/**
 * Has the browser behind `sessionId` already submitted a lead for this demo?
 *
 * KEYED ON (demoId, sessionId), AND THAT IS A DECISION, not an oversight. The
 * same browser watching a DIFFERENT demo from the same owner IS gated again, and
 * a second Lead row is written for that demo.
 *
 * Why: consent is given per demo. Lead.consentText records the sentence shown on
 * one demo's player, and Lead itself is unique per (demo, email) — suppressing
 * the gate across an owner's whole library would mean recording a viewer as
 * having consented on a page they never saw, and would leave the second demo's
 * owner-facing lead list mysteriously empty. Re-asking someone who is watching
 * their second video from the same company is a small annoyance; inventing a
 * consent record is not a small problem.
 *
 * mv_sid is an analytics id and nothing here authorises on it. The worst a
 * forged cookie achieves is skipping a gate its owner could skip anyway by
 * reading the media URL out of the page source.
 */
async function hasSubmittedLead(demoId: string): Promise<boolean> {
  const sessionId = (await cookies()).get(SID_COOKIE)?.value;
  if (!sessionId) {
    return false;
  }
  try {
    const existing = await prisma.lead.findFirst({
      where: { demoId, sessionId },
      select: { id: true },
    });
    return existing !== null;
  } catch {
    // A failed lookup must not 500 a public share page. Falling back to "not
    // captured" re-asks a returning viewer, which is the recoverable direction:
    // the upsert on (demoId, email) means they still do not get a duplicate row.
    return false;
  }
}

/**
 * Resolve the overlay config for a demo, or undefined when there is nothing to
 * render.
 *
 * @param hubTitle the customer hub's title, used as the second `{owner}`
 *   candidate on the branded route.
 */
export async function resolveShareOverlays(
  demoId: string | undefined,
  { hubTitle }: { hubTitle?: string | null } = {}
): Promise<ShareOverlayContext | undefined> {
  if (!demoId || !isOverlaysEnabled()) {
    return undefined;
  }

  const demo = await prisma.demo.findUnique({
    where: { id: demoId },
    select: { overlayConfig: true, user: { select: { name: true, plan: true } } },
  });
  if (!demo) {
    return undefined;
  }

  const config = overlayConfigFromRow(demo.overlayConfig);

  // Decision 14, re-resolved server-side from User.plan on every render rather
  // than trusted from the stored row. The PUT route refuses to ENABLE the gate
  // on a free plan, but an owner who enabled it on PRO and then downgraded still
  // has `enabled: true` sitting in the database — and a public page is not the
  // place to discover that. POST /api/v3/leads repeats the same check, so a gate
  // that slipped through here still could not store anything.
  const leadGateAllowed = isOverlaysAllowed(demo.user?.plan);
  const overlays: OverlayConfig = leadGateAllowed
    ? config
    : { ...config, leadGate: { ...config.leadGate, enabled: false } };

  const gateActive = overlays.enabled && overlays.leadGate.enabled;

  return {
    overlays,
    ownerName: demo.user?.name ?? hubTitle ?? null,
    // Only worth a query when a gate could actually mount.
    leadCaptured: gateActive ? await hasSubmittedLead(demoId) : false,
  };
}
