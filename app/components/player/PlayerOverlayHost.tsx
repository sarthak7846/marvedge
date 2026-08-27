"use client";

// THE OVERLAY SLOT. PRs 3 (lead gate), 5 (branching cards) and 6 (scheduling)
// all register into this and none of them may add a position:absolute layer of
// their own. Read this header before writing one of them.
//
// ============================================================================
// THE CONTRACT
// ============================================================================
//
// 1. EXACTLY ONE OVERLAY IS RENDERED AT A TIME.
//    Priority, highest first: gate > scheduler > branching. Resolution lives in
//    resolveActiveOverlay() in app/lib/overlays/overlayHost.ts, where it is unit
//    tested. Losing a priority contest is not the same as being cancelled — a
//    losing slot stays registered and stays open, and is re-resolved the instant
//    the winner closes.
//
// 2. OPENING AN OVERLAY IS THE ONLY THING ALLOWED TO PAUSE THE VIDEO.
//    This host holds playback for as long as any overlay is active, via
//    actions.holdForOverlay(). NO OVERLAY MAY CALL pause() ITSELF. Two callers
//    of pause() is how you get a video that resumes underneath a form because
//    each of them thought the other had let go.
//
// 3. AN OVERLAY DECLARES WHETHER IT IS BLOCKING.
//    blocking       — the control bar is disabled and covered, keyboard
//                     shortcuts are inert, and the viewer cannot proceed. This
//                     is the hard lead gate.
//    dismissible    — the control bar stays live underneath and the layer is
//                     inset above it, so the viewer can still scrub, pause and
//                     go fullscreen. This is the scheduler and the branch cards.
//
// 4. THE HOST OWNS THE CHROME.
//    Backdrop, positioning, the bottom-sheet-on-mobile / centred-card-on-desktop
//    switch, the dialog role and the focus move all happen in <PlayerOverlay>.
//    An overlay supplies CONTENT ONLY. This is what keeps three separately
//    written overlays from looking like three different products, and it is why
//    a bottom sheet on a phone is automatic rather than something each PR
//    remembers to do.
//
// ============================================================================
// TRANSITION TABLE
// ============================================================================
//
// | What happens                          | Result                                                      |
// |---------------------------------------|-------------------------------------------------------------|
// | Branch card opens while a gate is up   | Gate keeps the layer. The branch slot stays registered and    |
// |                                        | open, renders nothing, and appears by itself when the gate    |
// |                                        | closes — if its own condition still holds. Nothing is queued  |
// |                                        | and nothing is re-requested.                                  |
// | Scheduler opens while a gate is up     | Same: gate wins, scheduler waits.                             |
// | Branch card opens while scheduler is up| Scheduler wins. A half-filled booking form outranks a         |
// |                                        | suggestion about what to watch next.                          |
// | `ended` fires while any overlay is up  | NOTHING CLOSES. `ended` is not an overlay event. The video is  |
// |                                        | already held paused, video_completed is emitted as usual, and  |
// |                                        | the viewer keeps whatever they were in the middle of.          |
// | A gate resolves (submitted or skipped) | Its slot sets open=false. The layer re-resolves on the same    |
// |                                        | pass: a waiting overlay takes over and playback STAYS held; if |
// |                                        | nothing is waiting, the layer clears and playback resumes —    |
// |                                        | but only if the hold is what stopped it and the viewer has not |
// |                                        | pressed pause in the meantime.                                 |
// | Viewer pauses behind a dismissible     | Their pause wins. releaseFromOverlay() will not undo it.       |
// | overlay, then closes it                |                                                               |
// | An overlay unmounts while active       | Identical to closing: unregistered, layer re-resolves,         |
// |                                        | playback released. No overlay can strand a paused video.       |
//
// ============================================================================
// AUTOPLAY POLICY — DECIDED, DO NOT CHANGE CASUALLY
// ============================================================================
//
// THE PLAYER NEVER AUTOPLAYS. Today's share page has no `autoplay` attribute and
// adding one would change behaviour for every existing demo the moment the flag
// flips, which the backward-compatibility criterion forbids. It also removes an
// otherwise nasty interaction: a gate configured to trigger at 0s would race a
// muted autoplay start, and the viewer would get somewhere between zero and a
// few hundred milliseconds of video before the gate slammed shut — a different
// amount on every device, and a free preview of gated content on the fastest
// ones.
//
// With no autoplay the sequence is unambiguous: the viewer presses play, the
// gate opens, the host holds playback at 0.000s, and video_start is not emitted
// because the playhead never moved (see usePlaybackMilestones). If autoplay is
// ever wanted, it must be gated on there being no start-triggered overlay
// registered, and that check belongs here rather than in the overlay.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  areControlsLocked,
  resolveActiveOverlay,
  shouldHoldPlayback,
  type OverlayKind,
  type OverlaySlot,
} from "@/app/lib/overlays/overlayHost";

