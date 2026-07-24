// Where a share QR's target URL comes from, and what is allowed to be one.
//
// Three jobs live here that app/lib/qr/ deliberately does NOT do:
//
//  1. The `?src=qr` decoration. The engine encodes whatever URL it is handed and
//     has no opinion about query params, so the decoration belongs to the caller.
//     It lives in ONE helper rather than a string concat at each surface, because
//     the moment two call sites spell it differently the analytics quietly split.
//  2. The origin allowlist. `toQrTargetUrl()` in app/lib/qr/sanitize.ts validates
//     the SCHEME AND SHAPE ONLY and deliberately not the host — the engine is
//     isomorphic and cannot know the request origin. Deciding a host is ours is
//     this module's job, and calling sanitizeQrOptions() alone is NOT a host check.
//  3. Resolving a hub page's own origin, so a QR on a customer's white-labeled
//     domain encodes that domain rather than marvedge.com.
//
// This file reads `process.env` and a request host, which is exactly why it is
// not in app/lib/qr/ — that directory stays isomorphic and env-free so one code
// path serves a client component and a route handler alike.

// Relative, like app/lib/qr/qr.test.ts's own imports: there is no vitest config
// resolving the "@/" alias, and this module is unit-tested.
import { toQrTargetUrl } from "../qr";

/** The query param scans are tagged with, and the only value we ever write. */
export const QR_SOURCE_PARAM = "src";
export const QR_SOURCE_VALUE = "qr";

/** Fallback when NEXT_PUBLIC_ROOT_DOMAIN is unset. Matches middleware.ts. */
export const DEFAULT_ROOT_DOMAIN = "marvedge.com";

/**
 * Share paths the product actually serves, and the only paths a QR may encode:
 *   /share/<slug>              · the public demo page
 *   /share/video/<id>          · the exported-video page
 *   /hub/<domain>/share/<slug> · the same demo page under a customer hub
 *
 * This is a SHAPE check on purpose. Looking the slug up in the database would
 * turn a public, cacheable, unauthenticated endpoint into an oracle for "does
 * this share id exist" — so the route never touches the DB, and a QR for a
 * nonexistent slug simply renders and then 404s when scanned, exactly as pasting
 * the same link into a browser would.
 *
 * It also narrows the blast radius of the origin allowlist: even on a host we
 * own, /api/qr cannot brand an arbitrary page — only a share link.
 */
const SHARE_PATHNAME = /^\/(?:hub\/[^/]+\/)?share\/(?:video\/)?[^/]+\/?$/;

/** Lowercased root domain with any port stripped. */
function rootDomain(): string {
  return hostnameOf(process.env.NEXT_PUBLIC_ROOT_DOMAIN) ?? DEFAULT_ROOT_DOMAIN;
}

/** The configured app origin, or undefined when NEXT_PUBLIC_APP_URL is unusable. */
function appOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    return undefined;
  }
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/**
 * The bare hostname of a `Host` header or a bare domain — port stripped, IPv6
 * brackets preserved, lowercased. Parsing rather than splitting on ":" so
 * `[::1]:3000` does not become `[`.
 */
