// One-off dev script: derive the QR-safe Marvedge mark from the app logo.
//
// WHY THIS EXISTS
// ---------------
// public/icons/logo.png is a BLACK mark on an OPAQUE PERIWINKLE field
// (rgb(99,135,223) === #6387DF). That polarity cannot be used in an artistic QR
// code: periwinkle sits at mid-luminance, so it is neither a valid "light" cell
// nor a valid "dark" module, and a scanner binarizing the image will guess. The
// Starbucks-style codes work because their art is green on WHITE — art and
// modules share ONE palette against ONE light ground.
//
// So we derive, once, at build time:
//   - the periwinkle field removed (it is a flat solid, so a tolerance-based
//     chroma key is exact rather than approximate),
//   - the black mark recoloured to the QR module colour (#2D1F61),
//   - trimmed to the mark's own bounds and re-centred in a square canvas, so the
//     consuming <image> can size it by its viewport without guessing at padding.
//
// Outputs (both committed):
//   public/qr/marvedge-mark.png — the asset, for anything that can take a URL.
//   app/lib/qr/mark.ts          — the same bytes as a base64 data: URI, because
//                                 the QR engine must stay isomorphic and the PNG
//                                 export in PR 2 needs an untainted canvas, which
//                                 rules out a remote href.
//
// `sharp` is used deliberately at BUILD TIME ONLY (it is already in node_modules
// as a Next transitive dep). It must never become a runtime dependency of the QR
// engine — see app/lib/qr/svg.ts, which is a pure string builder.
//
// Run: node scripts/qr/make-mark.mjs

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = path.join(ROOT, "public", "icons", "logo.png");
const PNG_OUT = path.join(ROOT, "public", "qr", "marvedge-mark.png");
const TS_OUT = path.join(ROOT, "app", "lib", "qr", "mark.ts");

/** Final canvas. Square so callers can use a square viewport. */
const SIZE = 512;
/** Transparent margin kept inside the square, as a fraction of SIZE. */
const MARGIN = 0.02;
/** The QR module colour the mark is recoloured to (app/lib/qr/presets.ts). */
const MODULE_COLOR = { r: 0x2d, g: 0x1f, b: 0x61 };
/** Below this alpha a pixel counts as field, not mark — kills chroma-key dust. */
const ALPHA_FLOOR = 0.02;
/** Above this alpha a pixel counts as fully mark, so interiors stay opaque. */
const ALPHA_CEIL = 0.98;

/**
 * The source is a two-colour image: every pixel is a blend of the black mark
 * over the flat field, i.e. `pixel = (1 - a) * field` (black contributes 0).
 * Inverting that per channel recovers the mark's true coverage, which keeps the
 * antialiased edges smooth instead of stair-stepping them the way a hard
 * distance threshold would.
 */
