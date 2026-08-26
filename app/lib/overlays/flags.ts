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
