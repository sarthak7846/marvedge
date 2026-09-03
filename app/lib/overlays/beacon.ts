// The one "fire a request that must survive the page going away" helper.
//
// LIFTED FROM the fireCtaClick() body in
// app/share/[slug]/components/ShareCtaButtons.tsx, which now calls back into
// here. Two copies of this is how one of them quietly stops working:
// sendBeacon has a per-origin queue budget and returns false — silently, no
// throw — once it is exhausted, so the fetch(keepalive) fallback is not
// decoration. A copy that forgot it would lose events only under load, which is
// exactly when they matter.
//
// NOT re-exported from ./index. That barrel promises isomorphic modules and this
// one reaches for `navigator` and `fetch`. Nothing here touches a global at
// module scope, so importing it on the server is harmless; calling it there
// simply reports that it could not send.

/**
 * POST `payload` to `url` in a way that survives an unload.
 *
 * Tries sendBeacon first (the browser owns the request once it is queued, so it
 * outlives the document), then a keepalive fetch. Never throws, never returns a
 * promise, and never surfaces a failure to the caller beyond the boolean — a
 * caller firing telemetry from a `pagehide` handler has nowhere to put an error
 * and must not be blocked waiting for one.
 *
 * @returns true when a transport accepted the payload. Not a delivery receipt:
 *   sendBeacon returns as soon as the request is queued and the keepalive fetch
 *   is deliberately not awaited, so neither can tell us the server replied.
 */
export function postBeacon(url: string, payload: string): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return true;
      }
    }
  } catch {
    // Blob unavailable, or a CSP/permissions failure. Fall through to fetch.
  }

  try {
    if (typeof fetch !== "function") {
      return false;
    }
    // keepalive keeps the request alive across the navigation that triggered it.
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
