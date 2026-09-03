// THE SCHEDULING ALLOW-LIST. Read this before touching the scheduling overlay.
//
// This feature puts THE FIRST THIRD-PARTY DOCUMENT INSIDE OUR PAGE. Every other
// overlay renders markup we wrote; this one hands a rectangle of a public share
// page — sometimes a share page on a CUSTOMER'S OWN DOMAIN — to code we do not
// control. The allow-list below is the whole of the protection, so it is a
// module of its own rather than four lines inside config.ts.
//
// ============================================================================
// ENFORCED IN THREE PLACES, ON PURPOSE
// ============================================================================
//   1. ON SAVE     — PUT /api/demos/[id]/overlays refuses an off-list host with
//                    a 400 that names the allowed ones, so a bad URL never
//                    reaches the database.
//   2. ON RENDER   — buildSchedulingEmbedUrl() re-validates before an <iframe>
//                    src is produced. A row written before this check existed,
//                    hand-edited in psql, or restored from an old backup still
//                    cannot be framed. AN ALLOW-LIST ENFORCED ONLY AT THE WRITE
//                    BOUNDARY STOPS BEING ONE THE MOMENT A ROW ARRIVES BY
//                    ANOTHER ROUTE.
//   3. IN THE CSP  — next.config.ts derives frame-src from SCHEDULING_FRAME_SRC,
//                    so even a src that somehow got past both is refused by the
//                    browser itself.
//
// NEVER RENDER A CALLER-SUPPLIED src UNVALIDATED. There is deliberately no
// "trust me" option and no owner-editable host list: an owner who can add a host
// can frame a credential-harvesting page inside a video that carries their
// customer's branding, which is a phishing primitive, not a feature.
//
// ============================================================================
// THE HOST-MATCHING DISCIPLINE
// ============================================================================
// Lifted from app/lib/share/qrTarget.ts: match a FULL HOSTNAME by equality or by
// a DOT-ANCHORED suffix. Never includes(), never a bare endsWith(root) — both
// wave through the classic look-alike calendly.com.evil.example.
//
// Stricter than toHttpUrl() in ./config in one deliberate way: THIS PARSER
// INFERS NOTHING. An input must already say https://. That rejects a bare
// calendly.com/x and a protocol-relative //calendly.com/x — both of which would
// resolve to something allow-listed, and both of which are a config mistake
// rather than an intention. For a URL that ends up inside an iframe, "we guessed
// what you meant" is not a property worth having.
//
// Isomorphic and dependency-free, like the rest of app/lib/overlays/: this file
// is imported by a client component, a route handler, the editor panel AND
// next.config.ts, so it may not read process.env, touch the DOM, or import
// anything that does.

import type { SchedulingProvider } from "./types";

/**
 * The hosts that may be framed, per provider. Root domains — a subdomain of one
 * is allowed too (Calendly serves enterprise accounts from acme.calendly.com),
 * which is what makes the dot-anchored matching below necessary rather than
 * decorative.
 *
 * meetings.hubspot.com and NOT hubspot.com: the whole of hubspot.com includes
 * the logged-in CRM app, and framing that is not what a scheduling overlay is
 * for.
 *
 * ADDING A HOST HERE WIDENS THE CSP AND THE POSTMESSAGE TRUST BOUNDARY AT THE
 * SAME TIME. Both are derived from this constant, which is the point.
 */
export const SCHEDULING_HOSTS: Record<SchedulingProvider, readonly string[]> = {
  calendly: ["calendly.com"],
  hubspot: ["meetings.hubspot.com"],
};

/** Human-readable host list for a rejection message an owner has to act on. */
export const SCHEDULING_HOST_SUMMARY: Record<SchedulingProvider, string> = {
  calendly: "calendly.com",
  hubspot: "meetings.hubspot.com",
};

/** Longer than any booking link a provider issues; keeps a stored row bounded. */
const URL_MAX_LENGTH = 512;

/** Bounds on prefilled values, so a forged lead cannot grow the URL without limit. */
const MAX_PREFILL_NAME = 120;
const MAX_PREFILL_EMAIL = 254;

/** Dotted-quad, and a bracketed IPv6 literal as URL exposes it. */
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Whether `hostname` is `root` or a subdomain of it.
 *
 * Full-hostname equality or a dot-anchored suffix, never a substring test.
 */
function isHostOrSubdomainOf(hostname: string, root: string): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

/** An IP literal is never a provider host, and must never become one by accident. */
function isIpLiteral(hostname: string): boolean {
  return IPV4_PATTERN.test(hostname) || hostname.startsWith("[");
}

