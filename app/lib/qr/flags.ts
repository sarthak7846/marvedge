// Feature flag for shareable-link QR codes.
//
// WHY THIS DEFAULTS TO ON, UNLIKE app/lib/wtm/flags.ts
// -----------------------------------------------------
// isWtmEnabled() defaults to OFF because WTM changes the artefact: with the flag
// on, a FREE export gets a watermark burned into the video by the render worker.
// It has to be opt-in, and unset has to mean "behave exactly as before".
//
// The QR surface cannot do that. It is derived, read-only and additive: it renders
// a QR for a share URL that already exists, mints nothing, writes nothing, and
// touches no export path. There is no state it can leave behind. So this flag is a
// KILL-SWITCH rather than a rollout gate — it exists so the surface can be pulled
// during an incident without a code change, and "unset" means on.
//
// Hence the inverted helper below: WTM asks "was this explicitly switched on?",
// QR asks "was this explicitly switched off?".
//
// One flag, not two. There is no server-only half to gate — the engine is
// isomorphic and the QR route serves public share URLs — so a NEXT_PUBLIC_ var
// covers both ends. That does mean the value is inlined into the client bundle at
// build time: not a secret, but flipping it needs a rebuild for the client and
// only a restart for the server.

/** The inverse of truthy() in app/lib/wtm/flags.ts, for the same two spellings. */
const falsy = (value: string | undefined): boolean => value === "false" || value === "0";

/**
 * Whether to offer a QR code alongside a share link. Reads
 * `NEXT_PUBLIC_SHARE_QR_ENABLED`, which Next inlines at build time, so this is
 * safe from client components and route handlers alike.
 *
 * Unset, empty, or any unrecognised value → **true**. Only an explicit
 * `false`/`0` turns it off: a typo must not silently kill a surface whose default
 * is on.
 */
export function isShareQrEnabled(): boolean {
  return !falsy(process.env.NEXT_PUBLIC_SHARE_QR_ENABLED);
}
