// Contrast maths for the QR engine.
//
// A styled QR is a contrast problem, not a drawing problem: a scanner binarizes
// the image, so the only thing that decides whether it decodes is how far apart
// the "dark" and "light" luminances are. This module makes that a computed check
// instead of a judgement call — every colour pair the engine draws is measured
// here before a single module is emitted.

/** WCAG relative luminance, from a #rgb / #rrggbb colour. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * The floor the engine enforces between the module colour and whatever shows in
 * the light cells. WCAG's 4.5:1 target is about reading text at small sizes; a
 * QR module is a large block, so 4:1 is the right bar — and it still leaves a
 * wide margin over the ~2:1 where cheap cameras start guessing.
 */
export const QR_MIN_CONTRAST_RATIO = 4;

/** Parse `#rgb` or `#rrggbb`. Returns undefined for anything else. */
export function parseHexColor(hex: string): Rgb | undefined {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return undefined;
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** True for a colour string the engine can measure — i.e. can safely draw. */
export function isQrColor(value: unknown): value is string {
  return typeof value === "string" && parseHexColor(value) !== undefined;
}

/** Serialize back to `#rrggbb`, so blended colours stay parseable. */
export function toHexColor({ r, g, b }: Rgb): string {
  const channel = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    throw new Error(`qr: not a hex colour: ${hex}`);
  }
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

/** WCAG contrast ratio between two colours, 1:1 to 21:1. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when the pair clears QR_MIN_CONTRAST_RATIO. */
export function hasQrContrast(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= QR_MIN_CONTRAST_RATIO;
}

/**
 * Throw unless the pair clears the floor. This is the engine's last line of
 * defence and it fails loud on purpose: sanitizeQrOptions() already falls back to
 * the preset for untrusted input, so reaching here means code passed colours that
 * would produce a QR unlikely to scan, and silently emitting one is worse than an
 * error.
 */
export function assertQrContrast(foreground: string, background: string): void {
  const ratio = contrastRatio(foreground, background);
  if (ratio < QR_MIN_CONTRAST_RATIO) {
    throw new Error(
      `qr: contrast ${ratio.toFixed(2)}:1 between ${foreground} and ${background} is below the ` +
        `${QR_MIN_CONTRAST_RATIO}:1 floor — the code would not reliably scan`
    );
  }
}

/**
 * The colour that `foreground` at `alpha` opacity actually resolves to over an
 * opaque `background`. Needed because the branded style paints the mark as a
 * translucent tint, and it is that *blended* colour — not the mark's own colour —
 * that has to stay distinguishable from a dark module.
 */
export function blendOverBackground(foreground: string, background: string, alpha: number): string {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) {
    throw new Error(`qr: not a hex colour: ${!fg ? foreground : background}`);
  }
  const a = Math.max(0, Math.min(1, alpha));
  return toHexColor({
    r: bg.r + (fg.r - bg.r) * a,
    g: bg.g + (fg.g - bg.g) * a,
    b: bg.b + (fg.b - bg.b) * a,
  });
}
