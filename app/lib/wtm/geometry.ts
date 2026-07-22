// Shared overlay geometry for WTM — one definition of "which corner does an
// overlay sit in, how far from the edge, and how big is it".
//
// The editor's WYSIWYG preview (app/(signed)/editor/components/WtmPreviewOverlay.tsx)
// draws the watermark and the camera bubble in DOM/CSS, while the real output is
// baked in by ffmpeg. Preview only equals export if both use the same numbers,
// so they live here rather than being written out twice:
//
//   - watermark — cloudrun-worker/render.js: `watermarkOverlayXY`, margin
//     `round(H * 15 / 1080)`, badge height `H * scale`, width auto.
//   - camera bubble — cloudrun-worker/server.js: `bubbleOverlayXY`, margin
//     `round(H * 25 / 1080)`, diameter `H * size`.
//
// Both renderers size everything against the OUTPUT HEIGHT, so an overlay keeps
// its relative size and inset at any resolution. Change a number here and the
// matching worker constant must move with it.
//
// This module is isomorphic (no env, no node/browser APIs).

import type { WtmPosition } from "@/app/types/wtm";

/** The output height the pixel margins below are quoted at. */
export const WTM_GEOMETRY_REFERENCE_HEIGHT = 1080;

/** Watermark inset from the frame edge, in px at 1080p (render.js). */
export const WTM_WATERMARK_MARGIN_PX = 15;

/** Camera-bubble inset from the frame edge, in px at 1080p (server.js). */
export const WTM_WEBCAM_MARGIN_PX = 25;

/**
 * A pixel margin quoted at 1080p, re-expressed as a fraction of the output
 * height — the form the preview needs, since it has no pixel height to work
 * from until layout.
 */
export function marginFraction(marginPx: number): number {
  return marginPx / WTM_GEOMETRY_REFERENCE_HEIGHT;
}

/** CSS box offsets for one corner. Only the two relevant edges are set. */
export interface CornerOffsets {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * The CSS equivalent of the workers' ffmpeg `overlay=x:y` corner expressions,
 * for a container whose box is the output frame. `br` → `W-w-m : H-h-m` anchors
 * the overlay's right/bottom edges `m` from the frame's, which is exactly
 * `right: m; bottom: m` — and so on for the other three corners.
 */
export function cornerOffsets(position: WtmPosition, margin: string): CornerOffsets {
  switch (position) {
    case "tl":
      return { top: margin, left: margin };
    case "tr":
      return { top: margin, right: margin };
    case "bl":
      return { bottom: margin, left: margin };
    case "br":
    default:
      return { bottom: margin, right: margin };
  }
}
