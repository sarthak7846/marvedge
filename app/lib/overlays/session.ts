// The `mv_sid` anonymous identity cookie, in one place.
//
// LIFTED VERBATIM from app/api/cta-clicks/route.ts, which minted it first, and
// that route now calls back into here — the point of this module is that there
// is exactly ONE mv_sid implementation. A second endpoint minting its own
// slightly-different cookie (different max-age, different path) would split the
// funnel in half without any error to notice: the same viewer would count as two
// people, and nothing would look broken.
//
// WHAT IT IS NOT: an auth token. `httpOnly` is false by design, because the
// client reads it — which means the client can also read, edit and forge it.
// Nothing may ever authorise on this value. It identifies a browser for
// analytics, and the funnel it produces is directionally true, not audit-grade.
//
// Typed structurally rather than against NextRequest/NextResponse so that
// app/lib/overlays/ stays free of `next/server` and remains isomorphic and unit
// testable. Both Next types satisfy these shapes as they are.

/** A random session-id VALUE (not a presence flag). */
export const SID_COOKIE = "mv_sid";
export const SID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** The cookie options mv_sid is written with. Must not drift between routes. */
export const SID_COOKIE_OPTIONS = {
  maxAge: SID_MAX_AGE,
  path: "/",
  httpOnly: false,
} as const;

export interface SessionCookieRequest {
  cookies: { get(name: string): { value: string } | undefined };
}

export interface SessionCookieResponse {
  cookies: {
    set(
      name: string,
      value: string,
      options: { maxAge: number; path: string; httpOnly: boolean }
    ): unknown;
  };
}

export interface ViewerSession {
  sessionId: string;
  /** True only when this request minted the id, so the cookie is set once. */
  isNew: boolean;
}

/**
 * Read the viewer's anonymous session id, minting one when the browser has none.
 *
 * Minting is SERVER-SIDE ONLY and only when the cookie is absent, so repeated
 * calls from the same browser reuse the same id.
 */
export function readOrMintSessionId(req: SessionCookieRequest): ViewerSession {
  const existing = req.cookies.get(SID_COOKIE)?.value;
  if (existing) {
    return { sessionId: existing, isNew: false };
  }
  return { sessionId: crypto.randomUUID(), isNew: true };
}

/**
 * Write the cookie back, but only when this request minted it.
 *
 * Re-setting an existing id on every request would work, but it would also
 * refresh the 1-year expiry on every heartbeat and rewrite a header on a
 * response that is otherwise cacheable. Setting it once is the behaviour
 * /api/cta-clicks has always had.
 */
export function applySessionCookie(res: SessionCookieResponse, session: ViewerSession): void {
  if (!session.isNew) {
    return;
  }
  res.cookies.set(SID_COOKIE, session.sessionId, SID_COOKIE_OPTIONS);
}