import type { TelemetryEmitter } from "./useTelemetry";
import type { VideoElementActions, VideoElementState } from "./useVideoElement";

/**
 * Height reserved for the control bar, in px.
 *
 * A dismissible overlay is inset by this much from the bottom so it never
 * covers controls the viewer is still allowed to use. Kept as a number rather
 * than a Tailwind class because it is also the control bar's own min-height —
 * one value, so the two cannot drift into an overlap that is only visible on a
 * phone.
 */
export const CONTROLS_HEIGHT_PX = 68;

export interface PlayerPlayback {
  state: VideoElementState;
  actions: VideoElementActions;
}

export interface PlayerOverlayContextValue {
  /** Read state, call actions. Overlays must not touch the element directly. */
  playback: PlayerPlayback;
  /** Emit into the PR 1 batch envelope. A no-op when the flag is off. */
  telemetry: TelemetryEmitter;
  /** The DOM node overlays portal into; null until the player has mounted. */
  layer: HTMLElement | null;
  activeOverlayId: string | null;
  register(slot: OverlaySlot): void;
  unregister(id: string): void;
}

const PlayerOverlayContext = createContext<PlayerOverlayContextValue | null>(null);

/**
 * Everything an overlay needs. Throws outside a player rather than returning
 * null, because an overlay rendered outside one is a wiring mistake that would
 * otherwise show up as an overlay that silently never appears.
 */
export function usePlayerOverlays(): PlayerOverlayContextValue {
  const value = useContext(PlayerOverlayContext);
  if (!value) {
    throw new Error("usePlayerOverlays must be used inside <MarvedgePlayer>");
  }
  return value;
}

export interface OverlayRegistry {
  active: OverlaySlot | null;
  controlsLocked: boolean;
  /** Attach to the layer element in the player's DOM. */
  setLayerEl: (el: HTMLDivElement | null) => void;
  context: PlayerOverlayContextValue;
}

/**
 * Own the registered slots, resolve the winner, and hold playback while one is
 * up. Called by MarvedgePlayer, which needs `active` for the control bar as well
 * as for the layer, so the state is lifted to the one component that renders
 * both.
 */
