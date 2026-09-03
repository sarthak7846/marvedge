"use client";

// The one place that touches the <video> element imperatively.
//
// Components READ from `state` and CALL `actions`; nothing else in the player
// reaches for videoRef.current. That rule is why the control bar, the overlay
// host and the telemetry hook can all be reasoned about separately: there is a
// single writer to the element, so "who paused the video" always has an answer.
//
// The state it exposes is a projection of the element, not a second copy of it.
// Every field is re-derived from a media event or from the element itself, so a
// pause originating outside our controls (the OS media keys, a phone call, the
// browser's own picture-in-picture UI) shows up in the UI like any other.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { clampSeek, type BufferedRange } from "@/app/lib/overlays/playback";

/**
 * Minimum change in currentTime worth a re-render, in seconds.
 *
 * The playhead is sampled on requestAnimationFrame so the scrub bar moves
 * smoothly, but re-rendering the player 60 times a second would also re-render
 * every overlay registered into it 60 times a second. At 0.05s the bar still
 * looks continuous (sub-pixel movement on any realistic track width) and the
 * render rate is bounded at 20Hz.
 */
const TICK_EPSILON = 0.05;

export interface VideoElementState {
  /** Metadata has loaded, so duration and seeking are meaningful. */
  ready: boolean;
  paused: boolean;
  ended: boolean;
  /** Stalled: buffering, or seeking into un-downloaded territory. */
  waiting: boolean;
  /** The element reported an error, or hls.js gave up. */
  failed: boolean;
  currentTime: number;
  /** NaN until metadata loads; Infinity for an unbounded stream. */
  duration: number;
  buffered: BufferedRange[];
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  /**
   * True when fullscreen is being faked with CSS because the platform has no
   * element fullscreen API — an iPhone. The container styles itself
   * differently; nothing else needs to care.
   */
  pseudoFullscreen: boolean;
}

export interface VideoElementActions {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekTo(seconds: number): void;
  seekBy(deltaSeconds: number): void;
  setVolume(next: number): void;
  toggleMute(): void;
  toggleFullscreen(): void;
  exitFullscreen(): void;
  /**
   * Pause because an overlay opened, remembering whether to resume.
   *
   * SEPARATE FROM pause() ON PURPOSE. pause() is the viewer's decision and
   * cancels any pending resume; this one is the overlay host's and does not.
   * Collapsing the two is how a video ends up resuming underneath a form the
   * viewer had deliberately paused behind.
   */
  holdForOverlay(): void;
  /** Resume iff the hold was what stopped it and the viewer has not since paused. */
  releaseFromOverlay(): void;
}

const INITIAL_STATE: VideoElementState = {
  ready: false,
  paused: true,
  ended: false,
  waiting: false,
  failed: false,
  currentTime: 0,
  duration: Number.NaN,
  buffered: [],
  volume: 1,
  muted: false,
  fullscreen: false,
  pseudoFullscreen: false,
};

// --- Vendor-prefixed fullscreen, typed rather than cast to any --------------

interface FullscreenCapableElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenCapableDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

