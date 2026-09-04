// What kind of media URL is this, and who should play it.
//
// Split from the attach path in app/components/player/resolvePlayerSource.ts so
// the decision is testable without a browser: "does .m3u8?token=… still count as
// HLS" is a string question, and getting it wrong means either shipping hls.js
// to every progressive MP4 viewer or handing Safari a playlist it will not load.
//
// NOTHING ELSE IN THE PLAYER MAY BRANCH ON SOURCE TYPE. PR 8 adds HLS packaging;
// its entire contact surface with the player is this classifier plus the attach
// function that consumes it.

export type PlayerSourceKind =
  /** A playlist the browser can play directly (Safari, iOS). */
  | "hls-native"
  /** A playlist that needs hls.js attached via MSE. */
  | "hls-js"
  /** Anything else — today, every export: a progressive MP4 on `src`. */
  | "progressive";

/**
 * Does this URL point at an HLS playlist?
 *
 * Tests the PATH, not the whole string, because a presigned R2 URL carries its
 * signature in the query (`…/master.m3u8?X-Amz-Signature=…`) and an endsWith on
 * the raw URL would classify every signed playlist as progressive. Parsed
 * against a dummy base so a relative URL works too, and any input that will not
 * parse at all is progressive — the fallback that is always safe, since setting
 * `src` to junk fails visibly on the element rather than in our code.
 */
export function isHlsUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  let pathname: string;
  try {
    pathname = new URL(url, "https://placeholder.invalid").pathname;
  } catch {
    return false;
  }
  return pathname.toLowerCase().endsWith(".m3u8");
}

/**
 * Decide who plays this URL.
 *
 * `hasNativeHls` is the element's own answer (canPlayType), passed in rather
 * than sniffed here — a user-agent test would be wrong the week a browser
 * changes, and the element already knows.
 *
 * Native support wins over hls.js when both are available: Safari's built-in
 * player is hardware-accelerated, handles AirPlay and does not cost a dynamic
 * import.
 */
export function classifySource(url: string, hasNativeHls: boolean): PlayerSourceKind {
  if (!isHlsUrl(url)) {
    return "progressive";
  }
  return hasNativeHls ? "hls-native" : "hls-js";
}
