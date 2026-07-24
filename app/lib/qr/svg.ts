// The renderer: a QR matrix in, an SVG string out.
//
// This is a PURE STRING BUILDER on purpose. No canvas, no jsdom, no DOM, no fs,
// no env — so the same function serves a client component and a route handler
// from one code path, and there is exactly one place where the scannability
// invariants live.
//
// The invariants, all of which are load-bearing and none of which are taste:
//   - ECC "H" always (app/lib/qr/matrix.ts).
//   - Quiet zone >= 4 modules, and nothing but background colour inside it.
//   - The three finder patterns stay solid module-colour on background-colour.
//     Rounded corners are fine. Art, tint, or occlusion is not.
//   - Row 6 and column 6 (the timing patterns) are never covered.
//   - The badge knockout is <= 25% of the code's width.
//   - Every colour pair is measured against QR_MIN_CONTRAST_RATIO before drawing.
//
// If you are here to make the code prettier, read the tuning comments on the
// BRANDED_* constants first. They were settled against real phone scans, and
// "improving" them is how a QR silently stops working.

import { assertQrContrast, blendOverBackground } from "./contrast";
import {
  buildQrMatrix,
  finderOrigins,
  finderZones,
  isFinderModule,
  isInRegion,
  type QrRegion,
} from "./matrix";
import { resolveQrOptions } from "./presets";
import type { QrRenderOptions } from "./types";

/**
 * How much of the code's width the badge knockout clears. 0.22 linear is ~4.8%
 * of the module area — comfortably inside the 30% that ECC "H" recovers, with the
 * rest of the budget left for camera noise, glare and cheap printing. The hard
 * ceiling is 0.25; above that the knockout starts reaching row/column 6.
 */
export const BADGE_KNOCKOUT_FRACTION = 0.22;

/**
 * Padding inside the knockout tile, per side, as a fraction of the tile. Kept
 * tight at 0.05 because the mark is 1.55:1 and the tile is square, so `meet`
 * already leaves ~24% of the tile's height empty above and below it — adding much
 * side padding on top of that makes the mark read as lost in a white box.
 */
const BADGE_LOGO_PADDING = 0.05;

/** Knockout tile corner radius, as a fraction of the tile. */
const BADGE_TILE_RADIUS = 0.18;

/**
 * branded: the mark's width as a fraction of the code's width.
 *
 * Settled at 0.72. Larger (0.8+) and the mark's wide zigzag runs under the
 * finder separators on small versions, so the masking pads start to read as
 * obvious rectangles cut out of the art. Smaller (0.6) and the art reads as a
 * smudge behind the code rather than as the logo, which defeats the point of the
 * style. 0.72 keeps the mark recognisable while its bounds stay clear of the
 * quiet zone at every version.
 */
export const BRANDED_MARK_SCALE = 0.72;

/**
 * branded: the mark's opacity behind the modules.
 *
 * This is the single most important number in the file. In this style the mark
 * sits in the LIGHT cells, so a scanner has to binarize it as light — if the art
 * is too strong, light cells over it read as dark and the code stops decoding.
 *
 * At 0.22 over white the mark resolves to about #D1CEDC, which measures ~9:1
 * against the module colour: a scanner is never in any doubt, and the mark is
 * still clearly legible as the logo. Measured, not guessed — the assertion in
 * renderQrSvg re-checks it against QR_MIN_CONTRAST_RATIO on every render.
 *
 * Do not raise it "so the logo pops". At 0.35 the blended art lands near
 * mid-luminance (~0.46), and while the ratio still clears 4:1, a local-threshold
 * binarizer working over a patch that is mostly art can flip whole light cells.
 * That failure is intermittent and camera-dependent, which is the worst kind.
 */
export const BRANDED_ART_OPACITY = 0.22;

/**
 * Eye corner radii, in module units, for the 7x7 / 5x5 / 3x3 rings. All roughly
 * 28% of their side, so the three read as one shape. Rounding the finders is
 * explicitly safe: a scanner locates them by their 1:1:3:1:1 dark/light run
 * ratio along a scanline through the centre, which rounded corners do not touch.
 */
