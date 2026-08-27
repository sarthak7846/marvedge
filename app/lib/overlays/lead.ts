// The lead submission wire format, and the two cheap bot checks that guard it.
//
// ONE SCHEMA, IMPORTED BY BOTH SIDES. The form builds its body from this and the
// route validates against it, so "the form sends a field the route ignores" is
// not a state this feature can reach. Same reasoning as ./events: a drifted copy
// of a contract fails silently, and a lead that silently fails to save is the
// most expensive kind of bug this PR can ship.
//
// PII NOTE FOR EVERY READER OF THIS FILE: `name`, `email` and `companySize` are
// personal data belonging to someone who is not our user. They may be validated,
// stored and (in PR 4) forwarded. They MAY NOT be logged, echoed in an error
// message, or put in a thrown Error — not on the client, not on the server. The
// precedent is app/api/views/route.ts, which logs literals only.

import { z } from "zod";

import { COMPANY_SIZE_BUCKETS } from "./leadGate";
import { MAX_EMAIL_LENGTH } from "./email";

// --- Bot defence -----------------------------------------------------------

/**
 * Name of the hidden field that must arrive empty.
 *
 * Named like something a form filler wants to complete rather than `honeypot`,
 * and rendered off-screen with `aria-hidden` and `tabIndex={-1}` so no human and
 * no screen reader is ever offered it. A submission that fills it in was not
 * made by a person.
 */
export const HONEYPOT_FIELD = "companyWebsite";

/**
 * Floor on how long a real person takes to read a consent sentence, type an
 * address and tick a box. 1.5s is well under any genuine fill and well over a
 * script's.
 */
export const MIN_TIME_ON_FORM_MS = 1500;

/** True when the hidden field arrived with anything in it. */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * True when the submission arrived implausibly fast after the form opened.
 *
 * FAILS OPEN ON A WEIRD CLOCK, deliberately. `formOpenedAt` is a client
 * timestamp, so a device with a skewed clock produces a negative or an absurd
 * elapsed time — and a lead form that rejects everyone whose laptop clock is
 * wrong is a worse bug than the bots it would have stopped. Only a small
 * positive elapsed, which is the actual bot signature, is rejected.
 *
 * Like the honeypot this is a speed bump, not a security control: anyone who
 * reads the page can send whatever timestamp they like. Both are here because
 * they are free and stop scripted form-fillers, not because they stop a
 * determined attacker. Rate limiting is the thing that bounds the damage.
 */
export function isTooFastSubmission(formOpenedAt: unknown, now: number): boolean {
  if (typeof formOpenedAt !== "number" || !Number.isFinite(formOpenedAt)) {
    return false;
  }
  const elapsed = now - formOpenedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return false;
  }
  return elapsed < MIN_TIME_ON_FORM_MS;
}

// --- Schema ----------------------------------------------------------------

/** Bounds on the stored strings, so a row cannot be grown without limit. */
export const MAX_LEAD_NAME_LENGTH = 120;
const MAX_REFERRER_LENGTH = 512;
const MAX_CONSENT_LENGTH = 500;

/**
 * What POST /api/v3/leads accepts.
 *
 * `consent` is `z.literal(true)` rather than a boolean: a submission without a
 * ticked box is not a lead we are allowed to keep, so it is rejected by the
 * schema rather than by a check someone could later forget to write. The form
 * refuses to submit without it too — this is the second of the two, not the
 * only one.
 *
 * `positionSec` rides along so the lead_submitted event this produces lands at
 * the right point in the funnel; it is telemetry, not lead data.
 */
export const leadSubmissionSchema = z.object({
  demoId: z.string().min(1).max(64),
  name: z.string().max(MAX_LEAD_NAME_LENGTH).optional(),
  email: z.string().min(3).max(MAX_EMAIL_LENGTH),
  companySize: z.enum(COMPANY_SIZE_BUCKETS).optional(),
  consent: z.literal(true),
  /** The EXACT consent sentence that was on screen. See leadConsentText(). */
  consentText: z.string().max(MAX_CONSENT_LENGTH).optional(),
  referrer: z.string().max(MAX_REFERRER_LENGTH).optional(),
  positionSec: z.number().finite().nonnegative().max(86400).optional(),
  /** Client epoch ms when the form was rendered; see isTooFastSubmission(). */
  formOpenedAt: z.number().finite().optional(),
  [HONEYPOT_FIELD]: z.string().max(200).optional(),
});

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

export type ParsedLead =
  | { ok: true; lead: LeadSubmission }
  | { ok: false; reason: "not_json" | "invalid_shape" };

/**
 * Parse a raw request body into a submission.
 *
 * Never throws, and NEVER RETURNS THE OFFENDING INPUT — not the zod issues,
 * which can quote the value that failed, and not the parsed body. The route has
 * to answer without describing what it saw, because what it saw is someone's
 * email address.
 */
export function parseLeadSubmission(rawBody: string): ParsedLead {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const parsed = leadSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_shape" };
  }
  return { ok: true, lead: parsed.data };
}
