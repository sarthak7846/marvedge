// The Marvedge QR preset, the size ladder, and the bounds everything is clamped
// to.
//
// Mirrors app/lib/wtm/watermark.ts: one place holds the numbers, so the component
// and the route handler cannot drift apart on what a "default" QR looks like.
// Isomorphic — no env, no node/browser APIs.

import { isQrColor } from "./contrast";
import { MARVEDGE_MARK_DATA_URI } from "./mark";
import type { QrRenderOptions, QrStyle, ResolvedQrOptions } from "./types";

/**
 * Every style the engine can draw, the surfaced one first. This is the validation
 * list and the list the tests iterate — it is NOT a menu. There are deliberately
 * no display labels here, because there is deliberately no style picker.
 */
export const QR_STYLES: readonly QrStyle[] = ["badge", "branded"];

export function isQrStyle(value: unknown): value is QrStyle {
  return typeof value === "string" && (QR_STYLES as readonly string[]).includes(value);
}

/**
 * Deep purple — the colour ShareModal already uses for its headings, so a QR
 * dropped into that modal belongs there. Also the highest-contrast option we
 * have: 15.6:1 on white, which leaves room for camera noise and cheap printing.
 */
export const QR_MODULE_COLOR = "#2D1F61";

/**
 * The brand accent, offered as an alternative rather than assumed: it measures
 * 5.1:1 on white, which clears QR_MIN_CONTRAST_RATIO but with a lot less headroom
 * than the deep purple. Never hardcode a colour without running it through
 * assertQrContrast first.
 */
export const QR_ACCENT_MODULE_COLOR = "#6E5AD8";

/** Bounds the resolver clamps to. */
export const QR_SIZE_MIN = 96;
export const QR_SIZE_MAX = 4096;
/** 4 is the spec minimum and scanners genuinely fail below it. Never lower this. */
export const QR_QUIET_ZONE_MIN = 4;
export const QR_QUIET_ZONE_MAX = 16;
export const QR_CORNER_RADIUS_MIN = 0;
/** Half a module — at which point a module is a full circle. */
export const QR_CORNER_RADIUS_MAX = 0.5;

/**
 * The default QR: deep purple rounded modules on white, the Marvedge mark in a
 * cleared tile at the centre, 4 modules of quiet zone.
 *
 * `style: "badge"` is not a default among equals — it is the one style the product
 * offers. Sharing a demo is not a moment anyone wants to pick a QR aesthetic in, so
 * there is no style toggle anywhere in the UI, and adding one is a product decision
 * rather than a UI improvement.
 *
 * Badge won on mark legibility, not on scannability — both styles decode fine at
 * the 200px a modal shows. In `badge` the mark is solid #2D1F61 and unmistakable;
 * in `branded` it is a 22% tint that reads as a smudge once the URL is long enough
 * to push the code past ~40 modules. Since the point of the feature is that every
 * scan carries the mark, the crisp small mark beats the faint large one.
 */
export const MARVEDGE_QR_PRESET: Omit<ResolvedQrOptions, "url"> = {
  style: "badge",
  size: 512,
  moduleColor: QR_MODULE_COLOR,
  backgroundColor: "#FFFFFF",
  logoDataUri: MARVEDGE_MARK_DATA_URI,
  quietZone: QR_QUIET_ZONE_MIN,
  // 0.28 of a module. Enough to read as rounded at 200px on screen without
  // thinning the modules the way a near-circular radius does.
  cornerRadius: 0.28,
};

/**
 * The three sizes the product actually asks for. `screen` is what a modal shows,
 * `download` what a PNG export produces, `print` what survives being put on a
 * poster or a slide at full bleed.
 */
export const QR_SIZE_PRESETS = {
  screen: 512,
  download: 1024,
  print: 2048,
} as const;

export type QrSizePreset = keyof typeof QR_SIZE_PRESETS;

/** Mirrors clampNumber in app/lib/wtm/watermark.ts. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * Fill in every unset option from the preset and clamp the numerics. Trusted
 * input only — this is the ergonomic path for `renderQrSvg({ url })`. For
 * anything that came off the wire, use sanitizeQrOptions() instead, which also
 * validates the URL and the logo.
 *
 * `logoDataUri` is the one field where "unset" and "empty" differ: undefined
 * means "use the Marvedge mark", an empty string means "draw no mark at all".
 */
export function resolveQrOptions(options: QrRenderOptions): ResolvedQrOptions {
  const logoDataUri =
    options.logoDataUri === undefined ? MARVEDGE_QR_PRESET.logoDataUri : options.logoDataUri;
  return {
    url: options.url,
    style: isQrStyle(options.style) ? options.style : MARVEDGE_QR_PRESET.style,
    size: Math.round(clampNumber(options.size, QR_SIZE_MIN, QR_SIZE_MAX, MARVEDGE_QR_PRESET.size)),
    moduleColor: isQrColor(options.moduleColor)
      ? options.moduleColor
      : MARVEDGE_QR_PRESET.moduleColor,
    backgroundColor: isQrColor(options.backgroundColor)
      ? options.backgroundColor
      : MARVEDGE_QR_PRESET.backgroundColor,
    ...(logoDataUri ? { logoDataUri } : {}),
    quietZone: Math.round(
      clampNumber(
        options.quietZone,
        QR_QUIET_ZONE_MIN,
        QR_QUIET_ZONE_MAX,
        MARVEDGE_QR_PRESET.quietZone
      )
    ),
    cornerRadius: clampNumber(
      options.cornerRadius,
      QR_CORNER_RADIUS_MIN,
      QR_CORNER_RADIUS_MAX,
      MARVEDGE_QR_PRESET.cornerRadius
    ),
  };
}
