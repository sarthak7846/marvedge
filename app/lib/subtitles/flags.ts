// Feature flags for the AI Subtitle Generator (SUB).
//
// Two flags, so the client UI and the server-side translation work can be rolled
// out independently:
//   - NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED — client-safe, gates the new subtitle
//     panel (and, through it, the timeline track and the style controls).
//   - SUBTITLE_TRANSLATE_ENABLED          — server-only, gates the translation
//     route. Never sent to the browser.
//
// WHY BOTH DEFAULT OFF, UNLIKE app/lib/qr/flags.ts
// ------------------------------------------------
// isShareQrEnabled() defaults to ON because the QR surface is derived and
// read-only: it renders a code for a URL that already exists, writes nothing,
// and cannot change an exported video. Its flag is a kill-switch.
//
// These two are the opposite. The editor panel lets a user rewrite, re-time and
// restyle the cues that get burned into the export, and the translate route
// spends money at OpenAI. Both change the artefact, so "unset" has to mean
// "behave exactly as today" — the same rule AVS and WTM follow. Hence `truthy`
// rather than QR's inverted `falsy`: these ask "was this explicitly switched
// on?", not "was this explicitly switched off?".

/** Same two spellings the AVS and WTM flags accept. */
const truthy = (value: string | undefined): boolean => value === "true" || value === "1";

/**
 * Client-safe flag that gates the subtitle editor panel. Reads
 * `NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED`, which Next inlines at build time, so it
 * is safe to call from client components and route handlers alike. Flipping it
 * needs a rebuild for the client and only a restart for the server.
 */
export function isSubtitleEditorEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED);
}

/**
 * Server-side switch for AI subtitle translation. Reads the server-only
 * `SUBTITLE_TRANSLATE_ENABLED`, so this must only be called from server code
 * (API routes, server components).
 *
 * This is the feature gate, not the entitlement gate. Translation is also
 * PRO/ENTERPRISE-only, and that check is a separate, server-side plan lookup in
 * the translate route itself — a flag is not a paywall.
 */
export function isSubtitleTranslateEnabled(): boolean {
  return truthy(process.env.SUBTITLE_TRANSLATE_ENABLED);
}
