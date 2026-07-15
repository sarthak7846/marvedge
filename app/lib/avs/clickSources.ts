// Resolving click timestamps for AVS step auto-slicing.
//
// The auto-zoom feature (#216) ingests Chrome-extension click capture two ways:
//   1. Live, right after recording — raw `ExtensionClickEvent`s posted to the
//      editor and held in the zoom store as `extensionEvents`.
//   2. Persisted — those clicks are turned into `ZoomEffect` auto-zoom segments
//      and saved in `demo.editing.zoom`, so they survive a reload even though
//      the raw events do not.
//
// `deriveSteps` only needs numbers (click seconds), so this module isolates the
// "where do the clicks come from" concern and hands back a clean list.

import type { ZoomEffect } from "@/app/types/editor/zoom-effect";
import type { ExtensionClickEvent } from "@/app/store/editor/zoomStore";

// Auto-zoom segments begin ~0.3s before their originating click (see
// `applyAutoZoomSuggestions` in useZoomEditor). Adding it back recovers an
// approximate click time when only the persisted segments remain.
const ZOOM_LEAD_SECONDS = 0.3;

/**
 * Best-available click timestamps (seconds) for step derivation. Prefers the
 * raw extension events when present (freshly recorded session); otherwise falls
 * back to recovering approximate click times from persisted auto-zoom segments.
 * Returns `[]` when neither source has usable data — callers then get a single
 * full-length step from `deriveSteps`.
 */
export function resolveClickTimes(
  extensionEvents: ExtensionClickEvent[],
  zoomSegments: ZoomEffect[]
): number[] {
  const fromEvents = extensionEvents
    .filter((e) => e.event_type === "click" && e.coordinates)
    .map((e) => e.timestamp_ms / 1000)
    .filter((t) => Number.isFinite(t) && t >= 0);

  if (fromEvents.length > 0) {
    return fromEvents;
  }

  return zoomSegments
    .map((z) => z.startTime + ZOOM_LEAD_SECONDS)
    .filter((t) => Number.isFinite(t) && t >= 0);
}
