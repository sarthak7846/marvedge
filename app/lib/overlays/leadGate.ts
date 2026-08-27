// The lead gate's decisions, apart from React.
//
// Three things live here: WHEN the gate opens, WHAT the company-size answers may
// be, and WHICH consent string is recorded. All three are the kind of logic that
// is easy to get subtly wrong and impossible to notice in a browser — a gate
// that never fires on a scrubbed video, a bucket that stops matching a CRM
// picklist, a consent record that quietly follows a later reword. So they are
// pure, they are here, and they are tested.
//
// Isomorphic like the rest of app/lib/overlays/: the overlay component, the
// /api/v3/leads route and the editor panel all read the same definitions.

import { crossedThreshold } from "./playback";
import type { LeadGateTrigger } from "./types";

// --- Company size ----------------------------------------------------------

/**
 * The company-size answers, closed.
 *
 * A SELECT WITH FIXED BUCKETS, NOT FREE TEXT, and that is a data decision rather
 * than a UI preference: PR 7 groups leads on this column and PR 4 maps it onto a
 * CRM picklist. Free text would make the first impossible and the second a pile
 * of special cases ("50-100", "~50", "fifty").
 *
 * Bucket boundaries follow the usual B2B segmentation so the mapping in PR 4 is
 * a lookup rather than a judgement call. CHANGING A LABEL IS A DATA MIGRATION —
 * existing Lead rows store the string, so an edited bucket splits one segment
 * into two in every historical report.
 */
export const COMPANY_SIZE_BUCKETS = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1001-5000",
  "5000+",
] as const;

export type CompanySize = (typeof COMPANY_SIZE_BUCKETS)[number];

const COMPANY_SIZE_SET: ReadonlySet<string> = new Set(COMPANY_SIZE_BUCKETS);

export function isCompanySize(value: unknown): value is CompanySize {
  return typeof value === "string" && COMPANY_SIZE_SET.has(value);
}

// --- Trigger ---------------------------------------------------------------

/**
 * Resolve a configured trigger into a position in seconds, or undefined when it
 * cannot be resolved yet.
 *
 *   "start"  → 0. Handled as its own case by gateShouldOpen(), NOT as a crossing:
 *              there is no position before zero to come from.
 *   "mid"    → half the duration, and undefined until metadata has loaded, since
 *              duration is NaN before that and a gate placed at NaN/2 would
 *              never fire.
 *   { sec }  → the offset, CLAMPED INTO THE VIDEO once the duration is known.
 *
 * The clamp is the non-obvious part. An owner who sets 90s on a 60s demo has
 * configured a gate that can never fire, and a gate that silently does nothing
 * is the worst of the available outcomes — they see no leads and no error.
 * Clamping to the duration means it still fires, at the last position that is
 * actually inside their video. It is a correction, not a guess: nothing else
 * about the configuration is changed, and an in-range trigger is untouched.
 */
export function resolveGateTriggerSec(
  triggerAt: LeadGateTrigger,
  duration: number
): number | undefined {
  const durationKnown = Number.isFinite(duration) && duration > 0;

  if (triggerAt === "start") {
    return 0;
  }
  if (triggerAt === "mid") {
    return durationKnown ? duration / 2 : undefined;
  }

  const sec = triggerAt?.sec;
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) {
    return undefined;
  }
  if (sec === 0) {
    return 0;
  }
  return durationKnown ? Math.min(sec, duration) : sec;
}

export interface GateTriggerInput {
  /** From resolveGateTriggerSec(). undefined means "not resolvable yet". */
  triggerSec: number | undefined;
  /** The previously observed playhead position. */
  prevTime: number;
  /** The current playhead position. */
  currentTime: number;
  /** Whether the element is paused right now. */
  paused: boolean;
}

/**
 * Should the gate open on this tick?
 *
 * A CROSSING TEST, NOT A TIMER. A viewer who drags the scrub handle from 0:05
 * past the trigger never has a tick land on it, so a setTimeout at the trigger
 * point would never fire — for exactly the viewer who skipped ahead to the part
 * they cared about. Comparing the previous observed position to this one catches
 * the jump, because the jump passes over the threshold even though nothing
 * landed on it. See crossedThreshold() in ./playback.
 *
 * A trigger at zero is its own case: there is no earlier position to cross from,
 * so it opens on the first sign that the viewer is consuming the video — either
 * playback has started, or they have moved the playhead off zero while paused.
 * With no autoplay (see PlayerOverlayHost.tsx) that is the moment they press
 * play, and the overlay host holds the video at 0.000s before a frame is shown.
 *
 * A backwards seek is not a crossing, so re-watching does not re-fire. This
 * answers "did we just reach it", not "have we ever" — the caller latches.
 */
export function gateShouldOpen({
  triggerSec,
  prevTime,
  currentTime,
  paused,
}: GateTriggerInput): boolean {
  if (triggerSec === undefined) {
    return false;
  }
  if (triggerSec <= 0) {
    return !paused || currentTime > 0;
  }
  return crossedThreshold(prevTime, currentTime, triggerSec);
}

// --- Consent ---------------------------------------------------------------

/**
 * Substituted for `{owner}` when the demo's owner has no usable name. Reads as a
 * sentence in the default copy ("…shared with the sender.") rather than leaving
 * a literal placeholder or an empty gap in front of a viewer.
 */
export const CONSENT_OWNER_FALLBACK = "the sender";

/** Bound on a stored consent string; matches the cap in ./config. */
export const MAX_CONSENT_TEXT_LENGTH = 500;

/**
 * Render the consent sentence that will be shown on screen.
 *
 * `candidates` are tried in order — the demo owner's name, then the hub title,
 * then the fallback — so the caller passes what it has and does not have to
 * write the same chain of `??` at three call sites.
 */
export function renderConsentText(
  template: string,
  ...candidates: (string | null | undefined)[]
): string {
  const owner =
    candidates.map((value) => (typeof value === "string" ? value.trim() : "")).find(Boolean) ??
    CONSENT_OWNER_FALLBACK;
  return template.split("{owner}").join(owner);
}

/**
 * What gets written to Lead.consentText.
 *
 * THE LOAD-BEARING RULE OF THIS WHOLE FEATURE: the string on the lead is the one
 * that was ON SCREEN when the viewer ticked the box — a snapshot, never a
 * reference to the live config. The owner may reword the consent copy tomorrow;
 * that must not change, by one character, what an existing lead is recorded as
 * having agreed to.
 *
 * So the submitted snapshot wins whenever there is one, and `fallback` is only
 * for a client that sent none (an old cached bundle, a hand-made request). It
 * is a snapshot taken at submission time too — the best available answer, not
 * a pointer.
 *
 * The snapshot is client-supplied and therefore forgeable, which is fine and
 * worth being explicit about: consentText authorises nothing, and forging it
 * only corrupts the forger's own consent record. There is no way to get the
 * exact on-screen string other than from the screen it was on.
 */
export function leadConsentText(submitted: unknown, fallback: string): string {
  const snapshot = typeof submitted === "string" ? submitted.trim() : "";
  const chosen = snapshot.length > 0 ? snapshot : fallback.trim();
  return chosen.slice(0, MAX_CONSENT_TEXT_LENGTH);
}
