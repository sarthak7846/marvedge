// Lead → a provider-neutral contact record.
//
// PURE AND TESTED, on purpose. This is where lead data quietly gets mangled: a
// name split on the wrong rule puts "van der Berg" in the wrong column of
// somebody's CRM forever, and nobody notices until a customer complains about
// their mail merge. Keeping it here means the rule is one readable function with
// a test file next to it, rather than three slightly different splits inside
// three provider modules.
//
// No `fetch`, no node builtins, no Prisma types — the provider modules and the
// tests both call this, and a "test a connection" button builds a synthetic
// input by hand.

import type { CompanySize } from "../overlays/leadGate";

export interface NormalizeInput {
  email: string;
  name: string | null | undefined;
  companySize: string | null | undefined;
  referrer: string | null | undefined;
  createdAt: Date;
  demoId: string;
  demoTitle: string | null | undefined;
  /** Absolute share URL of the demo, when one can be built. */
  demoUrl: string | null | undefined;
  consentText: string | null | undefined;
  consentAt: Date | null | undefined;
}

export interface NormalizedContact {
  email: string;
  firstName: string;
  lastName: string;
  /** The name exactly as the viewer typed it, whitespace-collapsed. */
  fullName: string;
  /** One of COMPANY_SIZE_BUCKETS, or null. Never free text. */
  companySize: CompanySize | string | null;
  /** Best-effort company name; see companyFromEmail(). */
  company: string;
  referrer: string | null;
  demoId: string;
  demoTitle: string | null;
  demoUrl: string | null;
  /** ISO 8601. Providers want a string; a Date would serialise differently. */
  submittedAt: string;
  consentText: string | null;
  consentAt: string | null;
  /** What every provider writes into its "lead source" field. */
  source: string;
}

/** Written into HubSpot `hs_lead_status`-adjacent fields and Salesforce `lead_source`. */
export const LEAD_SOURCE = "Marvedge";

/** Salesforce requires Lead.Company; this is what it gets when nothing better exists. */
export const UNKNOWN_COMPANY = "Unknown";

/**
 * THE NAME-SPLITTING RULE, written out because it is the part that silently
 * mangles data:
 *
 *   ""            → { first: "",        last: ""            }
 *   "Ada"         → { first: "Ada",     last: ""            }
 *   "Ada Lovelace"→ { first: "Ada",     last: "Lovelace"    }
 *   "Ada B King"  → { first: "Ada",     last: "B King"      }
 *
 * FIRST TOKEN IS THE FIRST NAME, EVERYTHING AFTER IT IS THE LAST NAME. Not
 * "last token is the surname" — that rule turns "María del Carmen García" into
 * a last name of "García" and a first name of "María del Carmen", and turns
 * "Jan van der Berg" into a last name of "Berg", which is wrong in a way that is
 * hard to unpick later. Keeping the tail together is wrong less often, and when
 * it is wrong it is recoverably wrong.
 *
 * A single token becomes the FIRST name with an empty last name, which matters
 * for HubSpot (both properties are optional) and is handled explicitly for
 * Salesforce (Web-to-Lead requires `last_name`) in ./salesforce.ts.
 *
 * Whitespace is any unicode whitespace run, so a tab-separated or
 * ideographic-space name splits the same way. The tokens themselves are never
 * transformed — no case folding, no transliteration, no stripping of
 * combining marks. What the viewer typed is what the CRM gets.
 */
export function splitName(full: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const collapsed = collapseWhitespace(full);
  if (collapsed.length === 0) {
    return { firstName: "", lastName: "" };
  }
  const spaceAt = collapsed.indexOf(" ");
  if (spaceAt === -1) {
    return { firstName: collapsed, lastName: "" };
  }
  return {
    firstName: collapsed.slice(0, spaceAt),
    lastName: collapsed.slice(spaceAt + 1),
  };
}

/** Trim, and collapse any run of whitespace to a single space. */
export function collapseWhitespace(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Best-effort company name from a work address.
 *
 * The lead form does not ask for a company (three fields is already the most a
 * gate can ask for before completion falls off a cliff), but Salesforce
 * Web-to-Lead REQUIRES Lead.Company and will reject a submission without it. The
 * email domain is the honest answer for a work address — `ada@acme.com` really
 * is at acme.com — so that is what goes in, with the public suffix left on so it
 * is obviously derived rather than looking like a curated company name.
 *
 * A free-mail address (which the gate may allow; see overlays/email.ts) yields
 * the domain too. Guessing "Gmail" would be worse: it would look like a real
 * answer. `UNKNOWN_COMPANY` is used only when there is no domain at all.
 */
export function companyFromEmail(email: string | null | undefined): string {
  if (typeof email !== "string") {
    return UNKNOWN_COMPANY;
  }
  const at = email.lastIndexOf("@");
  if (at === -1) {
    return UNKNOWN_COMPANY;
  }
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain.length > 0 ? domain : UNKNOWN_COMPANY;
}

/** Lead row (or a synthetic test lead) → the record every provider maps from. */
export function normalizeLead(input: NormalizeInput): NormalizedContact {
  const { firstName, lastName } = splitName(input.name);
  const email = collapseWhitespace(input.email).toLowerCase();

  return {
    email,
    firstName,
    lastName,
    fullName: collapseWhitespace(input.name),
    companySize: nullableString(input.companySize),
    company: companyFromEmail(email),
    referrer: nullableString(input.referrer),
    demoId: input.demoId,
    demoTitle: nullableString(input.demoTitle),
    demoUrl: nullableString(input.demoUrl),
    submittedAt: input.createdAt.toISOString(),
    consentText: nullableString(input.consentText),
    consentAt: input.consentAt ? input.consentAt.toISOString() : null,
    source: LEAD_SOURCE,
  };
}

function nullableString(value: string | null | undefined): string | null {
  const trimmed = collapseWhitespace(value);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A one-line summary of where the lead came from, for providers that have a
 * free-text notes field and no structured place to put it. Carries no PII: the
 * demo title and URL are the OWNER's content, not the viewer's.
 */
export function sourceDescription(contact: NormalizedContact): string {
  const parts = [`Captured by Marvedge on demo ${contact.demoTitle ?? contact.demoId}`];
  if (contact.demoUrl) {
    parts.push(contact.demoUrl);
  }
  if (contact.companySize) {
    parts.push(`Company size: ${contact.companySize}`);
  }
  if (contact.referrer) {
    parts.push(`Referrer: ${contact.referrer}`);
  }
  parts.push(`Submitted at ${contact.submittedAt}`);
  return parts.join("\n");
}
