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

import { cookies, headers } from "next/headers";

import { prisma } from "@/app/lib/prisma";
import { isOverlaysAllowed } from "@/app/lib/overlays/access";
import {
  BRANCH_PLACEMENTS,
  resolveBranchCards,
  type BranchPlacement,
  type ResolvedBranchCard,
} from "@/app/lib/overlays/branch";
import { overlayConfigFromRow } from "@/app/lib/overlays/config";
import {
  isOverlaysEnabled,
  isOverlaysPanelEnabled,
  isSignedMediaEnabled,
} from "@/app/lib/overlays/flags";
import { pickMediaUrl } from "@/app/lib/overlays/hls";
import { isMediaGated } from "@/app/lib/overlays/mediaAccess";
import { SID_COOKIE } from "@/app/lib/overlays/session";
import type { BranchingConfig, OverlayConfig } from "@/app/lib/overlays/types";
import { resolveHlsPlaylistUrl } from "@/app/lib/hls/package";

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
  /**
   * The two branch cards with their hrefs already resolved against THIS
   * REQUEST'S HOST, or empty.
   *
   * Resolved on the server rather than in the browser for two reasons. The href
   * has to carry the domain the viewer is already on, and the only reliable
   * source of that on a customer hub is the request host — reading
   * window.location after hydration would render the pair href-less for a
   * moment and would put nothing in the server HTML. And the demo variant needs
   * a database lookup to turn a demoId into a slug, which a public client has no
   * business being able to ask for.
   */
  branchCards: ResolvedBranchCard[];
  /**
   * The demo's packaged HLS master playlist as an https URL, or null when there
   * are no renditions / OVERLAYS_HLS_ENABLED is off. AT MERGE TIME THIS IS NULL
   * FOR EVERY DEMO — nothing has been packaged yet — so the MP4 fallback in
   * shareMediaUrl() below is the common path, not the exceptional one.
   */
  hlsUrl: string | null;
  /**
   * The media URL is withheld from the rendered page until a lead is submitted
   * (a hard gate with OVERLAYS_SIGNED_MEDIA_ENABLED on). The player then asks
   * GET /api/v3/media/[demoId] for a short-TTL signed URL.
   */
  mediaGated: boolean;
}

/**
 * The URL the `<video>` should be pointed at, for all three share routes.
 *
 * A ONE-LINE CHANGE PER PAGE, on purpose: each share route already computed
 * `demo.exportedUrl || demo.videoUrl` and passes exactly that as `fallbackUrl`,
 * so with no context (OVERLAYS_ENABLED off) this returns it unchanged and the
 * page renders what it renders today. The decision itself is pure and tested in
 * app/lib/overlays/hls.ts.
 */
