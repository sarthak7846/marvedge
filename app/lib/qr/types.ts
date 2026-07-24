// Option shapes for the QR engine.
//
// Kept in their own module because both ends of the feature need them: the
// client component that renders a QR into a share modal, and the route handler
// that serves one as image/svg+xml. Neither imports the other.

/**
 * The two looks the engine can draw (see app/lib/qr/svg.ts):
 *   badge   — brand-coloured modules on the background, the mark sitting in a
 *             cleared rounded tile at the centre.
 *   branded — the mark drawn large and lightly tinted *behind* the modules on the
 *             light ground, modules at full strength on top.
 *
 * `badge` is the ONLY style the product surfaces. `branded` is reachable by
 * passing `style`, and stays covered by qr.test.ts, but no UI offers it — see the
 * note on MARVEDGE_QR_PRESET.style in app/lib/qr/presets.ts for why.
 */
export type QrStyle = "badge" | "branded";

/**
 * What a caller passes to `renderQrSvg`. Only `url` is required — everything
 * else falls back to MARVEDGE_QR_PRESET.
 */
export interface QrRenderOptions {
  /** The URL the QR encodes. Must already exist; the engine never mints links. */
  url: string;
  style?: QrStyle;
  /** Rendered width and height in px. The SVG is scalable regardless. */
  size?: number;
  /** Dark module colour. Must clear QR_MIN_CONTRAST_RATIO against the background. */
  moduleColor?: string;
  /** The light-cell colour. The quiet zone is always this and nothing else. */
  backgroundColor?: string;
  /**
   * The mark, as a `data:` URI — never a remote href, which would taint the
   * canvas the client-side PNG export draws into. Defaults to the Marvedge mark;
   * pass an empty string to draw a plain QR with no mark at all.
   */
  logoDataUri?: string;
  /** Light border around the code, in modules. Never below QR_QUIET_ZONE_MIN. */
  quietZone?: number;
  /** Module corner rounding, in module units (0 = square, 0.5 = a full circle). */
  cornerRadius?: number;
}

/** A fully-defaulted option set. `renderQrSvg` resolves to this before drawing. */
export interface ResolvedQrOptions {
  url: string;
  style: QrStyle;
  size: number;
  moduleColor: string;
  backgroundColor: string;
  logoDataUri?: string;
  quietZone: number;
  cornerRadius: number;
}