function hostnameOf(host: string | null | undefined): string | undefined {
  const trimmed = host?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return new URL(`https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Loopback in any of the spellings a dev machine produces. */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Whether `target` sits on an origin Marvedge owns.
 *
 * Every arm matches on a full hostname — exact equality, or a dot-anchored
 * suffix. Never `includes()` and never a bare `endsWith(root)`, both of which
 * would wave through the classic look-alike `marvedge.com.evil.example`.
 */
function isAllowedShareOrigin(target: URL, requestHost: string | null | undefined): boolean {
  const hostname = target.hostname.toLowerCase();

  // Dev only. Gated on NODE_ENV so a production deployment cannot be talked into
  // branding a QR for someone's local server.
  if (process.env.NODE_ENV !== "production" && isLocalHostname(hostname)) {
    return true;
  }

  // The configured app origin, compared as an origin so an http:// target does
  // not pass on the strength of an https:// config.
  const configured = appOrigin();
  if (configured && target.origin === configured) {
    return true;
  }

  // The apex, www, and any hub subdomain of the root domain (acme.marvedge.com).
  const root = rootDomain();
  if (hostname === root || hostname === `www.${root}` || hostname.endsWith(`.${root}`)) {
    return true;
  }

  // A customer hub on its own custom domain. There is no DB lookup here and it is
  // not an "allow any host" escape hatch: the target must equal the host THIS
  // request arrived on, and a host only reaches this deployment because it was
  // configured as a hub domain and pointed at us.
  //
  // The attack this closes is an official-looking embeddable URL — someone
  // passing off https://marvedge.com/api/qr?url=<evil> as a Marvedge QR. A
  // victim's browser loading that sends `Host: marvedge.com`, so the arm below
  // cannot fire for it. Spoofing the header only works against yourself, and
  // anyone willing to do that could run a QR library locally instead.
  const own = hostnameOf(requestHost);
  if (own && hostname === own) {
    return true;
  }

  return false;
}

export interface MarvedgeShareUrlOptions {
  /** The request's `Host` header, so a custom hub domain validates as its own. */
  requestHost?: string | null;
}

/**
 * Normalize `raw` into a Marvedge-owned share URL, or undefined if it is not one.
 *
 * Layered on top of the engine's shape check, never instead of it: a QR is an
 * instruction a stranger's phone follows, and rendering an arbitrary URL inside a
 * Marvedge-branded code is a phishing primitive. There is deliberately no
 * "allow any URL" option — adding one re-opens exactly that.
 *
 * Returns one undefined for every kind of rejection. The caller answers 400
 * without saying which arm failed, so the endpoint stays uninformative to probing.
 */
export function toMarvedgeShareUrl(
  raw: unknown,
  { requestHost }: MarvedgeShareUrlOptions = {}
): string | undefined {
  // Scheme, length and general shape first — this is what rejects `javascript:`,
  // `data:` and junk. It does NOT check the host; the rest of this function does.
  const normalized = toQrTargetUrl(raw);
  if (!normalized) {
    return undefined;
  }

  let target: URL;
  try {
    target = new URL(normalized);
  } catch {
    return undefined;
  }

  // https://marvedge.com@evil.example/ — the host is evil.example and the checks
  // below already resolve it correctly, but a share link never legitimately
  // carries credentials, so refuse to put one in a QR at all.
  if (target.username || target.password) {
    return undefined;
  }

  if (!isAllowedShareOrigin(target, requestHost)) {
    return undefined;
  }

  if (!SHARE_PATHNAME.test(target.pathname)) {
    return undefined;
  }

  return target.toString();
}

/**
 * Tag a share URL as the QR copy of itself.
 *
 * Applied only to the URL that gets ENCODED — the link behind copy-to-clipboard
 * stays clean, so a pasted link is never miscounted as a scan. Idempotent
 * (`set`, not `append`) because both the client renderer and /api/qr call it and
 * a URL can legitimately reach one of them already tagged.
 *
 * A URL this cannot parse is returned untouched rather than guessed at; the
 * engine rejects it a moment later.
 */
export function withQrSource(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(QR_SOURCE_PARAM, QR_SOURCE_VALUE);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Read the attribution back off a location, for the view-tracking payload.
 *
 * Returns the literal "qr" or undefined — never the raw param. The value reaches
 * a server log, and echoing an arbitrary query string into one is how log
 * injection starts.
 */
export function qrViewSource(
  search: string | null | undefined
): typeof QR_SOURCE_VALUE | undefined {
  if (!search) {
    return undefined;
  }
  const value = new URLSearchParams(search).get(QR_SOURCE_PARAM);
  return value === QR_SOURCE_VALUE ? QR_SOURCE_VALUE : undefined;
}

/**
 * The absolute share URL to encode on a hub page, resolved from the request host.
 *
 * THE RESOLUTION RULE, and why it differs from the share API routes:
 * app/api/demos/[id]/share/route.ts builds `NEXT_PUBLIC_APP_URL || origin`, which
 * is right for the creator-facing modal — that link is minted on marvedge.com by
 * a signed-in owner. It is WRONG on a customer hub. A visitor reading
 * https://demos.acme.com/share/abc is served by /hub/acme/share/abc through the
 * middleware.ts rewrite, and a QR encoding marvedge.com/share/abc would walk them
 * off the customer's white-labeled domain onto ours mid-scan.
 *
 * So hub pages resolve the origin from the REQUEST HOST and ignore
 * NEXT_PUBLIC_APP_URL entirely. The path is the pre-rewrite public one
 * (/share/<slug>), not the internal /hub/<domain>/... the rewrite produces.
 *
 * Returns undefined when there is no usable host, which reads as "no QR here"
 * rather than a QR pointing somewhere wrong.
 */
export function hubShareUrl(host: string | null | undefined, slug: string): string | undefined {
  const hostname = hostnameOf(host);
  if (!hostname || !slug) {
    return undefined;
  }
  // Keep the port: a dev hub runs on acme.localhost:3000 and dropping it yields a
  // URL that does not resolve. Only loopback is served over http.
  const authority = host!.trim().toLowerCase();
  const protocol = isLocalHostname(hostname) ? "http" : "https";
  return `${protocol}://${authority}/share/${encodeURIComponent(slug)}`;
}