export function useOverlayRegistry(
  playback: PlayerPlayback,
  telemetry: TelemetryEmitter
): OverlayRegistry {
  const [slots, setSlots] = useState<OverlaySlot[]>([]);
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const register = useCallback((slot: OverlaySlot) => {
    setSlots((prev) => {
      const index = prev.findIndex((existing) => existing.id === slot.id);
      if (index === -1) {
        // Appended, so registration order is mount order — which is what breaks
        // a same-kind tie deterministically.
        return [...prev, slot];
      }
      const existing = prev[index];
      if (
        existing.kind === slot.kind &&
        existing.blocking === slot.blocking &&
        existing.open === slot.open
      ) {
        // Same descriptor. Returning `prev` unchanged is what stops a re-render
        // loop, since overlays re-register on every render of their own.
        return prev;
      }
      const next = prev.slice();
      next[index] = slot;
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setSlots((prev) => {
      const next = prev.filter((slot) => slot.id !== id);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const active = useMemo(() => resolveActiveOverlay(slots), [slots]);
  const activeId = active?.id ?? null;

  const { holdForOverlay, releaseFromOverlay } = playback.actions;

  // Rule 2, in one place: this effect is the only pause() the overlay system
  // performs. Keyed on the active id so a hand-off from one overlay to another
  // (a gate resolving into a waiting branch card) never releases in between and
  // never lets a frame of video slip through.
  useEffect(() => {
    if (shouldHoldPlayback(active)) {
      holdForOverlay();
    } else {
      releaseFromOverlay();
    }
  }, [active, holdForOverlay, releaseFromOverlay]);

  // An overlay that unmounts while active must not strand a held video.
  useEffect(() => releaseFromOverlay, [releaseFromOverlay]);

  const context = useMemo<PlayerOverlayContextValue>(
    () => ({
      playback,
      telemetry,
      layer,
      activeOverlayId: activeId,
      register,
      unregister,
    }),
    [activeId, layer, playback, register, telemetry, unregister]
  );

  return {
    active,
    controlsLocked: areControlsLocked(active),
    setLayerEl: setLayer,
    context,
  };
}

export function PlayerOverlayProvider({
  value,
  children,
}: {
  value: PlayerOverlayContextValue;
  children: ReactNode;
}) {
  return <PlayerOverlayContext.Provider value={value}>{children}</PlayerOverlayContext.Provider>;
}

/**
 * Inline style for the layer element.
 *
 * A blocking overlay covers the whole player, control bar included — that is
 * what "the viewer cannot proceed" means. A dismissible one stops short of the
 * control bar so the controls underneath stay reachable, and lets pointer events
 * through everywhere except its own panel.
 */
export function overlayLayerStyle(active: OverlaySlot | null): {
  className: string;
  style: React.CSSProperties;
} {
  if (!active) {
    return { className: "pointer-events-none absolute inset-0 z-20", style: { display: "none" } };
  }
  return active.blocking
    ? { className: "pointer-events-auto absolute inset-0 z-30", style: {} }
    : {
        className: "pointer-events-none absolute inset-x-0 top-0 z-20",
        style: { bottom: CONTROLS_HEIGHT_PX },
      };
}

export interface PlayerOverlayProps {
  kind: OverlayKind;
  /** See rule 3. A hard lead gate is the only blocking overlay today. */
  blocking: boolean;
  /** The overlay's own decision about whether it wants to show. */
  open: boolean;
  /** Accessible name for the dialog. Required — this is a modal surface. */
  label: string;
  children: ReactNode;
}

/**
 * Register an overlay and render it when it wins.
 *
 * USE THIS, NOT YOUR OWN ABSOLUTE DIV. Rendering through the host's portal is
 * what guarantees exactly one overlay, correct stacking against the control bar,
 * the bottom-sheet treatment on a phone, and that opening it pauses the video.
 *
 * Content only: no positioning, no backdrop, no z-index. A max-height and
 * scrolling are already applied, so a long form works on a short phone.
 */
export function PlayerOverlay({ kind, blocking, open, label, children }: PlayerOverlayProps) {
  const { layer, activeOverlayId, register, unregister } = usePlayerOverlays();
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    register({ id, kind, blocking, open });
  }, [blocking, id, kind, open, register]);

  useEffect(() => () => unregister(id), [id, unregister]);

  const isActive = layer !== null && activeOverlayId === id;

  // Move focus in ONCE, when the overlay takes the layer, so a keyboard or
  // screen-reader user lands on it instead of being left on the play button of a
  // video that just stopped.
  //
  // Keyed on `isActive` and NOT done from a ref callback: an inline ref callback
  // re-runs on every render, which would drag focus back to the panel on each
  // one — and PR 3 puts a text input in here, so that would fight the viewer for
  // the caret on every keystroke.
  useEffect(() => {
    if (isActive) {
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return createPortal(
    <div
      className={[
        "flex h-full w-full items-end justify-center sm:items-center",
        // A blocking overlay dims the video behind it; a dismissible one must
        // not, because the viewer is still watching it.
        blocking ? "bg-[#1A1338]/80 backdrop-blur-[2px]" : "p-3 sm:p-6",
      ].join(" ")}
      role="dialog"
      aria-modal={blocking}
      aria-label={label}
      data-overlay-kind={kind}
    >
      <div
        className={[
          "pointer-events-auto max-h-full w-full overflow-y-auto",
          // Bottom sheet under 640px, centred card above it. A centred card on a
          // phone ends up under the thumb-unreachable middle of the screen and,
          // with the keyboard open for a lead form, half off-screen.
          "rounded-t-[22px] sm:w-auto sm:max-w-md sm:rounded-[22px]",
          "bg-white text-[#2D1F61] shadow-[0_18px_50px_rgba(22,16,54,0.45)]",
          blocking ? "" : "sm:mb-2",
        ].join(" ")}
        tabIndex={-1}
        ref={panelRef}
      >
        {children}
      </div>
    </div>,
    layer
  );
}
