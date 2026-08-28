// Branching cards (#302 §2.2): where a card sends the viewer, and when the pair
// appears.
//
// PURE AND ISOMORPHIC like the rest of app/lib/overlays/. No DOM, no Prisma, no
// `process.env` — the two things a branch card actually needs from the outside
// world (the request host, and the target demos' slugs) are passed in. That is
// what lets the server component resolve the hrefs before the page is sent, the
// client component render them, and vitest assert the hostile-input behaviour
// without a browser or a database.
//
// hubShareUrl() is imported from app/lib/share/qrTarget.ts rather than
// reimplemented. It is the module that already answers "what is the absolute
// share URL on THIS request's host", it is tested against the same look-alike
// hosts, and a second copy of that rule would drift from the QR one — at which
// point a QR and a branch card on the same page would point at different
// origins. Only hubShareUrl() is used, and it reads no environment.

import { toHttpUrl } from "./config";
import { crossedThreshold } from "./playback";
import { hubShareUrl } from "../share/qrTarget";
import type { BranchTarget, BranchingConfig } from "./types";

// --- Storage identity ------------------------------------------------------

/**
 * The two `Cta.placement` values a branch card is stored under.
 *
 * DECISION 6: branch cards ARE CTAs. Each card is mirrored into a `Cta` row so a
 * click can write a real `CtaClick` (which needs a `ctaId`) and the CTA numbers
 * on app/(signed)/analytics/page.tsx keep counting without knowing this feature
 * exists. The card's presentation lives in the `BranchingConfig` JSON; the row is
 * the analytics anchor, not a second source of truth.
 *
 * Both share routes and the owner-facing CTA list filter these placements out of
 * their CTA queries — a branch card must not also appear as a button under the
 * video, and it must not show up in the CTA panel offering an edit that the next
 * overlays save would overwrite.
 */
export type BranchPlacement = "branch-a" | "branch-b";

export const BRANCH_PLACEMENTS: readonly BranchPlacement[] = ["branch-a", "branch-b"];

/** Which config slot a placement holds, so the two never drift apart. */
export const BRANCH_SLOTS: readonly { key: "a" | "b"; placement: BranchPlacement }[] = [
  { key: "a", placement: "branch-a" },
  { key: "b", placement: "branch-b" },
];

// --- Href resolution -------------------------------------------------------

/**
 * demoId → the slug to put in `/share/<slug>`, for the demo targets that were
 * resolvable. The CALLER decides what belongs in here — it is the one place the
 * "is this demo public, and is it the owner's own" question is answered, and it
 * needs a database to answer it. A target absent from the map does not resolve,
 * which is exactly what should happen to a card pointing at a demo that has been
 * deleted or unpublished.
 */
export type BranchSlugMap = Readonly<Record<string, string | null | undefined>>;

/**
 * The absolute (or root-relative) href for a branch target, or undefined when it
 * does not resolve to something worth putting in an anchor.
 *
 * `demo` — THE VIEWER STAYS ON THE DOMAIN THEY ARE ALREADY ON. hubShareUrl()
 * builds the share URL from the request host, so a visitor reading
 * https://demos.acme.com/share/x who takes a branch card lands on
 * https://demos.acme.com/share/y. Resolving against NEXT_PUBLIC_APP_URL instead
 * would walk a customer's own visitor onto marvedge.com halfway through their
 * funnel. When there is no usable host at all (a server render with no Host
 * header) it degrades to the root-relative `/share/<slug>`, which stays on the
 * current origin by construction rather than guessing at one.
 *
 * `url` — HTTPS ONLY, no credentials, re-normalised. This is the same
 * toHttpUrl() the config sanitiser writes through, run again at resolve time:
 * an allow-rule enforced only at the write boundary stops being one the moment a
 * row is edited by hand, and this string goes straight into an `href` on a
 * public page. It is deliberately NOT host-allow-listed — a branch card is an
 * owner-chosen outbound link the viewer clicks, exactly like `Cta.url`. The
 * allow-list in config.ts exists for the scheduling URL because that one gets
 * FRAMED inside our page.
 */
export function resolveBranchHref(
  target: BranchTarget,
  host: string | null | undefined,
  slugs: BranchSlugMap = {}
): string | undefined {
  if (target.kind === "demo") {
    const slug = slugs[target.demoId];
    if (typeof slug !== "string" || slug.trim().length === 0) {
      return undefined;
    }
    return hubShareUrl(host, slug) ?? `/share/${encodeURIComponent(slug)}`;
  }
  return toHttpUrl(target.href, { httpsOnly: true });
}

