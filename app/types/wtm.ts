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
 * Circular webcam bubble overlay persisted to Demo.editing.wtm.webcam.
 *
 * `sourceUrl` is the webcam clip captured alongside the screen recording (see
 * app/hooks/useScreenRecorder.ts) and uploaded with `kind: "webcam-source"`;
 * absent → nothing was recorded and the compositor is a no-op. `size` is the
 * bubble diameter as a fraction of the output height (0.28 ≈ 28%). Capture is
 * free for everyone — the PRO gate (app/lib/wtm/access.ts) is enforced server
 * side when the bubble is composited into the export.
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
  /** Circular webcam bubble (WTM-6.4). Absent until a camera clip is captured. */
  webcam?: WebcamOverlay;
}
