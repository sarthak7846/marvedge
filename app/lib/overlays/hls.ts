// HLS: object layout, playlist validation, and the two decisions the player and
// the share routes have to make about which URL to play.
//
// Like the rest of app/lib/overlays/ this is ISOMORPHIC AND PURE — no fs, no
// DOM, no `process.env` (that stays in ./flags.ts). The same functions decide
// the object key the Cloud Run worker writes to, the URL the server-rendered
// share page hands the player, and the label on the quality menu, which is the
// only way those three stay in agreement.
//
// WHAT IS DELIBERATELY NOT HERE: the encoding ladder. The rung heights,
// bitrates and GOP length live in cloudrun-worker/server.js because that is
// where ffmpeg runs and where getting them wrong is observable. Mirroring them
// into a second file the worker cannot import — it is a standalone CommonJS
// service with its own package.json — would create a copy that drifts silently.
// The worker follows the same convention for the WTM bubble geometry.

/** Root prefix for every packaged rendition, in the R2 processed bucket. */
export const HLS_PREFIX = "hls/";

/** The multivariant playlist the player is pointed at. */
export const MASTER_PLAYLIST_NAME = "master.m3u8";

/**
 * The idempotency marker the worker writes beside the renditions, recording the
 * hash of the source they were produced from. Re-running the packager reads
 * this first and skips the encode when the hash still matches.
 */
export const HLS_MANIFEST_NAME = "manifest.json";

/**
 * Every object for one demo lives under a single prefix, so removing a demo's
 * renditions is a prefix delete rather than a list-and-filter.
 *
 * The demo id is a uuid and the export path never passes anything else, but this
 * builds an object KEY that is later handed to an S3 API, so a `..` segment or a
 * leading slash would escape the prefix. Rejecting instead of sanitising: a
 * caller with a strange id has a bug worth surfacing, not a path worth guessing.
 */
export function hlsPrefixForDemo(demoId: string): string {
  if (!isSafeDemoId(demoId)) {
    throw new Error("Invalid demo id for an HLS object prefix");
  }
  return `${HLS_PREFIX}${demoId}/`;
}

/** The master playlist object key for a demo. */
export function masterPlaylistObject(demoId: string): string {
  return `${hlsPrefixForDemo(demoId)}${MASTER_PLAYLIST_NAME}`;
}

/** The idempotency marker object key for a demo. */
export function manifestObject(demoId: string): string {
  return `${hlsPrefixForDemo(demoId)}${HLS_MANIFEST_NAME}`;
}

/**
 * Ids we will build an object key from: the uuid/cuid shapes Demo actually uses.
 * Anything with a slash, a dot segment or whitespace is refused.
 */
function isSafeDemoId(demoId: unknown): demoId is string {
  return typeof demoId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(demoId);
}

/**
 * Is this a playlist URI we are willing to hand to the player?
 *
 * Guards the value coming back OUT of the database, not the one going in. A
 * packaging run that half-failed, a hand-edited row or a restored backup can all
 * leave something in ExportedVideo.hlsPlaylistUrl that is not a playlist, and
 * the share page that reads it is unauthenticated and server-rendered. `r2://`
 * and https only: an http URL is blocked as mixed content on an https share page
 * and would simply never load, and a `javascript:` or `data:` URI has no
 * business reaching a media element.
 */
export function isPlayablePlaylistUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length === 0) {
    return false;
  }
  const isR2 = uri.startsWith("r2://");
  const isHttps = uri.startsWith("https://");
  if (!isR2 && !isHttps) {
    return false;
  }
  // Compare the PATH, not the whole string: a presigned playlist carries its
  // signature in the query. Same reasoning as isHlsUrl() in ./source.ts, which
  // this deliberately does not reuse — that one classifies a URL for the player
  // and accepts relative input, this one is an allow-list on stored data.
  const withoutQuery = uri.split(/[?#]/, 1)[0];
  return withoutQuery.toLowerCase().endsWith(".m3u8");
}

// --- Which URL does the player get -----------------------------------------

export interface MediaSourceInput {
  /** The progressive MP4 every demo has: `demo.exportedUrl || demo.videoUrl`. */
  fallbackUrl: string;
  /** A packaged master playlist, already resolved to https, or null for none. */
  hlsUrl?: string | null;
  /**
   * The media is withheld pending a lead submission (a hard gate with signed
   * media on). The player is handed nothing and asks /api/v3/media for a signed
   * URL instead.
   */
  gated?: boolean;
}

/**
 * The one place that decides what the `<video>` is pointed at.
 *
 * THE FALLBACK IS THE COMMON PATH, not the exceptional one. At merge time no
 * demo has renditions, so every viewer takes the `fallbackUrl` branch — the same
 * progressive MP4 they get today, resolved by the same expression the share
 * pages already used. HLS is strictly an upgrade applied when a playlist exists
 * AND survives validation; anything else about a packaging run having gone wrong
 * degrades to the MP4 rather than to a broken player.
 *
 * Returns "" when gated, which resolvePlayerSource() treats as "attach nothing"
 * — deliberately not the MP4 URL, because emitting it in the page source is
 * exactly what the signed-media path exists to stop.
 */
export function pickMediaUrl({ fallbackUrl, hlsUrl, gated }: MediaSourceInput): string {
  if (gated) {
    return "";
  }
  if (isPlayablePlaylistUri(hlsUrl)) {
    return hlsUrl;
  }
  return fallbackUrl;
}

// --- The quality menu -------------------------------------------------------

/**
 * One entry in the quality menu, projected from an hls.js Level. Deliberately
 * NOT hls.js's own type: this crosses into PlayerControls, and importing a type
 * from a package that must only ever be dynamically imported is how a 400KB
 * library ends up in the share page's main bundle by accident.
 */
export interface QualityLevel {
  /** Index into hls.js's own `levels` array — what setLevel() takes. */
  index: number;
  height: number;
  /** Peak bitrate in bits per second, 0 when the manifest omits it. */
  bitrate: number;
}

/** hls.js's sentinel for "let ABR choose". */
export const AUTO_LEVEL = -1;

/**
 * The menu label for a rung. Height, because that is what a viewer recognises —
 * "720p" means something to people that "2.8 Mbps" does not.
 */
export function qualityLabel(height: number): string {
  return Number.isFinite(height) && height > 0 ? `${Math.round(height)}p` : "Auto";
}

/**
 * Highest quality first, which is the order a quality menu is read in.
 *
 * Ties on height are broken by bitrate so a ladder that carries two renditions
 * at the same height (an HDR/SDR pair, or a re-package that changed bitrates)
 * still produces a stable order rather than one that depends on how the manifest
 * happened to be written.
 */
export function sortQualityLevels(levels: readonly QualityLevel[]): QualityLevel[] {
  return [...levels].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
}

/**
 * Is a quality menu worth showing at all?
 *
 * One rendition is not a choice, and rendering a menu with a single entry beside
 * "Auto" is a control that cannot do anything. Native HLS (Safari) also lands
 * here with an empty list, since the browser owns its own ABR and exposes no
 * level list to switch between — no menu is the honest answer there.
 */
export function hasQualityChoice(levels: readonly QualityLevel[]): boolean {
  return levels.length > 1;
}
