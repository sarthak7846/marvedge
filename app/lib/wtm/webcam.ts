// Shared webcam-bubble defaults + validation for WTM (WTM-6.4).
//
// The sibling of app/lib/wtm/watermark.ts, and deliberately shaped the same way:
// the Branding panel seeds and edits `Demo.editing.wtm.webcam` with these numbers
// and the server re-validates whatever the client sends before the compositor
// sees it. Shared primitives (position validation, clamping, gs:// → https)
// come from watermark.ts rather than being duplicated here.
//
// This module is isomorphic (no env, no node/browser APIs) so it can be imported
// from a client component and from a route handler alike.

import type { WebcamOverlay } from "@/app/types/wtm";

import { clampNumber, isWtmPosition, toHttpsUrl } from "./watermark";

/**
 * The baseline camera bubble: a mid-sized circle in the bottom-LEFT corner,
 * which keeps it clear of the bottom-right watermark. No `sourceUrl` → nothing
 * was recorded, and the compositor degrades to returning the source unchanged.
 */
export const DEFAULT_WEBCAM: WebcamOverlay = {
  enabled: true,
  position: "bl",
  size: 0.28,
  shape: "circle",
};

/** Bubble diameter as a fraction of the output height. */
export const WTM_WEBCAM_SIZE_MIN = 0.05;
export const WTM_WEBCAM_SIZE_MAX = 0.6;

/**
 * Validate + clamp a webcam overlay coming from the client (or from a demo's
 * persisted `editing.wtm`). `enabled: false` is preserved — that is a user who
 * recorded a camera clip and then turned the bubble off, not a missing value.
 * Returns undefined for anything that isn't an object, so callers can treat "no
 * config" distinctly from "disabled".
 */
export function sanitizeWebcamConfig(raw: unknown): WebcamOverlay | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const w = raw as Record<string, unknown>;
  const sourceUrl =
    typeof w.sourceUrl === "string" && w.sourceUrl.trim().length > 0
      ? toHttpsUrl(w.sourceUrl.trim())
      : undefined;
  return {
    enabled: Boolean(w.enabled),
    ...(sourceUrl ? { sourceUrl } : {}),
    position: isWtmPosition(w.position) ? w.position : DEFAULT_WEBCAM.position,
    size: clampNumber(w.size, WTM_WEBCAM_SIZE_MIN, WTM_WEBCAM_SIZE_MAX, DEFAULT_WEBCAM.size),
    // v1 is circle-only (PRD §6.4); the field stays for future shapes.
    shape: "circle",
  };
}