const EYE_OUTER_RADIUS = 2;
const EYE_MIDDLE_RADIUS = 1.4;
const EYE_INNER_RADIUS = 0.9;

/** Round to 4dp so the output is byte-for-byte deterministic. */
function f(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

/**
 * The block of modules the badge style clears for the mark. Centred, so it can
 * only ever approach the timing patterns from the inside — and since the size is
 * ~22% of the count, the nearest edge sits around 39% of the way across, which is
 * well past row/column 6 at every version. qr.test.ts asserts this across
 * versions rather than trusting the arithmetic.
 */
export function qrKnockoutRegion(
  count: number,
  fraction: number = BADGE_KNOCKOUT_FRACTION
): QrRegion {
  const size = Math.ceil(count * fraction);
  const start = Math.floor((count - size) / 2);
  return { row: start, col: start, size };
}

/** A rounded rectangle as a closed path, in module units. */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (radius === 0) {
    return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  }
  const arc = `a${f(radius)} ${f(radius)} 0 0 1 `;
  return (
    `M${f(x + radius)} ${f(y)}` +
    `h${f(w - 2 * radius)}` +
    `${arc}${f(radius)} ${f(radius)}` +
    `v${f(h - 2 * radius)}` +
    `${arc}${f(-radius)} ${f(radius)}` +
    `h${f(-(w - 2 * radius))}` +
    `${arc}${f(-radius)} ${f(-radius)}` +
    `v${f(-(h - 2 * radius))}` +
    `${arc}${f(radius)} ${f(-radius)}Z`
  );
}

/** `<path>` with a fill, or nothing at all when there is no geometry. */
function fillPath(d: string, fill: string, extra: string = ""): string {
  return d.length > 0 ? `<path d="${d}" fill="${fill}"${extra}/>` : "";
}

/**
 * Render a QR for `options.url` as a standalone SVG document string.
 *
 * Throws if the resolved colours cannot clear QR_MIN_CONTRAST_RATIO. That is
 * deliberate: sanitizeQrOptions() already falls back to the preset for untrusted
 * input, so an exception here means code asked for a QR that would not scan.
 */
