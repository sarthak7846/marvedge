// Feature flags for OVL (Interactive Video Overlays, GitHub #302).
//
// Follows the exact pattern used by AVS (`app/lib/avs/flags.ts`), WTM
// (`app/lib/wtm/flags.ts`) and AUDIO (`app/lib/audio/flags.ts`): the feature
// ships behind a flag and must be a complete no-op when the flag is off. Five
// flags, because five things need to be toggled independently:
//   - OVERLAYS_ENABLED             — server-only master switch (new API routes).
//   - NEXT_PUBLIC_OVERLAYS_ENABLED — client-safe switch, gates the player
//                                    overlay layer AND the editor panel.
//   - OVERLAYS_CRM_ENABLED         — server-only, gates OUTBOUND lead delivery
//                                    separately from lead capture (PR 4), so a
//                                    misbehaving CRM can be cut off without
//                                    taking the gate down with it.
//   - OVERLAYS_HLS_ENABLED         — server-only, gates HLS packaging and
//                                    whether a packaged playlist is preferred
//                                    over the MP4 (PR 8).
//   - OVERLAYS_SIGNED_MEDIA_ENABLED — server-only, gates withholding the media
//                                    URL behind a hard gate (PR 8).
//
// ALL FIVE DEFAULT OFF, and unlike the QR kill-switch in `app/lib/qr/flags.ts`
// they are not "default on, flip to disable". QR is derived and read-only — it
// renders a URL that already exists and writes nothing. These two change what an
// unauthenticated public page renders and cause viewer PII to be stored and
// forwarded to a third party. A flag whose default is "off" cannot turn either
// of those on by accident in an environment nobody remembered to configure.
//
// The acceptance criterion for OFF is byte-identical: with
// NEXT_PUBLIC_OVERLAYS_ENABLED unset, all three share routes must render exactly
// what they render today.

import { parseSignedMediaTtl } from "./mediaAccess";
import {
  DEFAULT_EVENT_RETENTION_DAYS,
  DEFAULT_LEAD_RETENTION_DAYS,
  parseRetentionDays,
} from "./rollup";

const truthy = (value: string | undefined): boolean => value === "true" || value === "1";

/**
 * Server-side OVL master switch. Reads the server-only `OVERLAYS_ENABLED` env
 * var, so this must only be called from server code (API routes, server
 * components).
 */
export function isOverlaysEnabled(): boolean {
  return truthy(process.env.OVERLAYS_ENABLED);
}

/**
 * Client-safe flag that gates the player's overlay layer and the "Overlays"
 * sidebar panel. Reads `NEXT_PUBLIC_OVERLAYS_ENABLED`, which Next inlines at
 * build time so it is safe to call from client components. Never exposes a real
 * secret.
 */
export function isOverlaysPanelEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_OVERLAYS_ENABLED);
}

/**
 * Server-side switch for outbound CRM delivery (PR 4). Independent of
 * `OVERLAYS_ENABLED` on purpose: leads keep landing in the database when this is
 * off, they simply are not forwarded anywhere.
 */
export function isOverlaysCrmEnabled(): boolean {
  return truthy(process.env.OVERLAYS_CRM_ENABLED);
}

// --- Retention and the rollup endpoint (PR 7) ------------------------------
//
// These are env READS, not flags, and they live here for the reason the module
// header gives: `process.env` is touched in this file and nowhere else under
// app/lib/overlays, so the rest of the library stays isomorphic. The parsing and
// the defaults themselves are pure and tested in ./rollup.ts.

/**
 * How long raw PlayerEvent rows are kept, in days. Default 90 (locked decision
 * 15), overridable with OVERLAYS_EVENT_RETENTION_DAYS.
 *
 * Raw events are the expensive, high-volume, per-viewer half of the telemetry.
 * The rollup they feed is kept indefinitely — deleting an event never deletes a
 * counted funnel step, see app/api/v3/events/rollup/route.ts for the ordering
 * that guarantees it.
 */