function sameRanges(a: readonly BufferedRange[], b: readonly BufferedRange[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((range, i) => range.start === b[i].start && range.end === b[i].end);
}

/**
 * Fullscreen the CONTAINER, never the <video>.
 *
 * Fullscreening the element itself hands the whole surface to the platform's
 * media player on iOS and Android, which paints over — and therefore destroys —
 * the overlay layer. Every overlay in PRs 3, 5 and 6 would simply vanish the
 * moment a viewer went fullscreen, silently and only on a phone.
 *
 * An iPhone has no element fullscreen API at all: Element.requestFullscreen and
 * webkitRequestFullscreen are both absent, and only video.webkitEnterFullscreen
 * exists — which is precisely the thing we must not call. So there is a third
 * state: fixed-position CSS that fills the viewport and keeps the overlay layer
 * in our own DOM. It is not real fullscreen (the browser chrome stays) and that
 * is the honest trade for keeping overlays alive on the device most likely to
 * be watching a 9:16 demo.
 */
function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [nativeActive, setNativeActive] = useState(false);
  const [pseudoActive, setPseudoActive] = useState(false);

  useEffect(() => {
    const doc = document as FullscreenCapableDocument;
    const sync = () => {
      setNativeActive(Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // Only the CSS fallback needs this. Real fullscreen already suppresses the
  // page behind it, and locking scroll for it would strand the page at the top
  // on exit.
  useEffect(() => {
    if (!pseudoActive) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pseudoActive]);

  const exit = useCallback(() => {
    setPseudoActive(false);
    const doc = document as FullscreenCapableDocument;
    if (doc.fullscreenElement && typeof doc.exitFullscreen === "function") {
      doc.exitFullscreen().catch(() => {});
      return;
    }
    if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
      doc.webkitExitFullscreen();
    }
  }, []);

  const toggle = useCallback(() => {
    if (nativeActive || pseudoActive) {
      exit();
      return;
    }
    const container = containerRef.current as FullscreenCapableElement | null;
    if (!container) {
      return;
    }
    if (typeof container.requestFullscreen === "function") {
      // A rejection means the platform refused — most often a permissions
      // policy in an embedding iframe. Fall back rather than leaving a dead
      // button.
      container.requestFullscreen().catch(() => setPseudoActive(true));
      return;
    }
    if (typeof container.webkitRequestFullscreen === "function") {
      try {
        container.webkitRequestFullscreen();
        return;
      } catch {
        // fall through to the CSS fallback
      }
    }
    setPseudoActive(true);
  }, [containerRef, exit, nativeActive, pseudoActive]);

  return {
    fullscreen: nativeActive || pseudoActive,
    pseudoFullscreen: pseudoActive,
    toggleFullscreen: toggle,
    exitFullscreen: exit,
  };
}

export interface UseVideoElementOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * A note for PRs 5 and 6, which need to fire something at a position.
 *
 * `state.currentTime` is republished on every observed move INCLUDING a seek —
 * seekTo() reports the new position synchronously rather than waiting for the
 * `seeked` event — so comparing the previous published value to the current one
 * catches a scrub that jumped clean over a trigger point. That is the whole
 * mechanism: keep the last value in a ref and ask crossedThreshold() in
 * app/lib/overlays/playback.ts. Do not schedule a timer at `duration - 5s`; a
 * viewer who drags the handle to the end never has a tick land near it.
 */
export function useVideoElement({ videoRef, containerRef }: UseVideoElementOptions): {
  state: VideoElementState;
  actions: VideoElementActions;
} {
  const [state, setState] = useState<VideoElementState>(INITIAL_STATE);
  const lastTimeRef = useRef(0);

  // Set by the subscription effect below so seekTo() can repaint immediately.
  // A ref rather than a dependency because the two would otherwise have to be
  // declared in the wrong order, and re-subscribing every media listener each
  // time a seek callback changed identity is not worth avoiding that.
  const reportRef = useRef<((time: number) => void) | null>(null);

  // Whether an overlay is holding the video, and whether to resume when it lets
  // go. Refs, not state: they are read inside event handlers and must not
  // re-subscribe anything when they change.
  const heldRef = useRef(false);
  const resumeAfterHoldRef = useRef(false);

  const patch = useCallback((next: Partial<VideoElementState>) => {
    setState((prev) => {
      const keys = Object.keys(next) as (keyof VideoElementState)[];
      const changed = keys.some((key) => !Object.is(prev[key], next[key]));
      return changed ? { ...prev, ...next } : prev;
    });
  }, []);

  const fullscreen = useFullscreen(containerRef);

  useEffect(() => {
    patch({
      fullscreen: fullscreen.fullscreen,
      pseudoFullscreen: fullscreen.pseudoFullscreen,
    });
  }, [fullscreen.fullscreen, fullscreen.pseudoFullscreen, patch]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let raf = 0;

    const readBuffered = (): BufferedRange[] => {
      const out: BufferedRange[] = [];
      try {
        const ranges = video.buffered;
        for (let i = 0; i < ranges.length; i++) {
          out.push({ start: ranges.start(i), end: ranges.end(i) });
        }
      } catch {
        // The range list can shift under us mid-read and throw INDEX_SIZE_ERR.
        // A partial answer is fine; this only paints a progress bar.
      }
      return out;
    };

    const syncBuffered = () => {
      const next = readBuffered();
      setState((prev) => (sameRanges(prev.buffered, next) ? prev : { ...prev, buffered: next }));
    };

    const report = (time: number) => {
      if (!Number.isFinite(time)) {
        return;
      }
      const previous = lastTimeRef.current;
      if (previous === time) {
        return;
      }
      lastTimeRef.current = time;
      patch({ currentTime: time });
    };
    reportRef.current = report;

    const stopTicking = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const startTicking = () => {
      if (raf) {
        return;
      }
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const time = video.currentTime;
        if (Math.abs(time - lastTimeRef.current) >= TICK_EPSILON) {
          report(time);
        }
      };
      raf = requestAnimationFrame(loop);
    };

    const onLoadedMetadata = () => {
      patch({ ready: true, duration: video.duration, failed: false });
      syncBuffered();
      report(video.currentTime);
    };
    const onDurationChange = () => patch({ duration: video.duration });
    const onPlay = () => patch({ paused: false, ended: false });
    const onPlaying = () => {
      patch({ paused: false, ended: false, waiting: false });
      startTicking();
    };
    const onPause = () => {
      patch({ paused: true });
      stopTicking();
      report(video.currentTime);
    };
    const onEnded = () => {
      patch({ paused: true, ended: true, waiting: false });
      stopTicking();
      report(video.currentTime);
    };
    const onWaiting = () => patch({ waiting: true });
    const onCanPlay = () => patch({ waiting: false, failed: false });
    const onTimeUpdate = () => report(video.currentTime);
    const onSeeking = () => patch({ waiting: true });
    const onSeeked = () => {
      patch({ waiting: false });
      report(video.currentTime);
      syncBuffered();
    };
    const onVolumeChange = () => patch({ volume: video.volume, muted: video.muted });
    const onError = () => {
      stopTicking();
      patch({ failed: true, waiting: false });
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("progress", syncBuffered);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("error", onError);

    // A cached video can be through loadedmetadata before this effect runs, in
    // which case the event never arrives and the player would sit at
    // "0:00 / 0:00" over a perfectly loaded video.
    patch({
      paused: video.paused,
      ended: video.ended,
      volume: video.volume,
      muted: video.muted,
      ready: video.readyState >= HTMLMediaElement.HAVE_METADATA,
      duration: video.duration,
    });
    syncBuffered();
    if (!video.paused) {
      startTicking();
    }

    return () => {
      stopTicking();
      reportRef.current = null;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("progress", syncBuffered);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("error", onError);
    };
  }, [patch, videoRef]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    resumeAfterHoldRef.current = true;
    // Rejects when autoplay policy refuses, or when the element is torn down
    // mid-promise. Neither is actionable, and neither may surface as an
    // unhandled rejection on a customer's own domain.
    video.play().catch(() => {});
  }, [videoRef]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    // The viewer's decision outranks any pending overlay resume.
    resumeAfterHoldRef.current = false;
    video.pause();
  }, [videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused || video.ended) {
      play();
    } else {
      pause();
    }
  }, [pause, play, videoRef]);

  const seekTo = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const target = clampSeek(seconds, video.duration);
      if (!Number.isFinite(target)) {
        return;
      }
      video.currentTime = target;
      // Repaint now: while paused there is no rAF loop running, and `seeked`
      // can be several hundred milliseconds away over a slow network. Reporting
      // here is also what lets a trigger crossing be detected on a scrub that
      // the viewer performs while the video is paused.
      reportRef.current?.(target);
    },
    [videoRef]
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      seekTo(video.currentTime + deltaSeconds);
    },
    [seekTo, videoRef]
  );

  const setVolume = useCallback(
    (next: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const clamped = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0));
      video.volume = clamped;
      // Dragging the slider to zero means "silence", and the mute button should
      // reflect that rather than offering a second, separate silent state.
      video.muted = clamped === 0;
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    // Un-muting a video whose volume was dragged to 0 has to restore audible
    // volume, or the button appears to do nothing at all.
    if (!nextMuted && video.volume === 0) {
      video.volume = 1;
    }
  }, [videoRef]);

  const holdForOverlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || heldRef.current) {
      return;
    }
    heldRef.current = true;
    resumeAfterHoldRef.current = !video.paused && !video.ended;
    video.pause();
  }, [videoRef]);

  const releaseFromOverlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !heldRef.current) {
      return;
    }
    heldRef.current = false;
    if (!resumeAfterHoldRef.current) {
      return;
    }
    resumeAfterHoldRef.current = false;
    video.play().catch(() => {});
  }, [videoRef]);

  return {
    state,
    actions: {
      play,
      pause,
      togglePlay,
      seekTo,
      seekBy,
      setVolume,
      toggleMute,
      toggleFullscreen: fullscreen.toggleFullscreen,
      exitFullscreen: fullscreen.exitFullscreen,
      holdForOverlay,
      releaseFromOverlay,
    },
  };
}