export function renderQrSvg(options: QrRenderOptions): string {
  const opts = resolveQrOptions(options);
  assertQrContrast(opts.moduleColor, opts.backgroundColor);

  const matrix = buildQrMatrix(opts.url);
  const { count } = matrix;
  const quiet = opts.quietZone;
  const total = count + quiet * 2;
  const logo = opts.logoDataUri;

  // Only the badge style clears modules. branded draws the art underneath them,
  // so the matrix stays complete and the ECC budget is untouched.
  const knockout = opts.style === "badge" && logo ? qrKnockoutRegion(count) : undefined;

  const layers: string[] = [
    // The background covers the quiet zone too, which is the whole point: the
    // quiet zone must be this colour and nothing else.
    `<rect width="${f(total)}" height="${f(total)}" fill="${opts.backgroundColor}"/>`,
  ];

  if (opts.style === "branded" && logo) {
    const tint = blendOverBackground(opts.moduleColor, opts.backgroundColor, BRANDED_ART_OPACITY);
    assertQrContrast(opts.moduleColor, tint);

    // The mark's viewport is square and the asset is the mark contained in a
    // square canvas, so `meet` centres it and its width is the viewport's width.
    // BRANDED_MARK_SCALE < 1 keeps those bounds inside the code area, which is
    // what stops art from ever landing in the quiet zone.
    const span = count * BRANDED_MARK_SCALE;
    const offset = quiet + (count - span) / 2;
    layers.push(
      `<image x="${f(offset)}" y="${f(offset)}" width="${f(span)}" height="${f(span)}" ` +
        `opacity="${BRANDED_ART_OPACITY}" preserveAspectRatio="xMidYMid meet" href="${logo}"/>`
    );

    // Mask the art out of the three finder zones (finder + separator). Square,
    // not rounded: a rounded pad would leave art sitting in the corners of the
    // separator, and a clean square around each eye is the standard, deliberate
    // look for this kind of code rather than a compromise.
    const pads = finderZones(count)
      .map((zone) => roundedRectPath(quiet + zone.col, quiet + zone.row, zone.size, zone.size, 0))
      .join("");
    layers.push(fillPath(pads, opts.backgroundColor));
  }

  // Data modules. Finder patterns are skipped here and drawn as custom eyes
  // below; the knockout region is skipped entirely.
  let data = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!matrix.isDark(row, col)) {
        continue;
      }
      if (isFinderModule(row, col, count)) {
        continue;
      }
      if (knockout && isInRegion(row, col, knockout)) {
        continue;
      }
      data += roundedRectPath(quiet + col, quiet + row, 1, 1, opts.cornerRadius);
    }
  }
  layers.push(fillPath(data, opts.moduleColor));

  // The eyes: an outer ring, a background-coloured gap, a solid centre. Drawn as
  // three stacked layers rather than one even-odd path so the middle ring is
  // genuinely opaque — which is what keeps branded art out of the finders.
  const eyes = finderOrigins(count);
  layers.push(
    fillPath(
      eyes
        .map((eye) =>
          roundedRectPath(quiet + eye.col, quiet + eye.row, eye.size, eye.size, EYE_OUTER_RADIUS)
        )
        .join(""),
      opts.moduleColor
    ),
    fillPath(
      eyes
        .map((eye) =>
          roundedRectPath(quiet + eye.col + 1, quiet + eye.row + 1, 5, 5, EYE_MIDDLE_RADIUS)
        )
        .join(""),
      opts.backgroundColor
    ),
    fillPath(
      eyes
        .map((eye) =>
          roundedRectPath(quiet + eye.col + 2, quiet + eye.row + 2, 3, 3, EYE_INNER_RADIUS)
        )
        .join(""),
      opts.moduleColor
    )
  );

  if (knockout && logo) {
    // A background-coloured tile over the cleared block, then the mark inside it.
    // The tile is drawn even though the modules are already skipped: it gives the
    // mark a clean edge to sit against and guarantees the block is fully cleared
    // regardless of module rounding.
    const tile = {
      x: quiet + knockout.col,
      y: quiet + knockout.row,
      size: knockout.size,
    };
    layers.push(
      fillPath(
        roundedRectPath(tile.x, tile.y, tile.size, tile.size, tile.size * BADGE_TILE_RADIUS),
        opts.backgroundColor
      )
    );
    // The mark is wider than it is tall (~1.55:1), so `meet` inside a square tile
    // leaves vertical padding by design — that reads as a logo badge, and it is
    // cheaper than making the knockout non-square and re-deriving the occlusion
    // bound for two axes.
    const inset = tile.size * BADGE_LOGO_PADDING;
    const inner = tile.size - inset * 2;
    layers.push(
      `<image x="${f(tile.x + inset)}" y="${f(tile.y + inset)}" width="${f(inner)}" ` +
        `height="${f(inner)}" preserveAspectRatio="xMidYMid meet" href="${logo}"/>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.size}" height="${opts.size}" ` +
    `viewBox="0 0 ${f(total)} ${f(total)}" role="img" aria-label="QR code" ` +
    'shape-rendering="geometricPrecision">' +
    layers.join("") +
    "</svg>"
  );
}

/**
 * `renderQrSvg` output as a `data:` URI — what the client-side PNG export loads
 * into an `<img>` before drawing it to a canvas. `btoa` is used rather than
 * Buffer so this stays isomorphic (it is global in browsers and in Node 16+), and
 * the output is safe to base64 without UTF-8 pre-encoding because the SVG is
 * ASCII apart from the mark, which is itself already base64.
 */
export function renderQrSvgDataUri(options: QrRenderOptions): string {
  return `data:image/svg+xml;base64,${btoa(renderQrSvg(options))}`;
}
