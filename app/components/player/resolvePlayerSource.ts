// THE ENTIRE INTERFACE BETWEEN THE PLAYER AND HLS.
//
// Everything else in app/components/player/ is source-agnostic: it talks to an
// HTMLVideoElement and never asks what is feeding it. PR 8 added HLS packaging
// in cloudrun-worker/server.js and this function now receives .m3u8 URLs; the
// prediction held — nothing above here learned about HLS. That is the point of
// concentrating the branch in one file: a player that knows about HLS in six
// places is a player that only works for HLS in five of them.
//
// The one thing PR 8 did add is a QUALITY MENU, and it is handed UP from here
// rather than reached for from the control bar. PlayerControls receives a
// QualityController — a list of rungs and a setter — and never learns that
// hls.js exists. On the progressive and native-HLS paths it receives null and
// renders no menu, which is why a menu never appears for a demo with no
// renditions, i.e. every demo at merge time.
//
// hls.js IS DYNAMICALLY IMPORTED AND MUST STAY THAT WAY. It is ~400KB minified.
// A top-level `import Hls from "hls.js"` would put all of it in the share page's
// main bundle for every viewer of every progressive MP4 — which today is every
// viewer, since nothing produces a playlist yet.

import { AUTO_LEVEL, sortQualityLevels, type QualityLevel } from "@/app/lib/overlays/hls";
import { classifySource } from "@/app/lib/overlays/source";

/** Tears down whatever was attached. Safe to call more than once. */
export type DetachSource = () => void;

const NATIVE_HLS_MIME = "application/vnd.apple.mpegurl";

const NOOP_DETACH: DetachSource = () => {};

/**
 * Can this element play a playlist on its own? Safari and every iOS browser can.
 *
 * Asks the element rather than the user-agent string: a UA test is wrong the
 * week a browser changes, and the element already knows the answer.
 */
export function hasNativeHlsSupport(video: HTMLVideoElement): boolean {
  try {
    return video.canPlayType(NATIVE_HLS_MIME) !== "";
  } catch {
    return false;
  }
}

/**
 * Assign `src` only when it differs from the attribute already on the element.
 *
 * MarvedgePlayer renders `src` server-side for progressive sources so the
 * browser starts fetching while the page is still parsing. Re-assigning the
 * same value here would reset the media element and throw that head start away
 * on every mount. Compared against the ATTRIBUTE rather than `video.src`,
 * because the property returns an absolute resolved URL and would never equal a
 * relative input.
 */
function setSrcIfChanged(video: HTMLVideoElement, url: string): void {
  if (video.getAttribute("src") !== url) {
    video.src = url;
  }
}

/**
 * The quality menu's handle on hls.js, or the absence of one.
 *
 * PROJECTED, NOT PASSED THROUGH. PlayerControls gets this, not an Hls instance:
 * the control bar has no business being able to call destroy(), and typing a
 * prop against a package that must only ever be dynamically imported is how a
 * 400KB library ends up in the share page's main bundle by accident.
 */
export interface QualityController {
  /** Highest first. Empty on the native and progressive paths. */
  levels: QualityLevel[];
  /** The active level's index, or AUTO_LEVEL (-1) while ABR is choosing. */
  currentLevel: number;
  /** Pass AUTO_LEVEL to hand control back to ABR. */
  setLevel(index: number): void;
}

export interface ResolveSourceOptions {
  /**
   * Called for an unrecoverable hls.js error, after its own retries. The player
   * uses it to show the same failure state a progressive `error` event produces,
   * so the two paths fail identically from the viewer's side.
   */
  onFatalError?: () => void;
  /**
   * Called with a controller once hls.js has parsed the manifest, again on every
   * level switch, and with null on teardown.
   *
   * NULL IS THE NORMAL CASE and it is never called at all on the progressive
   * path — no manifest, nothing to choose between. Safari's native player also
   * yields nothing here: it owns its own ABR and exposes no level list, and no
   * menu is the honest answer rather than one that cannot do anything.
   */
  onQualityChange?: (controller: QualityController | null) => void;
}

/**
 * Point `video` at `url`, choosing a transport, and return how to undo it.
 *
 * Async ONLY because of the dynamic import on the hls.js path. The progressive
 * path — the only one that exists before PR 8 — resolves without ever awaiting a
 * network round trip, so `src` is set in the same microtask and nothing about
 * first-frame latency changes for today's viewers.
 *
 * The caller owns cancellation: this may resolve after the component unmounted
 * or the URL changed, so the effect that calls it must invoke the returned
 * detach immediately if it is no longer interested. Attaching hls.js to a
 * detached element otherwise leaks a media-source and a worker per remount.
 */
export async function resolvePlayerSource(
  video: HTMLVideoElement,
  url: string,
  options: ResolveSourceOptions = {}
): Promise<DetachSource> {
  // The /share/video/[id] route passes `exportedUrl || ""`, so an export whose
  // encode has not landed reaches us as an empty string. Assigning "" to src
  // resolves against the page URL and makes the browser fetch the HTML document
  // as media, which fails noisily and confusingly. Do nothing instead.
  if (!url) {
    return NOOP_DETACH;
  }

  if (classifySource(url, hasNativeHlsSupport(video)) !== "hls-js") {
    setSrcIfChanged(video, url);
    return () => {
      // Leave `src` alone: the element is being torn down with the component,
      // and clearing it mid-teardown makes Chrome log a spurious media error.
    };
  }

  const { default: Hls } = await import("hls.js");
  if (!Hls.isSupported()) {
    // No MSE (an old browser, or a locked-down webview). Handing the playlist
    // straight to the element will fail, but it fails the same way any
    // unplayable source does, which is better than a blank frame with no error.
    setSrcIfChanged(video, url);
    return NOOP_DETACH;
  }

  const hls = new Hls();
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) {
      options.onFatalError?.();
    }
  });

  const { onQualityChange } = options;
  if (onQualityChange) {
    /**
     * Read the ladder off the instance and hand it up.
     *
     * `autoLevelEnabled` rather than a cached flag: hls.js reports
     * `currentLevel` as the level actually PLAYING, which is a real index even
     * while ABR is in charge, so it alone cannot distinguish "auto, currently
     * at 720p" from "pinned to 720p" — and those are different ticks in the
     * menu.
     */
    const publish = () => {
      const levels = hls.levels.map((level, index) => ({
        index,
        height: level.height ?? 0,
        bitrate: level.bitrate ?? 0,
      }));
      onQualityChange({
        levels: sortQualityLevels(levels),
        currentLevel: hls.autoLevelEnabled ? AUTO_LEVEL : hls.currentLevel,
        setLevel: (index: number) => {
          hls.currentLevel = index;
        },
      });
    };
    hls.on(Hls.Events.MANIFEST_PARSED, publish);
    // Fires for an ABR switch as well as a manual one, so the menu's tick
    // follows what is actually playing instead of what was last clicked.
    hls.on(Hls.Events.LEVEL_SWITCHED, publish);
  }

  hls.loadSource(url);
  hls.attachMedia(video);

  let destroyed = false;
  return () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    // Retract the menu BEFORE destroying, so nothing can be left holding a
    // setLevel() that would touch a destroyed instance.
    options.onQualityChange?.(null);
    hls.destroy();
  };
}
