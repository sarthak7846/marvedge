"use client";

// The public player. Replaces `<video controls>` on the share page.
//
// It owns a <video> WITHOUT the `controls` attribute, our own control bar, and
// the overlay slot that PRs 3, 5 and 6 register into. The contract for that slot
// — priority, blocking vs dismissible, the transition table, the autoplay
// decision — is documented in PlayerOverlayHost.tsx and is required reading
// before adding an overlay.
//
// SOURCE-AGNOSTIC BY CONSTRUCTION. Nothing here knows whether it is playing a
// progressive MP4 or an HLS playlist; resolvePlayerSource() is the only code
// that asks, and PR 8 changes only that file plus the worker.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject, VideoHTMLAttributes } from "react";
import { Play, RotateCcw } from "lucide-react";

import { SEEK_STEP_SECONDS } from "@/app/lib/overlays/playback";
import { isHlsUrl } from "@/app/lib/overlays/source";

import PlayerControls from "./PlayerControls";
import { PlayerOverlayProvider, overlayLayerStyle, useOverlayRegistry } from "./PlayerOverlayHost";
import { resolvePlayerSource, type DetachSource } from "./resolvePlayerSource";
import { usePlaybackMilestones, useTelemetry } from "./useTelemetry";
import { useVideoElement } from "./useVideoElement";

/** Marvedge purple. Overridden per-demo on the customer-hub route. */
const DEFAULT_ACCENT = "#8A76FC";

/** How long undisturbed playback runs before the control bar fades out. */
const CONTROLS_IDLE_MS = 2800;

/** Floor on how often pointer movement is allowed to cause a re-render. */
const ACTIVITY_THROTTLE_MS = 250;

/**
 * playsInline's older spelling, still required by in-app webviews on iOS that
 * predate the standard attribute.
 *
 * IT MATTERS MORE THAN IT LOOKS. Without it iOS takes the video fullscreen in
 * its own native player the moment playback starts, which paints over — and so
 * destroys — the overlay layer. Every overlay in PRs 3, 5 and 6 would simply
 * fail to exist on those browsers, silently.
 *
 * Cast because it is not in React's VideoHTMLAttributes; the attribute is real
 * and reaches the DOM regardless.
 */
const LEGACY_INLINE_ATTRS = {
  "webkit-playsinline": "true",
} as unknown as VideoHTMLAttributes<HTMLVideoElement>;

export interface MarvedgePlayerProps {
  src: string;
  /** Used for the player's accessible name. */
  title: string;
  /**
   * The ref useViewTracking() owns, attached to our internal <video>.
   *
   * NOT OPTIONAL IN PRACTICE. That hook POSTs /api/views on mount and heartbeats
   * duration every 5s while `ref.current` is playing, and it is what feeds every
   * number on app/(signed)/analytics/page.tsx. If the ref stops pointing at a
   * real element, View rows stop being written and the dashboard reads zero with
   * nothing anywhere to say why.
   */
  videoRef?: RefObject<HTMLVideoElement | null>;
  demoId?: string;
  exportedVideoId?: string;
  /** Brand accent; the hub route passes its own so the player is not purple there. */
  accentColor?: string;
  /** Overlay registrations from PRs 3, 5 and 6. */
  children?: ReactNode;
}

