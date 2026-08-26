// Defaults for an overlay config, and the sanitiser that stands between a stored
// row and everything that reads one.
//
// THE CONTRACT: sanitizeOverlayConfig() is TOTAL. It accepts genuinely anything
// — undefined, a string, a number, a hand-edited JSON blob from three schema
// versions ago — and returns a fully-populated OverlayConfig without ever
// throwing. That is not defensive style for its own sake: this runs on an
// unauthenticated public page on every view, and a malformed row must degrade
// to "no overlays" rather than 500 someone's share link.
//
// Both the API route and the editor import it, so the editor previews with the
// exact sanitiser the server enforces on save. The server still re-runs it on
// write — the client's copy is a preview, never the enforcement point.
//
// Isomorphic and dependency-free by design. The URL checks below are ported
// from app/lib/qr/sanitize.ts's toQrTargetUrl() rather than imported from it:
// that module transitively pulls in app/lib/qr/mark.ts, a ~9 KB base64 logo,
// and this file is loaded by the public player where first-frame time is the
// whole point. The host-matching discipline is lifted from
// app/lib/share/qrTarget.ts (which cannot be imported here at all — it reads
// process.env): match a full hostname by equality or a DOT-ANCHORED suffix,
// never includes(), never a bare endsWith(root), both of which wave through the
// look-alike `calendly.com.evil.example`.

import type {
  BranchCard,
  BranchTarget,
  BranchingConfig,
  LeadGateConfig,
  LeadGateFields,
  LeadGateTrigger,
  OverlayConfig,
  SchedulingConfig,
  SchedulingProvider,
} from "./types";

// --- Bounds ----------------------------------------------------------------

/** Seconds before the end of the video that the branch cards appear. */
export const MIN_LEAD_SECONDS = 2;
export const MAX_LEAD_SECONDS = 60;
export const DEFAULT_LEAD_SECONDS = 5;

/** Upper bound on an explicit `{ sec }` gate trigger — 6 hours. */
export const MAX_TRIGGER_SEC = 21600;

/** Longer than any URL the product produces; keeps a stored row bounded. */
const URL_MAX_LENGTH = 512;

/**
 * Caps on the owner-authored strings. These are rendered into a public page, so
 * the bound is about layout and payload size, not about safety — React escapes
 * the content either way.
 */
const MAX = {
  heading: 120,
  subheading: 300,
  buttonLabel: 60,
  consentText: 500,
  cardLabel: 80,
  cardDescription: 200,
  demoId: 64,
} as const;

/**
 * Scheduling hosts that may be framed. Deliberately tiny and deliberately not
 * owner-editable: this is the one place in the feature that puts a third party's
 * document inside our page, and PR 6's CSP `frame-src` is derived from it.
 */
export const SCHEDULING_HOSTS: Record<SchedulingProvider, readonly string[]> = {
  calendly: ["calendly.com"],
  hubspot: ["meetings.hubspot.com"],
};

const SCHEDULING_PROVIDERS: readonly SchedulingProvider[] = ["calendly", "hubspot"];

/** Demo ids are uuid/cuid; anything outside this charset is not one. */
const DEMO_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// --- Defaults --------------------------------------------------------------

/**
 * The default consent sentence. `{owner}` is substituted with the demo owner's
 * name where it is rendered, and the resulting string — not this template — is
 * what gets stored on the Lead.
 */
export const DEFAULT_CONSENT_TEXT =
  "I agree to be contacted about this product, and to my details being shared with {owner}.";

function defaultLeadGate(): LeadGateConfig {
  return {
    enabled: false,
    mode: "soft",
    triggerAt: "mid",
    fields: { name: true, email: true, companySize: false },
    requireWorkEmail: false,
    copy: {
      heading: "Want to see the rest?",
      subheading: "Tell us where to send your results and keep watching.",
      submitLabel: "Continue watching",
      skipLabel: "Maybe later",
    },
    consentText: DEFAULT_CONSENT_TEXT,
    privacyPolicyUrl: "",
  };
}

function defaultBranchCard(label: string): BranchCard {
  return { label, description: "", target: { kind: "url", href: "" } };
}

function defaultBranching(): BranchingConfig {
  return {
    enabled: false,
    leadSeconds: DEFAULT_LEAD_SECONDS,
    a: defaultBranchCard("Option A"),
    b: defaultBranchCard("Option B"),
  };
}

function defaultScheduling(): SchedulingConfig {
  return { enabled: false, provider: "calendly", url: "", prefill: true };
}

/**
 * A demo with no overlay row behaves exactly like this: everything off. Reading
 * it must be indistinguishable from the feature not existing.
 *
 * Constructed fresh by defaultOverlayConfig() everywhere it matters — this
 * export is a frozen reference for reading and comparison only, so no caller can
 * mutate the defaults out from under another.
 */
