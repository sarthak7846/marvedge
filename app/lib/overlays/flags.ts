// Feature flags for OVL (Interactive Video Overlays, GitHub #302).
//
// Follows the exact pattern used by AVS (`app/lib/avs/flags.ts`), WTM
// (`app/lib/wtm/flags.ts`) and AUDIO (`app/lib/audio/flags.ts`): the feature
// ships behind a flag and must be a complete no-op when the flag is off. Three
// flags, because three things need to be toggled independently:
//   - OVERLAYS_ENABLED             — server-only master switch (new API routes).
//   - NEXT_PUBLIC_OVERLAYS_ENABLED — client-safe switch, gates the player
//                                    overlay layer AND the editor panel.
//   - OVERLAYS_CRM_ENABLED         — server-only, gates OUTBOUND lead delivery
//                                    separately from lead capture (PR 4), so a
//                                    misbehaving CRM can be cut off without
//                                    taking the gate down with it.
//
// ALL THREE DEFAULT OFF, and unlike the QR kill-switch in `app/lib/qr/flags.ts`
// they are not "default on, flip to disable". QR is derived and read-only — it
// renders a URL that already exists and writes nothing. These two change what an
// unauthenticated public page renders and cause viewer PII to be stored and
// forwarded to a third party. A flag whose default is "off" cannot turn either
// of those on by accident in an environment nobody remembered to configure.
//
// The acceptance criterion for OFF is byte-identical: with
// NEXT_PUBLIC_OVERLAYS_ENABLED unset, all three share routes must render exactly
// what they render today.

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
