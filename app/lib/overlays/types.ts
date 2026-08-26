// The shape of an overlay configuration, shared by the public player, the API
// routes and the editor panel.
//
// This module is TYPES ONLY and, like the rest of app/lib/overlays/, it is
// isomorphic: no DOM, no node builtins, no `process.env` (that lives in
// flags.ts alone). One definition serves a React component, a route handler and
// the editor, which is the only way the three stay in agreement.
//
// A note on `enabled`. There are two levels of it and they mean different
// things. `OverlayConfig.enabled` is the master switch for the whole overlay
// layer on a demo (and is the `VideoOverlayConfig.enabled` COLUMN, so it can be
// filtered on in SQL). Each section carries its own `enabled` as well, so an
// owner can run a lead gate without branch cards. The public read path is
// therefore TOTAL — sanitizeOverlayConfig() always returns all three sections
// fully populated, and the player never has to null-check a section before
// reading it.

/** Hard = the video will not continue until the form is submitted. */
export type LeadGateMode = "hard" | "soft";

/**
 * When the gate appears. "start" is before the first frame, "mid" is halfway
 * through the video's duration (resolved at play time, because duration is not
 * known until metadata loads), and `{ sec }` is an explicit offset in seconds.
 */
export type LeadGateTrigger = "start" | "mid" | { sec: number };

/** Which inputs the form renders. `email` is not optional — it is the lead. */
export interface LeadGateFields {
  name: boolean;
  email: boolean;
  companySize: boolean;
}

export interface LeadGateCopy {
  heading: string;
  subheading: string;
  submitLabel: string;
  /** Only rendered in "soft" mode; a hard gate has nothing to skip to. */
  skipLabel: string;
}

export interface LeadGateConfig {
  enabled: boolean;
  mode: LeadGateMode;
  triggerAt: LeadGateTrigger;
  fields: LeadGateFields;
  /** Rejects free-mail domains (gmail, yahoo, …) client- and server-side. */
  requireWorkEmail: boolean;
  copy: LeadGateCopy;
  /**
   * The consent sentence shown next to the checkbox. `{owner}` is substituted
   * with the demo owner's name at render time. Whatever string ends up on
   * screen is what gets copied into `Lead.consentText`, so a later reword can
   * never retroactively misrepresent an existing consent.
   */
  consentText: string;
  /** Absolute URL of the privacy policy linked under the consent line. */
  privacyPolicyUrl: string;
}

/**
 * Where a branch card sends the viewer. EXACTLY TWO VARIANTS, deliberately.
 *
 * A "Marvedge V2 interactive demo" is a public Demo share link, so `demo` is
 * resolved through hubShareUrl() at render time and stays on whatever domain
 * the viewer is already on (including a customer's own). `url` is an arbitrary
 * external destination and is host-sanitised.
 *
 * There is NO `tutorial` variant and one must not be added here: Tutorial/Slide
 * has an API and a recorder but no viewer page, so such a card would route the
 * viewer at a 404. If that viewer is ever built, a third variant is a contained
 * change — adding it before then is not.
 */
export type BranchTarget = { kind: "demo"; demoId: string } | { kind: "url"; href: string };

export interface BranchCard {
  label: string;
  description: string;
  target: BranchTarget;
}

export interface BranchingConfig {
  enabled: boolean;
  /**
   * How many seconds before the end the two cards appear. Named for the offset
   * from the END of the video, not a position from the start.
   */
  leadSeconds: number;
  a: BranchCard;
  b: BranchCard;
}

export type SchedulingProvider = "calendly" | "hubspot";

export interface SchedulingConfig {
  enabled: boolean;
  provider: SchedulingProvider;
  /** Must be on the provider's allow-listed host; see config.ts. */
  url: string;
  /** Pass a captured lead's name/email into the booking widget's prefill. */
  prefill: boolean;
}

export interface OverlayConfig {
  enabled: boolean;
  leadGate: LeadGateConfig;
  branching: BranchingConfig;
  scheduling: SchedulingConfig;
}