function coverageFromField(pixel, field) {
  let sum = 0;
  let weight = 0;
  for (let c = 0; c < 3; c++) {
    if (field[c] < 8) {
      continue; // channel carries no signal; a division here would be noise
    }
    sum += (1 - pixel[c] / field[c]) * field[c];
    weight += field[c];
  }
  const a = weight > 0 ? sum / weight : 0;
  if (a <= ALPHA_FLOOR) {
    return 0;
  }
  if (a >= ALPHA_CEIL) {
    return 1;
  }
  return a;
}

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { width, height, channels } = info;

  // The field colour, read from the corners rather than hardcoded, so a
  // re-brand of the logo does not silently produce a mangled mark.
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ].map(([x, y]) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  });
  const field = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / 4));
  console.log(`field colour: rgb(${field.join(",")})`);

  const out = Buffer.alloc(width * height * 4);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let covered = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const o = (y * width + x) * 4;
      const a = coverageFromField([data[i], data[i + 1], data[i + 2]], field);
      out[o] = MODULE_COLOR.r;
      out[o + 1] = MODULE_COLOR.g;
      out[o + 2] = MODULE_COLOR.b;
      out[o + 3] = Math.round(a * 255);
      if (a > 0.5) {
        covered++;
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }

  if (maxX < 0) {
    throw new Error("chroma key removed everything — is the source still two-colour?");
  }
  const bbox = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  console.log(
    `mark coverage: ${((covered / (width * height)) * 100).toFixed(2)}% of source,`,
    `bbox ${bbox.width}x${bbox.height} at (${bbox.left},${bbox.top}),`,
    `aspect ${(bbox.width / bbox.height).toFixed(3)}`
  );

  const inner = Math.round(SIZE * (1 - 2 * MARGIN));
  const scale = inner / Math.max(bbox.width, bbox.height);
  const fitW = Math.max(1, Math.round(bbox.width * scale));
  const fitH = Math.max(1, Math.round(bbox.height * scale));
  const padX = Math.floor((SIZE - fitW) / 2);
  const padY = Math.floor((SIZE - fitH) / 2);

  const png = await sharp(out, { raw: { width, height, channels: 4 } })
    .extract(bbox)
    .resize({ width: fitW, height: fitH, fit: "fill", kernel: "lanczos3" })
    .extend({
      left: padX,
      right: SIZE - fitW - padX,
      top: padY,
      bottom: SIZE - fitH - padY,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    // The output is ONE flat colour plus an alpha ramp on the antialiased edges,
    // so an indexed PNG is effectively lossless here and ~2x smaller — which
    // matters, because these bytes get inlined into the client bundle.
    // `dither: 0` is load-bearing: sharp dithers by default, which scatters
    // off-hue pixels (e.g. rgb(23,10,127)) through the mark and breaks the
    // "art and modules share one colour" invariant the branded style rests on.
    // 64 entries is ample — a hard-edged geometric mark only needs alpha levels
    // for a 1-2px edge ramp.
    .png({ palette: true, quality: 100, dither: 0, colors: 64, compressionLevel: 9, effort: 10 })
    .toBuffer();

  await mkdir(path.dirname(PNG_OUT), { recursive: true });
  await writeFile(PNG_OUT, png);

  const base64 = png.toString("base64");
  const dataUri = `data:image/png;base64,${base64}`;
  await mkdir(path.dirname(TS_OUT), { recursive: true });
  await writeFile(TS_OUT, renderMarkModule(dataUri, fitW / fitH), "utf8");

  console.log(`wrote ${path.relative(ROOT, PNG_OUT)} (${(png.length / 1024).toFixed(1)} kB)`);
  console.log(`wrote ${path.relative(ROOT, TS_OUT)} (${(dataUri.length / 1024).toFixed(1)} kB)`);
}

/** Wrap the data URI in a lint-clean, line-wrapped TS module. */
function renderMarkModule(dataUri, aspect) {
  const CHUNK = 92;
  const lines = [];
  for (let i = 0; i < dataUri.length; i += CHUNK) {
    lines.push(`  "${dataUri.slice(i, i + CHUNK)}"`);
  }
  return `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/qr/make-mark.mjs
//
// The QR-safe Marvedge mark (transparent field, recoloured to the module colour)
// inlined as a data: URI. It is inlined rather than referenced as
// /qr/marvedge-mark.png for two reasons:
//   1. the QR engine is isomorphic and does no I/O, so it cannot read a file;
//   2. a remote href would taint the canvas the PNG export draws into, and
//      canvas.toBlob() on a tainted canvas throws a SecurityError.
// The bytes are identical to public/qr/marvedge-mark.png.

/** Transparent 512x512 PNG of the Marvedge mark in the QR module colour. */
export const MARVEDGE_MARK_DATA_URI =
${lines.join(" +\n")};

/** Width / height of the visible mark inside the square canvas. */
export const MARVEDGE_MARK_ASPECT = ${aspect.toFixed(4)};
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