/**
 * Is this hostname framable for `provider`?
 *
 * Takes a bare hostname (already lowercased by URL parsing), not a URL — so the
 * CSP builder and the URL sanitiser share one answer to "is this host ours to
 * trust" rather than two that can drift.
 */
export function isAllowedSchedulingHost(hostname: string, provider: SchedulingProvider): boolean {
  const host = hostname.toLowerCase();
  if (host.length === 0 || isIpLiteral(host)) {
    return false;
  }
  return SCHEDULING_HOSTS[provider].some((root) => isHostOrSubdomainOf(host, root));
}

/**
 * A scheduling URL on one of `provider`'s allow-listed hosts, or undefined.
 *
 * Returns ONE undefined for every kind of rejection — the caller decides what to
 * say, and the panel's message names the allowed hosts rather than describing
 * which arm failed.
 *
 * Never throws, for anything, including values that are not strings at all: this
 * runs on an unauthenticated public page as well as in the editor, and a
 * malformed row must degrade to "no scheduling overlay" rather than 500 someone's
 * share link.
 */
export function sanitizeSchedulingUrl(
  raw: unknown,
  provider: SchedulingProvider
): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > URL_MAX_LENGTH) {
    return undefined;
  }
  // EXPLICIT SCHEME REQUIRED — see the module header. This single check is what
  // rejects //calendly.com/x, calendly.com/x, http://…, javascript: and data:
  // before the parser is even reached.
  if (!/^https:\/\//i.test(trimmed)) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  // Re-checked after parsing rather than trusted from the regex: the protocol the
  // parser reports is the one the browser will actually use.
  if (parsed.protocol !== "https:") {
    return undefined;
  }
  // https://calendly.com@evil.example/ has a host of evil.example. The allow-list
  // below resolves that correctly on its own, but a booking link never
  // legitimately carries credentials, so refuse it outright.
  if (parsed.username || parsed.password) {
    return undefined;
  }
  if (!isAllowedSchedulingHost(parsed.hostname, provider)) {
    return undefined;
  }
  // Re-serialize from the parsed URL so what is stored is exactly what a browser
  // resolves — no stray whitespace, no ambiguous escaping.
  return parsed.toString();
}

// --- CSP -------------------------------------------------------------------

/**
 * frame-src / child-src sources for every provider, derived from the allow-list
 * above.
 *
 * DERIVED, NOT RETYPED. next.config.ts imports this instead of repeating the host
 * strings, so adding a provider host cannot leave a CSP that refuses the thing
 * the sanitiser just started accepting — a failure that shows up as a blank
 * rectangle inside a video with nothing in the server logs.
 *
 * A wildcard per root because the sanitiser accepts subdomains; https:// on each
 * because the sanitiser accepts nothing else.
 */
export const SCHEDULING_FRAME_SRC: readonly string[] = Object.values(SCHEDULING_HOSTS)
  .flat()
  .flatMap((root) => [`https://${root}`, `https://*.${root}`]);

// --- Embedding -------------------------------------------------------------

/**
 * What the viewer already told us, from the PR 3 lead gate IN THIS PAGE SESSION.
 *
 * `consented` is not decoration. Prefilling a third party's form hands them the
 * viewer's name and address in a URL the moment the iframe loads — that is a
 * disclosure, and it is only permitted for someone who ticked the consent box on
 * this page. A returning viewer whose lead is known to the SERVER but who has not
 * filled anything in during this visit arrives here with no prefill at all, which
 * is the correct outcome rather than a limitation to work around.
 */
export interface SchedulingPrefill {
  /** Exactly what the viewer typed. Never a value derived from anywhere else. */
  name?: string | null;
  email?: string | null;
  /** The consent box was ticked. WITHOUT THIS, NOTHING IS PREFILLED. */
  consented: boolean;
}

export interface SchedulingEmbedOptions {
  prefill?: SchedulingPrefill | null;
  /**
   * The hostname the player is running on (window.location.hostname).
   *
   * Calendly will not postMessage a calendly.event_scheduled back to a parent it
   * was not told about, so without this the meeting_booked event never fires.
   * Omitted during SSR, where there is no location to read — the iframe only
   * mounts after the viewer opens the overlay, so it is always present by then.
   */
  embedDomain?: string | null;
}

/** Trimmed, bounded, or undefined when there is nothing worth sending. */
function usableValue(raw: string | null | undefined, maxLength: number): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

/**
 * Split a single typed name into the two fields HubSpot asks for.
 *
 * First token is the first name, EVERYTHING ELSE is the last name — not the last
 * token, which mangles "Ada King Lovelace" and every name with a particle in it.
 * A single-token name fills only firstName; guessing a surname for someone who
 * gave one word is worse than leaving the field for them to complete.
 */
