// Work-email validation for the lead gate.
//
// THE DENY-LIST IS DATA, NOT LOGIC. It is an exported const array at the top of
// this file so that adding a domain is a one-line data edit that needs no
// thought about matching rules, and so the list can be read by a human deciding
// whether a support complaint ("it rejected my address") is a bug or the
// feature working. A regex buried in the form component would be neither.
//
// Isomorphic and pure, like the rest of app/lib/overlays/: the same function
// runs in the browser to show inline validation and in /api/v3/leads to enforce
// it, so the form and the route cannot disagree about what a work address is.
//
// ENFORCEMENT IS PER-DEMO AND OFF BY DEFAULT (LeadGateConfig.requireWorkEmail).
// A free-mail address is a real lead for plenty of businesses — a consultant, a
// sole trader, someone who simply prefers not to hand over their work address —
// and rejecting one by default would silently lose those leads for every owner
// who never opened the setting.

/**
 * Free consumer-mail and common disposable domains.
 *
 * Matched against the full domain OR any parent of it (see isDeniedDomain), so
 * `mail.gmail.com` is denied along with `gmail.com`. Sorted by family, and
 * deliberately conservative: a domain that is merely *cheap* is not on here,
 * only ones where an address is either a personal consumer account or a
 * throwaway. Extending it is a data edit — append and move on.
 */
export const FREE_EMAIL_DOMAINS: readonly string[] = [
  // Google
  "gmail.com",
  "googlemail.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "yahoo.fr",
  "yahoo.de",
  "ymail.com",
  "rocketmail.com",
  // Microsoft
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Proton
  "proton.me",
  "protonmail.com",
  "pm.me",
  // Other consumer mail
  "aol.com",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "mail.com",
  "mail.ru",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "inbox.com",
  "fastmail.com",
  "hushmail.com",
  "rediffmail.com",
  "qq.com",
  "163.com",
  "126.com",
  "naver.com",
  // Common disposable / throwaway
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mintemail.com",
  "spamgourmet.com",
  "moakt.com",
  "emailondeck.com",
];

const DENIED = new Set(FREE_EMAIL_DOMAINS);

/**
 * Upper bound on a whole address. 254 is the practical RFC 5321 limit for a
 * path; anything longer is not an address anyone typed.
 */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Deliberately loose. This is a lead form, not a mail server: the job is to
 * catch a typo and an obvious junk string, not to implement RFC 5322 — a
 * validator strict enough to be "correct" reliably rejects real addresses, and
 * the only address that matters is one a human can actually receive mail at.
 *
 * Requires: a non-empty local part with no whitespace or `@`, a single `@`, a
 * dotted domain whose labels are alphanumeric-with-hyphens, and a TLD of at
 * least two letters.
 */
const EMAIL_PATTERN = /^[^\s@]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Normalize an address for comparison: trimmed and lowercased.
 *
 * Returns "" for anything that is not a string, so every caller below can treat
 * the result as a string without a second type check. Note this does NOT strip
 * gmail-style `+tag` or dots — those change nothing about deliverability and
 * rewriting a viewer's own address before storing it would be surprising.
 */
export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** The domain part of a normalized address, or "" when there is not one. */
export function emailDomain(value: unknown): string {
  const normalized = normalizeEmail(value);
  const at = normalized.lastIndexOf("@");
  return at === -1 ? "" : normalized.slice(at + 1);
}

/** Syntactically plausible and within the length bound. */
export function isValidEmail(value: unknown): boolean {
  const normalized = normalizeEmail(value);
  if (normalized.length === 0 || normalized.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  return EMAIL_PATTERN.test(normalized);
}

/**
 * Is `domain` on the deny-list, or a subdomain of something on it?
 *
 * Full-label matching walked up the domain, never `endsWith("gmail.com")` and
 * never `includes()`. The naive suffix test waves through `notgmail.com`, and
 * the substring test waves through `gmail.com.evil.example` — the same
 * look-alike trap app/lib/share/qrTarget.ts documents for host allow-listing,
 * inverted. Here a miss is a lead that should have been rejected rather than a
 * security hole, but the discipline is the same and costs nothing.
 */
export function isDeniedDomain(domain: string): boolean {
  if (domain.length === 0) {
    return false;
  }
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (DENIED.has(labels.slice(i).join("."))) {
      return true;
    }
  }
  return false;
}

/**
 * A syntactically valid address that is not on a free/disposable provider.
 *
 * Only consulted when the demo's LeadGateConfig.requireWorkEmail is on. An
 * invalid address is not a work address either, so a caller enforcing this rule
 * needs one check rather than two — but a caller that is NOT enforcing it still
 * has to call isValidEmail() itself.
 */
export function isWorkEmail(value: unknown): boolean {
  if (!isValidEmail(value)) {
    return false;
  }
  return !isDeniedDomain(emailDomain(value));
}
