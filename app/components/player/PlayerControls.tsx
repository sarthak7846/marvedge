"use client";

// The control bar that replaces `<video controls>`.
//
// Native controls had to go for three reasons that are all hard blockers on
// issue #302: the browser owns the play button, so a hard gate cannot stop
// playback; native controls paint above every positioned element, so there is
// nowhere to put an overlay; and none of it is instrumentable. What is here is
// the smallest thing that gives those three back — play/pause, seek, time,
// volume, fullscreen — not a general-purpose player UI.
//
// ACCESSIBILITY IS PART OF THE REPLACEMENT, NOT A POLISH PASS. Native controls
// are keyboard operable and screen-reader labelled for free; anything we ship
// instead has to be too, or the share page is a regression for anyone not using
// a mouse. Hence the real slider roles, the labels, the visible focus ring, and
// arrow-key handling on the scrubber itself.

import { useCallback, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

import {
  bufferedEndAt,
  formatClock,
  progressFraction,
  trackFraction,
} from "@/app/lib/overlays/playback";

import { CONTROLS_HEIGHT_PX } from "./PlayerOverlayHost";
import type { VideoElementActions, VideoElementState } from "./useVideoElement";

export interface PlayerControlsProps {
  state: VideoElementState;
  actions: VideoElementActions;
  /** A blocking overlay is up: the bar is inert and hidden from the a11y tree. */
  locked: boolean;
  /** Visible, or faded out during undisturbed playback. */
  visible: boolean;
  /**
   * Brand accent for the progress fill and focus ring. Defaults to Marvedge
   * purple, but the customer-hub route passes its own HubSettings colour — a
   * player on someone else's domain must not be purple because we are.
   */
  accentColor: string;
}

/** 44px is the smallest reliably tappable target; below `sm` everything meets it. */
const TOUCH_BUTTON = "h-11 w-11 sm:h-9 sm:w-9";

const BUTTON_BASE = [
  "inline-flex shrink-0 items-center justify-center rounded-full text-white",
  "motion-safe:transition-colors motion-safe:duration-150",
  "hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2",
  "focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1338]",
  "disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");

export default function PlayerControls({
  state,
  actions,
  locked,
  visible,
  accentColor,
}: PlayerControlsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const { currentTime, duration, buffered, paused, ended, muted, volume, fullscreen, ready } =
    state;

  const seekable = ready && Number.isFinite(duration) && duration > 0;
  const playedFraction = progressFraction(currentTime, duration);
  const bufferedFraction = progressFraction(bufferedEndAt(buffered, currentTime), duration);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !seekable) {
        return;
      }
      const rect = track.getBoundingClientRect();
      actions.seekTo(trackFraction(clientX, rect.left, rect.width) * duration);
    },
    [actions, duration, seekable]
  );

  const onTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!seekable) {
        return;
      }
      // Capture so a drag that wanders off the track — which on a phone is most
      // of them — keeps delivering moves to us instead of to whatever is under
      // the finger.
      event.currentTarget.setPointerCapture(event.pointerId);
      setScrubbing(true);
      seekFromPointer(event.clientX);
    },
    [seekFromPointer, seekable]
  );

  const onTrackPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing) {
        return;
      }
      seekFromPointer(event.clientX);
    },
    [scrubbing, seekFromPointer]
  );

  const endScrub = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setScrubbing(false);
  }, []);

  const onTrackKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Handled here AND marked handled, so the player-wide shortcut for the
      // same key does not also fire and seek twice.
      const handlers: Record<string, () => void> = {
        ArrowRight: () => actions.seekBy(5),
        ArrowLeft: () => actions.seekBy(-5),
        ArrowUp: () => actions.seekBy(5),
        ArrowDown: () => actions.seekBy(-5),
        Home: () => actions.seekTo(0),
        End: () => actions.seekTo(duration),
      };
      const handler = handlers[event.key];
      if (!handler) {
        return;
      }
      event.preventDefault();
      handler();
    },
    [actions, duration]
  );

  const PlayIcon = ended ? RotateCcw : paused ? Play : Pause;
  const playLabel = ended ? "Replay" : paused ? "Play" : "Pause";

  return (
    <div
      className={[
        "absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end gap-1 px-2 pb-2 pt-8 sm:px-3",
        "bg-gradient-to-t from-[#0F0A24]/85 via-[#0F0A24]/45 to-transparent",
        "motion-safe:transition-opacity motion-safe:duration-200",
        visible && !locked ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      style={{ minHeight: CONTROLS_HEIGHT_PX }}
      // A blocking overlay means the viewer genuinely cannot use these; saying
      // so keeps a screen reader from offering controls that do nothing.
      aria-hidden={locked || undefined}
    >
      {/* The generous vertical padding is the touch target — the visible bar is
          6px, the thing a thumb has to hit is ~30px. `touch-none` stops the
          page from scrolling out from under a drag. */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={seekable ? duration : 0}
        aria-valuenow={seekable ? currentTime : 0}
        aria-valuetext={`${formatClock(currentTime)} of ${formatClock(duration)}`}
        aria-disabled={!seekable || undefined}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={onTrackKeyDown}
        className={[
          "group/track relative w-full cursor-pointer touch-none select-none py-3 sm:py-2",
          "focus-visible:outline-none",
          seekable ? "" : "cursor-default opacity-60",
        ].join(" ")}
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/25 group-focus-visible/track:ring-2 group-focus-visible/track:ring-white">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/35"
            style={{ width: `${bufferedFraction * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${playedFraction * 100}%`, backgroundColor: accentColor }}
          />
        </div>
        <div
          className={[
            "pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "border-2 border-white shadow-[0_2px_6px_rgba(15,10,36,0.6)]",
            "motion-safe:transition-transform motion-safe:duration-150",
            scrubbing ? "scale-125" : "scale-100 sm:scale-0 sm:group-hover/track:scale-100",
            "group-focus-visible/track:scale-125",
          ].join(" ")}
          style={{ left: `${playedFraction * 100}%`, backgroundColor: accentColor }}
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={actions.togglePlay}
          disabled={locked}
          aria-label={playLabel}
          className={`${BUTTON_BASE} ${TOUCH_BUTTON}`}
        >
          <PlayIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <p className="select-none whitespace-nowrap px-1 text-xs font-medium tabular-nums text-white/90 sm:text-sm">
          <span>{formatClock(currentTime)}</span>
          <span className="text-white/50"> / {formatClock(duration)}</span>
        </p>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={actions.toggleMute}
            disabled={locked}
            aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
            aria-pressed={muted || volume === 0}
            className={`${BUTTON_BASE} ${TOUCH_BUTTON}`}
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          {/* Phones have hardware volume keys and no cursor to hover a slider
              with, so the slider is desktop-only and the mute button carries
              the whole job on touch. */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            disabled={locked}
            onChange={(event) => actions.setVolume(Number(event.target.value))}
            aria-label="Volume"
            className="hidden h-9 w-20 cursor-pointer sm:block"
            style={{ accentColor }}
          />
        </div>

        <button
          type="button"
          onClick={actions.toggleFullscreen}
          disabled={locked}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          aria-pressed={fullscreen}
          className={`${BUTTON_BASE} ${TOUCH_BUTTON}`}
        >
          {fullscreen ? (
            <Minimize className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Maximize className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
