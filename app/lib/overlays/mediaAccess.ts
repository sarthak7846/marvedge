// Who is allowed to see the media URL, and for how long.
//
// Pure and isomorphic like the rest of app/lib/overlays/. The env read that
// feeds parseSignedMediaTtl lives in ./flags.ts, which is the only file in this
// directory that touches process.env.
//
// THE POINT OF THIS MODULE IS THAT TWO CALLERS AGREE. The share page decides
// whether to withhold the media URL from the rendered HTML
// (app/share/[slug]/overlayContext.ts), and the signing endpoint decides whether
// to demand a lead before handing one out (app/api/v3/media/[demoId]/route.ts).
// If those two ever disagreed the failure is silent in the worse direction: a
// page that renders no source while the endpoint hands the URL to anyone, or a
// page that renders the URL while the endpoint refuses to sign it. One function,
// called by both.

import type { OverlayConfig } from "./types";

/** Default TTL for a signed media URL: 15 minutes. */
export const DEFAULT_SIGNED_MEDIA_TTL_SECONDS = 900;

/**
 * Floor and ceiling on the TTL. The floor is a playback constraint, not a
 * policy: a URL that expires mid-video makes hls.js fail a segment fetch and
 * stall, so anything under a minute is a broken player rather than a strict one.
 * The ceiling is the policy — a "short-TTL" URL that lasts a day is a public URL
 * with extra steps.
 */
export const MIN_SIGNED_MEDIA_TTL_SECONDS = 60;
export const MAX_SIGNED_MEDIA_TTL_SECONDS = 6 * 60 * 60;

/**
 * Parse OVERLAYS_SIGNED_MEDIA_TTL_SECONDS, falling back to the default.
 *
 * Anything unparseable falls back rather than resolving to 0 — the same rule
 * parseRetentionDays() follows in ./rollup.ts, and for the same reason: a
 * mistyped env var must not silently mean "expire immediately". A value outside
 * the bounds is clamped rather than rejected, because an operator who typed
 * 86400 wanted "long", and the safe reading of that is the ceiling.
 */
export function parseSignedMediaTtl(raw: string | undefined): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SIGNED_MEDIA_TTL_SECONDS;
  }
  return Math.min(Math.max(parsed, MIN_SIGNED_MEDIA_TTL_SECONDS), MAX_SIGNED_MEDIA_TTL_SECONDS);
}

export interface MediaGateInput {
  /** OVERLAYS_SIGNED_MEDIA_ENABLED, resolved by the caller. */
  signedMediaEnabled: boolean;
  /** The demo's sanitised overlay config. */
  config: OverlayConfig;
  /**
   * isOverlaysAllowed(user.plan). The lead gate is PRO/ENTERPRISE, so a demo
   * whose owner has downgraded has a gate that no longer applies — and media
   * that must therefore not be withheld. Re-resolved server-side from User.plan
   * by every caller, never trusted from the stored row.
   */
  planAllowed: boolean;
}

/**
 * Is this demo's media withheld until a lead is submitted?
 *
 * ONLY A HARD GATE, deliberately. A soft gate is one the viewer may skip, so
 * withholding the media behind it would turn "you may skip this" into "you may
 * not", which is a different product than the owner configured. The gate also
 * has to be reachable at all — the overlay layer on, the gate section on, and
 * the owner on a plan that is allowed one.
 *
 * Everything else about the demo — HLS or MP4, r2:// or legacy gs:// — is
 * irrelevant here. What can actually be signed is a separate question answered
 * at signing time, and a demo whose media cannot be signed still reports as
 * gated so that the endpoint, not the page, decides what to do about it.
 */
export function isMediaGated({ signedMediaEnabled, config, planAllowed }: MediaGateInput): boolean {
  if (!signedMediaEnabled || !planAllowed) {
    return false;
  }
  return config.enabled && config.leadGate.enabled && config.leadGate.mode === "hard";
}