export function eventRetentionDays(): number {
  return parseRetentionDays(
    process.env.OVERLAYS_EVENT_RETENTION_DAYS,
    DEFAULT_EVENT_RETENTION_DAYS
  );
}

/**
 * How long a captured Lead is kept, in days. Default 730 — 24 months (locked
 * decision 15) — overridable with OVERLAYS_LEAD_RETENTION_DAYS.
 *
 * This one is a commitment to a viewer, not a cost control: someone handed over
 * their name and email under a consent string, and "we keep it forever" is not
 * what that string says. Deleting a Lead cascades to its LeadDelivery rows.
 */
export function leadRetentionDays(): number {
  return parseRetentionDays(process.env.OVERLAYS_LEAD_RETENTION_DAYS, DEFAULT_LEAD_RETENTION_DAYS);
}

/**
 * The shared secret guarding POST /api/v3/events/rollup, or null when unset.
 *
 * NULL MEANS THE ENDPOINT IS CLOSED, not open: the route answers 503 rather than
 * running unauthenticated. An unset secret is a deployment that has not been
 * configured for the rollup yet, and a maintenance endpoint that deletes rows
 * must fail shut when nobody has said who may call it.
 *
 * Server-only, and never returned in a response body. It is compared with a
 * timing-safe equality in the route — see app/lib/crm/signature.ts for the same
 * pattern on the webhook side.
 */
export function rollupSecret(): string | null {
  const raw = process.env.OVERLAYS_ROLLUP_SECRET;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

// --- HLS and signed media (PR 8) -------------------------------------------
//
// TWO SUB-FLAGS, NOT ONE, and neither is implied by OVERLAYS_ENABLED. They gate
// two independent things that happen to have landed in the same PR: producing
// adaptive renditions, and refusing to hand out the media URL until a lead has
// been submitted. Signing media without HLS is a sensible configuration (it is
// the fix for the honest gap in the hard gate, and it works on the progressive
// MP4 every demo already has); so is packaging HLS without signing anything.
// Wiring them to one switch would mean an incident in either taking down both.

/**
 * Server-side switch for HLS: the packaging trigger, the manual "Generate HLS"
 * action, and whether a packaged playlist is preferred over the MP4 on the share
 * page. Default off.
 *
 * Off is NOT the same as "no renditions exist" — an already-packaged demo simply
 * goes back to being served its progressive MP4, which is the fallback path the
 * player takes for every demo today. That is what makes this flag safe to pull
 * during an incident: it costs adaptive bitrate, not playback.
 */
export function isHlsEnabled(): boolean {
  return truthy(process.env.OVERLAYS_HLS_ENABLED);
}

/**
 * Server-side switch for signed media. Default off.
 *
 * When on, a demo with a HARD lead gate no longer has its media URL rendered
 * into the public page at all: the player asks GET /api/v3/media/[demoId] for a
 * short-TTL presigned URL, and that endpoint answers 403 until a Lead row exists
 * for the viewer's mv_sid. This is the enforcement the hard gate has been
 * missing since PR 3 — see the header of app/components/player/LeadGateOverlay.tsx.
 *
 * IT IS STILL NOT DRM, and the honest description in that header is only partly
 * retired by this flag: a viewer who submits the form once gets a real URL and
 * can share it until the TTL expires. What changes is that the media is no
 * longer readable by someone who never submitted anything.
 */
export function isSignedMediaEnabled(): boolean {
  return truthy(process.env.OVERLAYS_SIGNED_MEDIA_ENABLED);
}

/**
 * TTL for a signed media URL, in seconds. Default 900 (15 minutes),
 * overridable with OVERLAYS_SIGNED_MEDIA_TTL_SECONDS.
 *
 * Short enough that a leaked URL stops working while the person who leaked it is
 * still in the room; long enough that a viewer who pauses for a coffee does not
 * come back to a dead element. The parsing and the clamp are pure and tested in
 * ./mediaAccess.ts.
 */
export function signedMediaTtlSeconds(): number {
  return parseSignedMediaTtl(process.env.OVERLAYS_SIGNED_MEDIA_TTL_SECONDS);
}