export function defaultOverlayConfig(): OverlayConfig {
  return {
    enabled: false,
    leadGate: defaultLeadGate(),
    branching: defaultBranching(),
    scheduling: defaultScheduling(),
  };
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = Object.freeze(defaultOverlayConfig());

// --- Primitive readers -----------------------------------------------------
//
// Each returns the fallback rather than throwing, so every path through the
// sanitiser is total.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim().slice(0, maxLength);
}

/** Clamps to [min, max]. NaN and Infinity fall back rather than propagating. */
export function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalize whatever was stored into an http(s) URL, or undefined.
 *
 * Ported from toQrTargetUrl(); see the module header for why it is not imported.
 * Strict about the scheme (`javascript:`, `data:` and friends are rejected
 * outright) and corrective about a bare host (`calendly.com/x` becomes
 * https://calendly.com/x rather than being guessed at). Credentials are refused
 * outright — `https://calendly.com@evil.example/` has a host of evil.example,
 * and no legitimate configured URL carries a userinfo section.
 */
export function toHttpUrl(raw: unknown, { httpsOnly = false } = {}): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > URL_MAX_LENGTH) {
    return undefined;
  }
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && (httpsOnly || parsed.protocol !== "http:")) {
    return undefined;
  }
  if (parsed.hostname.length === 0 || parsed.username || parsed.password) {
    return undefined;
  }
  // Re-serialize from the parsed URL so what is stored is exactly what a browser
  // will resolve — no stray whitespace, no ambiguous escaping.
  return parsed.toString();
}

/**
 * Whether `hostname` is `root` or a subdomain of it.
 *
 * Full-hostname equality or a dot-anchored suffix, never a substring test.
 */
function isHostOrSubdomainOf(hostname: string, root: string): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

/**
 * A scheduling URL on one of `provider`'s allow-listed hosts, or undefined.
 *
 * https only: this URL goes into an <iframe> on a page that may itself be a
 * customer's https domain, and a http frame is blocked as mixed content anyway.
 * Exported because PR 6 validates on render as well as on save — an allow-list
 * enforced only at the write boundary stops being one the moment a row is
 * edited by hand.
 */
export function sanitizeSchedulingUrl(
  raw: unknown,
  provider: SchedulingProvider
): string | undefined {
  const normalized = toHttpUrl(raw, { httpsOnly: true });
  if (!normalized) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return undefined;
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowed = SCHEDULING_HOSTS[provider];
  return allowed.some((root) => isHostOrSubdomainOf(hostname, root)) ? normalized : undefined;
}

/**
 * A branch target, or undefined when it is not usable.
 *
 * The `url` variant is scheme-sanitised but NOT host-allow-listed: it is an
 * owner-chosen outbound destination, exactly like `Cta.url`, which is stored
 * unvalidated today. The allow-list exists for `scheduling` because that one
 * gets FRAMED; a branch card is a link the viewer clicks.
 */
export function sanitizeBranchTarget(raw: unknown): BranchTarget | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  if (raw.kind === "demo") {
    const demoId = typeof raw.demoId === "string" ? raw.demoId.trim() : "";
    if (!demoId || demoId.length > MAX.demoId || !DEMO_ID_PATTERN.test(demoId)) {
      return undefined;
    }
    return { kind: "demo", demoId };
  }
  if (raw.kind === "url") {
    const href = toHttpUrl(raw.href);
    return href ? { kind: "url", href } : undefined;
  }
  // Any other `kind` — including a "tutorial" someone added by hand — is not a
  // target this version knows how to route, so it is dropped rather than guessed.
  return undefined;
}

// --- Section sanitisers ----------------------------------------------------

function sanitizeTrigger(raw: unknown): LeadGateTrigger {
  if (raw === "start" || raw === "mid") {
    return raw;
  }
  if (isRecord(raw) && typeof raw.sec === "number" && Number.isFinite(raw.sec)) {
    return { sec: clamp(raw.sec, 0, MAX_TRIGGER_SEC, 0) };
  }
  return defaultLeadGate().triggerAt;
}

function sanitizeFields(raw: unknown, fallback: LeadGateFields): LeadGateFields {
  const source = isRecord(raw) ? raw : {};
  return {
    name: readBoolean(source.name, fallback.name),
    // Not owner-configurable: the email IS the lead, and a gate that collects
    // no address captures nothing while still interrupting the video.
    email: true,
    companySize: readBoolean(source.companySize, fallback.companySize),
  };
}

