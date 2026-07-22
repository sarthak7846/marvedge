// Shared watermark defaults + validation for WTM.
//
// Both ends of the feature need the same numbers and the same notion of a
// "valid" config: the Branding panel seeds and edits `Demo.editing.wtm.watermark`
// with them, and app/api/jobs/create/route.ts re-validates whatever the client
// sends before it reaches the worker. Keeping them here stops the two from
// drifting — the client copy is a convenience, the server copy is the authority.
//
// This module is isomorphic (no env, no node/browser APIs) so it can be imported
// from a client component and from a route handler alike.

import type { WatermarkConfig, WtmPosition } from "@/app/types/wtm";

/** The four corners a watermark can be anchored to, in UI order. */
export const WTM_POSITIONS: readonly WtmPosition[] = ["tl", "tr", "bl", "br"];

/** Human labels for the corner picker. */
export const WTM_POSITION_LABELS: Record<WtmPosition, string> = {
  tl: "Top left",
  tr: "Top right",
  bl: "Bottom left",
  br: "Bottom right",
};

/**
 * The baseline watermark: a small, semi-transparent Marvedge badge in the
 * bottom-right. This is exactly what FREE/anonymous exports are forced to use,
 * and what a PRO user's config starts from before they customize it. No
 * `assetUrl` → the worker falls back to its bundled default badge.
 */
export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: true,
  opacity: 0.55,
  position: "br",
  scale: 0.08,
};

/** Bounds the render engine also clamps to (see cloudrun-worker/render.js). */
export const WTM_OPACITY_MIN = 0;
export const WTM_OPACITY_MAX = 1;
export const WTM_SCALE_MIN = 0.01;
export const WTM_SCALE_MAX = 0.5;

export function isWtmPosition(value: unknown): value is WtmPosition {
  return typeof value === "string" && (WTM_POSITIONS as readonly string[]).includes(value);
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/** gs:// URLs are not fetchable by the worker's http(s) downloader. */
export function toHttpsUrl(url: string): string {
  return url.startsWith("gs://") ? url.replace("gs://", "https://storage.googleapis.com/") : url;
}

/**
 * Validate + clamp a watermark config coming from the client (or from a demo's
 * persisted `editing.wtm`). `enabled: false` is preserved — that is a PRO user
 * removing the watermark entirely, not a missing value. Returns undefined for
 * anything that isn't an object, so callers can treat "no config" distinctly
 * from "disabled".
 */
export function sanitizeWatermarkConfig(raw: unknown): WatermarkConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const w = raw as Record<string, unknown>;
  const assetUrl =
    typeof w.assetUrl === "string" && w.assetUrl.trim().length > 0
      ? toHttpsUrl(w.assetUrl.trim())
      : undefined;
  return {
    enabled: Boolean(w.enabled),
    ...(assetUrl ? { assetUrl } : {}),
    opacity: clampNumber(w.opacity, WTM_OPACITY_MIN, WTM_OPACITY_MAX, DEFAULT_WATERMARK.opacity),
    position: isWtmPosition(w.position) ? w.position : DEFAULT_WATERMARK.position,
    scale: clampNumber(w.scale, WTM_SCALE_MIN, WTM_SCALE_MAX, DEFAULT_WATERMARK.scale),
  };
}