export function shareMediaUrl(
  fallbackUrl: string,
  context: ShareOverlayContext | undefined
): string {
  return pickMediaUrl({
    fallbackUrl,
    hlsUrl: context?.hlsUrl,
    gated: context?.mediaGated,
  });
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
 * Turn the configured branch targets into clickable cards.
 *
 * Two lookups, and only when a pair could actually mount:
 *
 *  - THE TARGET DEMOS, scoped to `userId` and `isPublic`. Scoped to the owner
 *    because that is exactly what the editor's picker offers, so a card can only
 *    point where the owner could have pointed it; scoped to public because an
 *    unlisted demo's share page 404s and a card at one is a dead end. A target
 *    that has since been deleted or unpublished simply drops out of the map, and
 *    resolveBranchCards() then renders NEITHER card rather than a lopsided pair.
 *    `publicLink ?? id` because /share/[slug] resolves either.
 *
 *  - THE MIRRORED CTA ROWS, for the ctaId a CtaClick needs. Missing rows are not
 *    fatal: the card still renders and still emits cta_click.
 *
 * Any failure degrades to no cards. This runs on an unauthenticated public page
 * and losing an overlay is always better than losing the page.
 */
async function resolveBranchCardsForDemo(
  demoId: string,
  userId: string,
  branching: BranchingConfig
): Promise<ResolvedBranchCard[]> {
  const targetIds = [branching.a.target, branching.b.target]
    .filter((target) => target.kind === "demo")
    .map((target) => target.demoId);

  try {
    const [targets, ctas, host] = await Promise.all([
      targetIds.length > 0
        ? prisma.demo.findMany({
            where: { id: { in: [...new Set(targetIds)] }, userId, isPublic: true },
            select: { id: true, publicLink: true },
          })
        : Promise.resolve([]),
      prisma.cta.findMany({
        where: { demoId, placement: { in: [...BRANCH_PLACEMENTS] } },
        select: { id: true, placement: true },
      }),
      headers().then((list) => list.get("host")),
    ]);

    const slugs: Record<string, string> = {};
    for (const target of targets) {
      slugs[target.id] = target.publicLink ?? target.id;
    }

    const ctaIds: Partial<Record<BranchPlacement, string>> = {};
    for (const cta of ctas) {
      if (cta.placement === "branch-a" || cta.placement === "branch-b") {
        ctaIds[cta.placement] = cta.id;
      }
    }

    return resolveBranchCards(branching, host, slugs, ctaIds);
  } catch {
    return [];
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
    select: {
      userId: true,
      overlayConfig: true,
      user: { select: { name: true, plan: true } },
      // One extra column on a relation this query already has a unique key for.
      // Selected unconditionally rather than behind isHlsEnabled() because a
      // Prisma select is static, and a branch here would mean two shapes of this
      // query to keep in agreement for one nullable string.
      exportedVideo: { select: { hlsPlaylistUrl: true } },
    },
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
  const branchingActive = overlays.enabled && overlays.branching.enabled;

  // Withheld only for a HARD gate, and only with the sub-flag on. isMediaGated()
  // is shared with GET /api/v3/media/[demoId] precisely so the page and the
  // signing endpoint can never disagree about whether this demo is gated.
  //
  // AND ONLY WHEN THE PLAYER IS ACTUALLY RENDERING. The client flag is checked
  // here, on the server, because withholding the URL is only safe if something
  // on the page can go and fetch a signed one — and that is MarvedgePlayer,
  // which NEXT_PUBLIC_OVERLAYS_ENABLED gates. A deployment with the server flag
  // on and the client flag off falls back to today's native <video src>, which
  // would otherwise be handed an empty string and simply never play. Half-
  // configured is a state real deployments pass through; it must not be one
  // where videos disappear.
  const mediaGated = isMediaGated({
    signedMediaEnabled: isSignedMediaEnabled() && isOverlaysPanelEnabled(),
    config: overlays,
    planAllowed: leadGateAllowed,
  });

  return {
    overlays,
    ownerName: demo.user?.name ?? hubTitle ?? null,
    // Only worth a query when a gate could actually mount.
    leadCaptured: gateActive ? await hasSubmittedLead(demoId) : false,
    branchCards: branchingActive
      ? await resolveBranchCardsForDemo(demoId, demo.userId, overlays.branching)
      : [],
    // null unless this demo has been packaged AND OVERLAYS_HLS_ENABLED is on
    // AND the stored URI resolves to a public https playlist. Every one of those
    // failing lands the player back on the progressive MP4.
    //
    // The client flag is checked for the same reason mediaGated checks it, and
    // this one is sharper: with NEXT_PUBLIC_OVERLAYS_ENABLED off the page falls
    // back to a native <video src>, and a bare .m3u8 on that element plays on
    // Safari and NOWHERE ELSE. hls.js only exists on the MarvedgePlayer path, so
    // a playlist may only be offered when that player is what will receive it.
    hlsUrl: isOverlaysPanelEnabled()
      ? resolveHlsPlaylistUrl(demo.exportedVideo?.hlsPlaylistUrl)
      : null,
    mediaGated,
  };
}
