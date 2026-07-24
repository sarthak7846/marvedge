// Validation for QR options that came from outside the codebase.
//
// Mirrors sanitizeWatermarkConfig in app/lib/wtm/watermark.ts: clamp the numerics,
// validate the enum against a known list, normalize the URL, and fall back to the
// preset for anything invalid rather than propagating junk. resolveQrOptions() is
// the trusted-input path; this is the one a route handler or a query string goes
// through.
//
// Returns undefined — the same "there is nothing here" signal
// sanitizeWatermarkConfig uses — when the target URL is unusable, because unlike
// a colour or a size there is no sensible preset to fall back to. A QR with no
// destination is not a degraded QR, it is not a QR.

import { isQrColor } from "./contrast";
import { isQrStyle, MARVEDGE_QR_PRESET, resolveQrOptions } from "./presets";
import type { ResolvedQrOptions } from "./types";

/**
 * Longer than any share URL the product produces. The bound is about scanning,
 * not memory: every extra byte pushes the QR to a higher version, and a version
 * 30+ code shown at 200px on a laptop has modules under a pixel wide and will not
 * read from a phone.
 */
export const QR_URL_MAX_LENGTH = 512;

/** Image types allowed in a logo data URI. */
const LOGO_MIME_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Normalize whatever was handed to us into an http(s) URL, or undefined.
 *
 * The analogue of toHttpsUrl() in app/lib/wtm/watermark.ts, but strict rather than
 * corrective: a QR is an instruction a stranger's phone follows, so the only
 * schemes that may be encoded are http and https. `javascript:`, `data:` and
 * friends are rejected outright, and a bare `marvedge.com/share/x` is promoted to
 * https instead of being guessed at.
 *
 * Note this does NOT check the host. Restricting a QR to Marvedge origins is the
 * QR route's job, because only it knows the request's origin (including custom hub
 * domains) — the engine renders whatever URL it is given.
 */
export function toQrTargetUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > QR_URL_MAX_LENGTH) {
    return undefined;
  }
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return undefined;
  }
  if (parsed.hostname.length === 0) {
    return undefined;
  }
  // Re-serialize from the parsed URL so what the QR encodes is exactly what a
  // browser will resolve — no stray whitespace, no ambiguous escaping.
  return parsed.toString();
}

/**
 * A logo data URI, or undefined if it is not one we will draw.
 *
 * Fails closed to the Marvedge mark by way of returning undefined (which
 * resolveQrOptions reads as "use the preset"). Two things are being enforced:
 * the URI must be `data:` — a remote href would taint the canvas the PNG export
 * draws into, and canvas.toBlob() on a tainted canvas throws — and it must be a
 * raster type, because an SVG data URI inside an <image> is a script-carrying
 * document we have no reason to accept.
 */
export function sanitizeQrLogo(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !LOGO_MIME_PATTERN.test(raw)) {
    return undefined;
  }
  return raw;
}

/** Query-string values arrive as strings; clampNumber() rejects the NaNs. */
function toNumeric(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }
  return undefined;
}

/**
 * Validate and clamp an untrusted QR option bag. Undefined when there is no
 * usable URL to encode; otherwise a fully-resolved option set safe to hand to
 * renderQrSvg.
 */
export function sanitizeQrOptions(raw: unknown): ResolvedQrOptions | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const input = raw as Record<string, unknown>;
  const url = toQrTargetUrl(input.url);
  if (!url) {
    return undefined;
  }
  return resolveQrOptions({
    url,
    style: isQrStyle(input.style) ? input.style : undefined,
    size: toNumeric(input.size),
    moduleColor: isQrColor(input.moduleColor) ? input.moduleColor : undefined,
    backgroundColor: isQrColor(input.backgroundColor) ? input.backgroundColor : undefined,
    // A rejected logo falls back to the Marvedge mark, never to no mark: a
    // Marvedge-branded QR should always carry the Marvedge mark.
    logoDataUri: sanitizeQrLogo(input.logoDataUri) ?? MARVEDGE_QR_PRESET.logoDataUri,
    quietZone: toNumeric(input.quietZone),
    cornerRadius: toNumeric(input.cornerRadius),
  });
}