// --- The resolved pair -----------------------------------------------------

/** One card, with everything the overlay needs and nothing it does not. */
export interface ResolvedBranchCard {
  placement: BranchPlacement;
  /** Which variant this came from; rides along on the cta_click meta. */
  kind: BranchTarget["kind"];
  label: string;
  description: string;
  /** "" when the owner set none. */
  thumbnailUrl: string;
  href: string;
  /**
   * The mirrored `Cta.id`. Absent when the row is missing — the card still
   * renders and still emits `cta_click`; only the `CtaClick` row is skipped,
   * because POST /api/cta-clicks has always required a ctaId.
   */
  ctaId?: string;
}

/**
 * Resolve both cards, or neither.
 *
 * ALL OR NOTHING, matching sanitizeBranching(): a pair where one side goes
 * nowhere is a choice with one real option, which reads as a broken page rather
 * than as a decision. sanitizeBranching() already forces the section off when a
 * target fails to sanitise; this catches the cases it cannot see — a target demo
 * that has since been deleted, unpublished, or handed to another owner.
 */
export function resolveBranchCards(
  branching: BranchingConfig,
  host: string | null | undefined,
  slugs: BranchSlugMap = {},
  ctaIds: Partial<Record<BranchPlacement, string>> = {}
): ResolvedBranchCard[] {
  if (!branching.enabled) {
    return [];
  }
  const cards: ResolvedBranchCard[] = [];
  for (const { key, placement } of BRANCH_SLOTS) {
    const card = branching[key];
    const href = resolveBranchHref(card.target, host, slugs);
    if (!href) {
      return [];
    }
    cards.push({
      placement,
      kind: card.target.kind,
      label: card.label,
      description: card.description,
      thumbnailUrl: card.thumbnailUrl,
      href,
      ...(ctaIds[placement] ? { ctaId: ctaIds[placement] } : {}),
    });
  }
  return cards;
}

// --- When they appear ------------------------------------------------------

/**
 * The playhead position the cards appear at, or undefined when there is not one.
 *
 * `duration` IS THE ELEMENT'S, from `loadedmetadata` — never `Demo.duration`,
 * which is `Float?` and null on plenty of rows. A null there must not silently
 * disable the feature, so the config carries no duration at all and the player
 * reads the only copy that is always right. Before metadata loads the duration
 * is NaN and this correctly says "no threshold yet".
 *
 * THE DEGENERATE CASE — A VIDEO SHORTER THAN `leadSeconds` — RESOLVES TO
 * undefined, AND THE CARDS THEN APPEAR ONLY ON `ended`. The alternative is
 * showing them immediately, which on a 3-second clip means the cards are the
 * first thing on screen and the video is never watched at all: the overlay
 * covers it and opening one pauses playback. Waiting for `ended` costs at most
 * the length of the clip and still shows the cards to everyone who watched it.
 */
export function branchThresholdSec(duration: number, leadSeconds: number): number | undefined {
  if (!Number.isFinite(duration) || duration <= 0) {
    return undefined;
  }
  if (!Number.isFinite(leadSeconds) || leadSeconds <= 0) {
    return undefined;
  }
  const threshold = duration - leadSeconds;
  return threshold > 0 ? threshold : undefined;
}

export interface BranchTriggerInput {
  /** The element's duration. NaN until metadata has loaded. */
  duration: number;
  leadSeconds: number;
  /** The previous observed playhead — this is a crossing test, not a timer. */
  prevTime: number;
  currentTime: number;
  ended: boolean;
}

/**
 * Should the cards be up?
 *
 * `ended` wins outright, which is what makes the pair reachable for a video
 * shorter than `leadSeconds` and what guarantees a viewer who watched the whole
 * thing still gets the choice. Otherwise it is crossedThreshold(), so a viewer
 * who DRAGS the scrub handle from 0:10 into the last second still triggers —
 * a setTimeout at "duration - 5s" would never fire for exactly the viewer most
 * likely to be looking for what comes next.
 *
 * This answers "should they be up right now", not "have they ever been". The
 * caller latches, because the cards persist through `ended` and past a seek back
 * into the middle of the video.
 */
export function branchCardsShouldOpen({
  duration,
  leadSeconds,
  prevTime,
  currentTime,
  ended,
}: BranchTriggerInput): boolean {
  if (ended) {
    return true;
  }
  const threshold = branchThresholdSec(duration, leadSeconds);
  if (threshold === undefined) {
    return false;
  }
  return crossedThreshold(prevTime, currentTime, threshold);
}