export function splitPrefillName(name: string): { firstName: string; lastName?: string } {
  const parts = name.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Apply the consented prefill for `provider` onto `params`.
 *
 * ONLY FIELDS THE VIEWER ACTUALLY TYPED, and only after consent. Both gates are
 * here rather than at the call site so there is exactly one place that decides
 * whether a viewer's details leave the page.
 */
function applyPrefill(
  params: URLSearchParams,
  provider: SchedulingProvider,
  prefill: SchedulingPrefill | null | undefined
): void {
  if (!prefill || prefill.consented !== true) {
    return;
  }
  const name = usableValue(prefill.name, MAX_PREFILL_NAME);
  const email = usableValue(prefill.email, MAX_PREFILL_EMAIL);

  if (email) {
    params.set("email", email);
  }
  if (!name) {
    return;
  }
  if (provider === "calendly") {
    params.set("name", name);
    return;
  }
  const { firstName, lastName } = splitPrefillName(name);
  if (firstName) {
    params.set("firstName", firstName);
  }
  if (lastName) {
    params.set("lastName", lastName);
  }
}

/**
 * The URL to put in the iframe's src, or undefined when there is nothing safe to
 * frame.
 *
 * RE-VALIDATES THE HOST. This is enforcement point 2 from the module header and
 * the reason the component never touches config.scheduling.url directly.
 *
 * Everything it adds beyond the prefill is embed plumbing the providers document
 * for a bare iframe URL: no widget script, no third-party JavaScript on the share
 * page, and therefore no script-src entry for either provider in the CSP.
 */
export function buildSchedulingEmbedUrl(
  rawUrl: unknown,
  provider: SchedulingProvider,
  { prefill, embedDomain }: SchedulingEmbedOptions = {}
): string | undefined {
  const validated = sanitizeSchedulingUrl(rawUrl, provider);
  if (!validated) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(validated);
  } catch {
    return undefined;
  }

  if (provider === "calendly") {
    url.searchParams.set("embed_type", "Inline");
    // Calendly gates its postMessage on this. Without it the widget still books
    // meetings and we simply never hear about it.
    const domain = usableValue(embedDomain, 253);
    if (domain) {
      url.searchParams.set("embed_domain", domain);
    }
    // The overlay already sits under this page's own consent surface; a second
    // cookie banner inside a 400px rectangle is unreadable and unactionable.
    url.searchParams.set("hide_gdpr_banner", "1");
  } else {
    url.searchParams.set("embed", "true");
  }

  applyPrefill(url.searchParams, provider, prefill);

  return url.toString();
}

// --- Booking callback ------------------------------------------------------

/**
 * The exact origin a message from this embed must have arrived from.
 *
 * The origin of the VALIDATED URL, not a constant and not a wildcard: an owner on
 * acme.calendly.com gets that origin and nothing else, so a message from any
 * other frame on the page — including another allow-listed provider — is ignored.
 * Returns undefined for anything unvalidatable, which reads as "trust no origin".
 */
export function schedulingEmbedOrigin(
  rawUrl: unknown,
  provider: SchedulingProvider
): string | undefined {
  const validated = sanitizeSchedulingUrl(rawUrl, provider);
  if (!validated) {
    return undefined;
  }
  try {
    return new URL(validated).origin;
  } catch {
    return undefined;
  }
}

/**
 * Does this message body mean "the viewer booked a meeting"?
 *
 * CALLERS MUST CHECK THE ORIGIN FIRST — event.origin === schedulingEmbedOrigin(…).
 * This function inspects a payload that any page on the internet can postMessage
 * at us, and on its own it proves nothing.
 *
 * CALENDLY is documented and reliable: the embed posts
 * { event: "calendly.event_scheduled" } to a parent it was given an embed_domain
 * for.
 *
 * HUBSPOT IS NOT. There is no supported success message for the bare meetings
 * iframe; the shape matched below is observed behaviour that HubSpot may change
 * without notice, so a HubSpot booking may simply not produce a meeting_booked
 * event. That gap is real, it is documented in the README rather than papered
 * over, and NOTHING DOWNSTREAM MAY TREAT ABSENCE OF THIS EVENT AS PROOF THAT NO
 * MEETING WAS BOOKED.
 */
export function isSchedulingBookedMessage(provider: SchedulingProvider, data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  if (provider === "calendly") {
    return body.event === "calendly.event_scheduled";
  }
  return body.meetingBookSucceeded === true || body.event === "meetingBookSucceeded";
}
