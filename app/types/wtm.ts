// Shared types for WTM (Automated Video Watermarking & Compositing).
//
// All WTM state is persisted inside the existing Demo.editing JSON under a
// `wtm` key (Demo.editing.wtm) — there is no dedicated table or migration.
// Downstream stages degrade gracefully when parts are absent (no watermark
// config → free-tier default only, or off when the feature is disabled), so
// every field on WtmState is optional.

/** Which corner an overlay is anchored to. */
export type WtmPosition = "br" | "bl" | "tr" | "tl";

/**
 * Watermark configuration persisted to Demo.editing.wtm.watermark.
 *
 * `assetUrl` absent → the worker falls back to the bundled Marvedge badge.
 * `opacity` is 0–1; `scale` is the fraction of the output height the badge
 * occupies (e.g. 0.08 ≈ 8%). The plan gate (see app/lib/wtm/access.ts) decides
 * whether a user may customize `assetUrl`/`opacity` or set `enabled: false`;
 * FREE/anon users always get the forced default regardless of this config.
 */
export interface WatermarkConfig {
  enabled: boolean;
  assetUrl?: string;
  opacity: number;
  position: WtmPosition;
  scale: number;
}

/**
 * Circular webcam bubble overlay. Forward-compat only — WTM-6.4 is deferred
 * pending a product decision on where webcam footage comes from, so this type
 * exists to shape the state without any UI or pipeline in the active PRs.
 */
export interface WebcamOverlay {
  enabled: boolean;
  sourceUrl?: string;
  position: WtmPosition;
  size: number;
  shape: "circle";
}

/** The complete WTM state stored under Demo.editing.wtm. */
export interface WtmState {
  watermark?: WatermarkConfig;
  /** Deferred (WTM-6.4); shaped for forward-compat, no UI/pipeline yet. */
  webcam?: WebcamOverlay;
}
