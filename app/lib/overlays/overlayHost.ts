// Which overlay is showing, as a pure function of what is registered.
//
// The rendering half of this lives in
// app/components/player/PlayerOverlayHost.tsx, whose file header carries the
// full contract and transition table that PRs 3, 5 and 6 build against. The
// resolution RULE lives here, apart from React, because "a branch card opened
// while the gate was up" is a state transition that has to be asserted rather
// than clicked through — and the repo has no UI tests to click it through with.

/**
 * The overlay kinds the player knows about, in the order they are allowed to
 * win. Closed on purpose: an overlay whose kind is not in this union has no
 * defined priority relative to the others, and "whichever mounted last" is not
 * a behaviour anyone can reason about at 2am.
 */
export type OverlayKind = "gate" | "scheduler" | "branching";

/**
 * Higher wins. The order encodes what the viewer is in the middle of:
 *
 *   gate (3)       — the owner requires this before the video continues. A hard
 *                    gate is the only overlay that can be the reason the viewer
 *                    cannot proceed at all, so nothing may cover it.
 *   scheduler (2)  — the viewer is actively booking a meeting. Interrupting a
 *                    half-filled booking form to advertise what to watch next
 *                    loses the more valuable action of the two.
 *   branching (1)  — a suggestion at the end of the video. Always the one that
 *                    can afford to wait.
 */
export const OVERLAY_PRIORITY: Record<OverlayKind, number> = {
  gate: 3,
  scheduler: 2,
  branching: 1,
};

export interface OverlaySlot {
  /** Stable per registration; used only to keep React keys and ties stable. */
  id: string;
  kind: OverlayKind;
  /**
   * Blocking overlays disable the control bar behind them (a hard gate). A
   * dismissible one leaves the controls live so the viewer can carry on.
   */
  blocking: boolean;
  /** The registering component's own decision about whether it wants to show. */
  open: boolean;
}

/**
 * Pick the single overlay to render, or null.
 *
 * EXACTLY ONE, ALWAYS. Slots that lose stay registered and stay open — they are
 * not cancelled, just not rendered — so when the winner closes, whatever was
 * waiting underneath is re-resolved on the same pass and appears without its
 * owner having to notice or re-request. That is what makes "a branch card wants
 * to open while the gate is up" a non-event rather than a race.
 *
 * Ties within a kind go to the earliest registration, so the result depends on
 * mount order rather than on the iteration order of a Map that happened to
 * rehash. Two slots of the same kind is not an expected arrangement; this only
 * says that if it happens, it happens the same way every time.
 */
export function resolveActiveOverlay(slots: readonly OverlaySlot[]): OverlaySlot | null {
  let winner: OverlaySlot | null = null;
  for (const slot of slots) {
    if (!slot.open) {
      continue;
    }
    if (winner === null || OVERLAY_PRIORITY[slot.kind] > OVERLAY_PRIORITY[winner.kind]) {
      winner = slot;
    }
  }
  return winner;
}

/**
 * Should the control bar be inert?
 *
 * Only for a blocking overlay. A dismissible one (the scheduler, the branch
 * cards) sits over a video the viewer may still scrub, pause or fullscreen —
 * taking the controls away from them would be a worse experience than the
 * overlay is worth.
 */
export function areControlsLocked(active: OverlaySlot | null): boolean {
  return active !== null && active.blocking;
}

/**
 * Should the video be held paused?
 *
 * True for ANY active overlay, blocking or not. This is the single answer to
 * "what pauses the video": opening an overlay, and nothing else. Scattering
 * pause() calls through the individual overlays is how you end up with a video
 * that resumes underneath a form because two of them disagreed about who owned
 * the playhead.
 */
export function shouldHoldPlayback(active: OverlaySlot | null): boolean {
  return active !== null;
}