export default function MarvedgePlayer({
  src,
  title,
  videoRef: externalVideoRef,
  demoId,
  exportedVideoId,
  accentColor = DEFAULT_ACCENT,
  children,
}: MarvedgePlayerProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const { state, actions } = useVideoElement({ videoRef, containerRef });

  // hls.js can give up without the element ever firing `error`, so the two
  // failure routes are tracked separately and presented identically.
  const [sourceFailed, setSourceFailed] = useState(false);
  const failed = state.failed || sourceFailed;

  const telemetry = useTelemetry({
    demoId,
    exportedVideoId,
    // The player only renders when NEXT_PUBLIC_OVERLAYS_ENABLED is on, so this
    // is really "is there anything to attribute events to".
    enabled: true,
  });

  usePlaybackMilestones({
    telemetry,
    targetKey: demoId ?? exportedVideoId ?? src,
    currentTime: state.currentTime,
    duration: state.duration,
    paused: state.paused,
    ended: state.ended,
  });

  const registry = useOverlayRegistry({ state, actions }, telemetry);
  const { active, controlsLocked, setLayerEl, setTriggerLayerEl, context } = registry;
  const layer = overlayLayerStyle(active);

  /**
   * Render `src` server-side for everything except a playlist.
   *
   * Without it the element reaches the browser with no source and
   * `preload="metadata"` has nothing to preload, so nothing starts loading until
   * hydration runs the effect below — a first-frame delay the native
   * `<video src>` on the flag-off path does not have. Every export today is a
   * progressive MP4, so this covers all of them.
   *
   * A playlist is deliberately left off: the attribute would make the browser
   * try to load the .m3u8 natively and fail before hls.js ever attached. Which
   * of the two HLS transports applies is a question only the element can answer
   * (canPlayType), and there is no element during SSR.
   */
  const ssrSrc = src && !isHlsUrl(src) ? src : undefined;

  // --- Source -------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setSourceFailed(false);

    let cancelled = false;
    let detach: DetachSource | null = null;

    resolvePlayerSource(video, src, { onFatalError: () => setSourceFailed(true) })
      .then((teardown) => {
        // The dynamic import on the HLS path means this can land after the
        // component is gone. Tearing down immediately is what stops a leaked
        // MediaSource and worker per remount.
        if (cancelled) {
          teardown();
          return;
        }
        detach = teardown;
      })
      .catch(() => {
        if (!cancelled) {
          setSourceFailed(true);
        }
      });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [src, videoRef]);

  // --- Control bar visibility ---------------------------------------------

  const [idle, setIdle] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [activity, setActivity] = useState(0);
  const lastActivityRef = useRef(0);

  const markActive = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }
    lastActivityRef.current = now;
    setActivity((count) => count + 1);
  }, []);

  useEffect(() => {
    // Controls stay put whenever the viewer might need them: paused, finished,
    // or with an overlay up. Only undisturbed playback hides them.
    if (state.paused || state.ended || controlsLocked) {
      setIdle(false);
      return;
    }
    setIdle(false);
    const timer = window.setTimeout(() => setIdle(true), CONTROLS_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [activity, controlsLocked, state.ended, state.paused]);

  const controlsVisible = !idle || focusWithin;

  // --- Keyboard ------------------------------------------------------------

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // The scrub slider marks its own arrow keys handled; without this check
      // the same press would seek twice.
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Escape") {
        // Real fullscreen has the browser's own Escape handling. The CSS
        // fallback on iPhone has none, so it needs this or there is no way out.
        if (state.pseudoFullscreen) {
          event.preventDefault();
          actions.exitFullscreen();
        }
        return;
      }
      if (controlsLocked) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && target !== event.currentTarget) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
        // A focused button already activates on Space/Enter; handling it here
        // as well would toggle playback twice per press.
        if ((event.key === " " || event.key === "Enter") && (tag === "BUTTON" || tag === "A")) {
          return;
        }
      }

      const shortcuts: Record<string, () => void> = {
        " ": actions.togglePlay,
        k: actions.togglePlay,
        ArrowLeft: () => actions.seekBy(-SEEK_STEP_SECONDS),
        ArrowRight: () => actions.seekBy(SEEK_STEP_SECONDS),
        f: actions.toggleFullscreen,
        m: actions.toggleMute,
      };
      const shortcut = shortcuts[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!shortcut) {
        return;
      }
      // Space scrolls the page and arrows scroll the stage otherwise.
      event.preventDefault();
      markActive();
      shortcut();
    },
    [actions, controlsLocked, markActive, state.pseudoFullscreen]
  );

  const onSurfaceClick = useCallback(() => {
    if (controlsLocked) {
      return;
    }
    markActive();
    actions.togglePlay();
  }, [actions, controlsLocked, markActive]);

  const showBigButton = (state.paused || state.ended) && !failed && !controlsLocked;

  return (
    <PlayerOverlayProvider value={context}>
      <div
        ref={containerRef}
        role="region"
        aria-label={title ? `Video player: ${title}` : "Video player"}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={markActive}
        onPointerDown={markActive}
        onFocus={() => {
          setFocusWithin(true);
          markActive();
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusWithin(false);
          }
        }}
        className={[
          "group/player relative h-full w-full overflow-hidden bg-black",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A594F9]",
          state.pseudoFullscreen ? "fixed inset-0 z-[9999] h-screen w-screen" : "",
          // The bar is the only affordance while playing, so once it fades the
          // cursor should get out of the way too.
          controlsVisible ? "cursor-auto" : "cursor-none",
        ].join(" ")}
      >
        {/* No `controls` attribute — that is the entire point of this PR. */}
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          src={ssrSrc}
          preload="metadata"
          playsInline
          controlsList="nodownload"
          onClick={onSurfaceClick}
          {...LEGACY_INLINE_ATTRS}
        />

        {state.waiting && !failed && !state.paused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white motion-reduce:animate-none"
              role="status"
              aria-label="Buffering"
            />
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1A1338]/85 px-6 text-center">
            <p className="text-sm text-white/90">
              This video could not be played. Try reloading the page.
            </p>
          </div>
        )}

        {showBigButton && (
          <button
            type="button"
            onClick={onSurfaceClick}
            aria-label={state.ended ? "Replay" : "Play"}
            className={[
              "absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2",
              "items-center justify-center rounded-full bg-[#1A1338]/60 text-white backdrop-blur-sm",
              "motion-safe:transition-transform motion-safe:duration-150 hover:scale-105",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            ].join(" ")}
          >
            {state.ended ? (
              <RotateCcw className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Play className="ml-1 h-7 w-7" aria-hidden="true" />
            )}
          </button>
        )}

        <PlayerControls
          state={state}
          actions={actions}
          locked={controlsLocked}
          visible={controlsVisible}
          accentColor={accentColor}
        />

        {/* THE OVERLAY SLOT. One layer, owned here; overlays portal into it. */}
        <div ref={setLayerEl} className={layer.className} style={layer.style} />

        {/* THE TRIGGER SLOT — see rule 5 in PlayerOverlayHost.tsx. A strip in the
            top-right corner for standing affordances that must stay reachable
            while the video plays. It sits BELOW the overlay layer's z-index and
            passes pointer events through everywhere except the buttons in it, so
            an empty strip costs the viewer nothing: clicking the video through it
            still toggles playback. */}
        <div
          ref={setTriggerLayerEl}
          className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2"
        />

        {children}
      </div>
    </PlayerOverlayProvider>
  );
}