export function sanitizeLeadGate(raw: unknown): LeadGateConfig {
  const defaults = defaultLeadGate();
  if (!isRecord(raw)) {
    return defaults;
  }
  const copySource = isRecord(raw.copy) ? raw.copy : {};
  return {
    enabled: readBoolean(raw.enabled, defaults.enabled),
    mode: raw.mode === "hard" || raw.mode === "soft" ? raw.mode : defaults.mode,
    triggerAt: sanitizeTrigger(raw.triggerAt),
    fields: sanitizeFields(raw.fields, defaults.fields),
    requireWorkEmail: readBoolean(raw.requireWorkEmail, defaults.requireWorkEmail),
    copy: {
      heading: readString(copySource.heading, defaults.copy.heading, MAX.heading),
      subheading: readString(copySource.subheading, defaults.copy.subheading, MAX.subheading),
      submitLabel: readString(copySource.submitLabel, defaults.copy.submitLabel, MAX.buttonLabel),
      skipLabel: readString(copySource.skipLabel, defaults.copy.skipLabel, MAX.buttonLabel),
    },
    consentText: readString(raw.consentText, defaults.consentText, MAX.consentText),
    privacyPolicyUrl: toHttpUrl(raw.privacyPolicyUrl) ?? defaults.privacyPolicyUrl,
  };
}

function sanitizeCard(raw: unknown, fallback: BranchCard): BranchCard {
  const source = isRecord(raw) ? raw : {};
  return {
    label: readString(source.label, fallback.label, MAX.cardLabel),
    description: readString(source.description, fallback.description, MAX.cardDescription),
    target: sanitizeBranchTarget(source.target) ?? fallback.target,
  };
}

export function sanitizeBranching(raw: unknown): BranchingConfig {
  const defaults = defaultBranching();
  if (!isRecord(raw)) {
    return defaults;
  }
  const a = sanitizeCard(raw.a, defaults.a);
  const b = sanitizeCard(raw.b, defaults.b);
  // Both targets must have survived sanitisation for the cards to show. A card
  // whose destination was rejected would render as a button that goes nowhere,
  // which is worse than no cards at all — so the section is forced off instead.
  const targetsUsable =
    sanitizeBranchTarget(isRecord(raw.a) ? raw.a.target : undefined) !== undefined &&
    sanitizeBranchTarget(isRecord(raw.b) ? raw.b.target : undefined) !== undefined;
  return {
    enabled: readBoolean(raw.enabled, defaults.enabled) && targetsUsable,
    leadSeconds: clamp(raw.leadSeconds, MIN_LEAD_SECONDS, MAX_LEAD_SECONDS, DEFAULT_LEAD_SECONDS),
    a,
    b,
  };
}

export function sanitizeScheduling(raw: unknown): SchedulingConfig {
  const defaults = defaultScheduling();
  if (!isRecord(raw)) {
    return defaults;
  }
  const provider = SCHEDULING_PROVIDERS.includes(raw.provider as SchedulingProvider)
    ? (raw.provider as SchedulingProvider)
    : defaults.provider;
  const url = sanitizeSchedulingUrl(raw.url, provider);
  return {
    // Same rule as branching: an off-allow-list URL disables the section rather
    // than shipping an empty iframe.
    enabled: readBoolean(raw.enabled, defaults.enabled) && url !== undefined,
    provider,
    url: url ?? defaults.url,
    prefill: readBoolean(raw.prefill, defaults.prefill),
  };
}

// --- Entry point -----------------------------------------------------------

/**
 * Normalize anything into a usable OverlayConfig.
 *
 * Unknown keys are rejected by construction: every field on the result is read
 * individually off the input, so nothing that is not in the type above can
 * survive a round trip. That matters more than it sounds — this object is
 * serialized straight into a public page, and a passthrough would let a stale
 * or hand-edited row smuggle arbitrary JSON to the browser.
 */
export function sanitizeOverlayConfig(input: unknown): OverlayConfig {
  try {
    if (!isRecord(input)) {
      return defaultOverlayConfig();
    }
    return {
      enabled: readBoolean(input.enabled, false),
      leadGate: sanitizeLeadGate(input.leadGate),
      branching: sanitizeBranching(input.branching),
      scheduling: sanitizeScheduling(input.scheduling),
    };
  } catch {
    // Unreachable by construction — every reader above is total. Kept as a hard
    // floor because the caller is a public page and "degrade to no overlays" is
    // always a better outcome than a 500.
    return defaultOverlayConfig();
  }
}

/** The persisted shape: the `enabled` column plus three nullable Json columns. */
export interface OverlayConfigRow {
  enabled: boolean;
  leadGate: unknown;
  branching: unknown;
  scheduling: unknown;
}

/**
 * Read a VideoOverlayConfig row (or the absence of one) into a config.
 *
 * `null` — no row for this demo — is the common case and yields the defaults,
 * so callers never branch on existence.
 */
export function overlayConfigFromRow(row: OverlayConfigRow | null | undefined): OverlayConfig {
  if (!row) {
    return defaultOverlayConfig();
  }
  return sanitizeOverlayConfig({
    enabled: row.enabled,
    leadGate: row.leadGate,
    branching: row.branching,
    scheduling: row.scheduling,
  });
}

/** Split a config back into the columns it is stored in. */
export function overlayConfigToRow(config: OverlayConfig): OverlayConfigRow {
  return {
    enabled: config.enabled,
    leadGate: config.leadGate,
    branching: config.branching,
    scheduling: config.scheduling,
  };
}
