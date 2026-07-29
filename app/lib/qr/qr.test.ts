import { describe, expect, it } from "vitest";

import {
  assertQrContrast,
  blendOverBackground,
  contrastRatio,
  hasQrContrast,
  parseHexColor,
  QR_MIN_CONTRAST_RATIO,
} from "./contrast";
import { MARVEDGE_MARK_DATA_URI } from "./mark";
import {
  buildQrMatrix,
  finderZones,
  isFinderModule,
  isInRegion,
  isTimingModule,
  QR_FINDER_ZONE_SIZE,
} from "./matrix";
import { MARVEDGE_QR_PRESET, QR_QUIET_ZONE_MIN, QR_STYLES, resolveQrOptions } from "./presets";
import { sanitizeQrOptions, toQrTargetUrl } from "./sanitize";
import { BADGE_KNOCKOUT_FRACTION, BRANDED_ART_OPACITY, qrKnockoutRegion, renderQrSvg } from "./svg";

const SHARE_URL = "https://marvedge.com/share/video/cm9x1a2b3c4d5e6f7g8h9i0j";

/**
 * URLs of increasing length, so every assertion runs across several QR versions
 * rather than only the one a short share link happens to produce. Versions grow
 * 21 -> 25 -> 29 ... modules, and the geometry rules have to hold at all of them.
 */
const URLS_BY_LENGTH = [
  "https://mvdg.co/a",
  SHARE_URL,
  `${SHARE_URL}?src=qr&utm_source=deck&utm_medium=qr&utm_campaign=launch`,
  `https://marvedge.com/share/${"x".repeat(200)}`,
];

/** Every module coordinate of a count x count grid. */
function eachModule(count: number, visit: (row: number, col: number) => void): void {
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      visit(row, col);
    }
  }
}

/** Pull every attribute value of the given SVG element name out of the output. */
function elements(svg: string, name: string): string[] {
  return svg.match(new RegExp(`<${name}\\b[^>]*/?>`, "g")) ?? [];
}

/** Read a numeric attribute off a single SVG element string. */
function attr(element: string, name: string): number {
  const match = element.match(new RegExp(`\\b${name}="([-0-9.]+)"`));
  if (!match) {
    throw new Error(`no ${name} attribute on ${element.slice(0, 80)}`);
  }
  return Number(match[1]);
}

describe("buildQrMatrix", () => {
  it("is deterministic for a fixed URL", () => {
    const a = buildQrMatrix(SHARE_URL);
    const b = buildQrMatrix(SHARE_URL);
    expect(a.count).toBe(b.count);
    eachModule(a.count, (row, col) => {
      expect(a.isDark(row, col)).toBe(b.isDark(row, col));
    });
  });

  it("produces a valid version — 21 modules and up, in steps of 4", () => {
    for (const url of URLS_BY_LENGTH) {
      const { count } = buildQrMatrix(url);
      expect(count).toBeGreaterThanOrEqual(21);
      expect((count - 21) % 4).toBe(0);
    }
  });

  it("grows the version as the URL gets longer", () => {
    const counts = URLS_BY_LENGTH.map((url) => buildQrMatrix(url).count);
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
  });

  it("reports light outside the grid instead of throwing", () => {
    const { count, isDark } = buildQrMatrix(SHARE_URL);
    expect(isDark(-1, 0)).toBe(false);
    expect(isDark(0, count)).toBe(false);
  });

  it("has all three finder patterns, each a solid ring with a solid centre", () => {
    const { count, isDark } = buildQrMatrix(SHARE_URL);
    for (const zone of finderZones(count)) {
      // Normalize to the finder's own top-left, which for the far zones is offset
      // by one from the zone (the separator sits on the inner side).
      const top = zone.row === 0 ? 0 : zone.row + 1;
      const left = zone.col === 0 ? 0 : zone.col + 1;
      expect(isDark(top, left)).toBe(true); // ring corner
      expect(isDark(top + 1, left + 1)).toBe(false); // light gap
      expect(isDark(top + 3, left + 3)).toBe(true); // solid centre
    }
  });
});

describe("isTimingModule", () => {
  it("covers the whole of row 6 and column 6", () => {
    const count = 25;
    expect(isTimingModule(6, 0, count)).toBe(true);
    expect(isTimingModule(6, 20, count)).toBe(true);
    expect(isTimingModule(0, 6, count)).toBe(true);
    expect(isTimingModule(20, 6, count)).toBe(true);
    expect(isTimingModule(7, 7, count)).toBe(false);
  });

  it("is false outside the grid", () => {
    expect(isTimingModule(6, -1, 25)).toBe(false);
    expect(isTimingModule(25, 6, 25)).toBe(false);
  });
});

describe("qrKnockoutRegion", () => {
  it("stays at or under 25% of the code's width", () => {
    expect(BADGE_KNOCKOUT_FRACTION).toBeLessThanOrEqual(0.25);
    for (const url of URLS_BY_LENGTH) {
      const { count } = buildQrMatrix(url);
      expect(qrKnockoutRegion(count).size / count).toBeLessThanOrEqual(0.25);
    }
  });

  // The regression this whole file exists for: a knockout that creeps onto a
  // finder or a timing pattern produces a QR that looks perfect and does not scan.
  it("never intersects a finder or timing module, at any version", () => {
    for (const url of URLS_BY_LENGTH) {
      const { count } = buildQrMatrix(url);
      const knockout = qrKnockoutRegion(count);
      eachModule(count, (row, col) => {
        if (!isInRegion(row, col, knockout)) {
          return;
        }
        expect(
          isFinderModule(row, col, count),
          `knockout hits a finder at ${row},${col} (count ${count})`
        ).toBe(false);
        expect(
          isTimingModule(row, col, count),
          `knockout hits a timing module at ${row},${col} (count ${count})`
        ).toBe(false);
      });
    }
  });

  it("holds even at the 0.25 ceiling", () => {
    for (const url of URLS_BY_LENGTH) {
      const { count } = buildQrMatrix(url);
      const knockout = qrKnockoutRegion(count, 0.25);
      eachModule(count, (row, col) => {
        if (isInRegion(row, col, knockout)) {
          expect(isFinderModule(row, col, count) || isTimingModule(row, col, count)).toBe(false);
        }
      });
    }
  });

  it("is centred", () => {
    const { count } = buildQrMatrix(SHARE_URL);
    const knockout = qrKnockoutRegion(count);
    const before = knockout.row;
    const after = count - (knockout.row + knockout.size);
    expect(Math.abs(before - after)).toBeLessThanOrEqual(1);
  });
});

describe("contrast", () => {
  it("parses #rgb and #rrggbb, and rejects anything else", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("2D1F61")).toEqual({ r: 45, g: 31, b: 97 });
    expect(parseHexColor("#12345")).toBeUndefined();
    expect(parseHexColor("rebeccapurple")).toBeUndefined();
  });

  it("computes the known black-on-white ratio", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("accepts the Marvedge preset", () => {
    const { moduleColor, backgroundColor } = MARVEDGE_QR_PRESET;
    expect(contrastRatio(moduleColor, backgroundColor)).toBeGreaterThanOrEqual(
      QR_MIN_CONTRAST_RATIO
    );
    expect(hasQrContrast(moduleColor, backgroundColor)).toBe(true);
    expect(() => assertQrContrast(moduleColor, backgroundColor)).not.toThrow();
  });

  it("rejects a deliberately low-contrast pair", () => {
    // The periwinkle from the original logo on white: 2.4:1, which is exactly why
    // scripts/qr/make-mark.mjs exists.
    expect(hasQrContrast("#6387DF", "#FFFFFF")).toBe(false);
    expect(() => assertQrContrast("#6387DF", "#FFFFFF")).toThrow(/below the 4:1 floor/);
  });

  it("blends a translucent foreground down to an opaque colour", () => {
    expect(blendOverBackground("#000000", "#FFFFFF", 0)).toBe("#ffffff");
    expect(blendOverBackground("#000000", "#FFFFFF", 1)).toBe("#000000");
    expect(blendOverBackground("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  // The branded style paints the mark into the light cells, so it is the BLENDED
  // colour that has to stay distinguishable from a dark module.
  it("keeps the branded art tint clear of a dark module", () => {
    const { moduleColor, backgroundColor } = MARVEDGE_QR_PRESET;
    const tint = blendOverBackground(moduleColor, backgroundColor, BRANDED_ART_OPACITY);
    expect(contrastRatio(moduleColor, tint)).toBeGreaterThanOrEqual(QR_MIN_CONTRAST_RATIO);
  });
});

describe("resolveQrOptions", () => {
  it("fills everything from the preset", () => {
    expect(resolveQrOptions({ url: SHARE_URL })).toEqual({
      url: SHARE_URL,
      ...MARVEDGE_QR_PRESET,
    });
  });

  it("clamps out-of-range numerics and rejects unknown values", () => {
    const resolved = resolveQrOptions({
      url: SHARE_URL,
      size: -10,
      quietZone: 0,
      cornerRadius: 99,
      moduleColor: "not-a-colour",
    });
    expect(resolved.size).toBeGreaterThanOrEqual(96);
    expect(resolved.quietZone).toBeGreaterThanOrEqual(QR_QUIET_ZONE_MIN);
    expect(resolved.cornerRadius).toBe(0.5);
    expect(resolved.moduleColor).toBe(MARVEDGE_QR_PRESET.moduleColor);
  });

  it("treats an empty logo as 'no mark' but an unset one as 'the Marvedge mark'", () => {
    expect(resolveQrOptions({ url: SHARE_URL }).logoDataUri).toBe(MARVEDGE_MARK_DATA_URI);
    expect(resolveQrOptions({ url: SHARE_URL, logoDataUri: "" }).logoDataUri).toBeUndefined();
  });
});

describe("toQrTargetUrl", () => {
  it("keeps an http(s) URL", () => {
    expect(toQrTargetUrl(SHARE_URL)).toBe(SHARE_URL);
    expect(toQrTargetUrl("  http://localhost:3000/share/x  ")).toBe(
      "http://localhost:3000/share/x"
    );
  });

  it("promotes a bare host to https", () => {
    expect(toQrTargetUrl("marvedge.com/share/abc")).toBe("https://marvedge.com/share/abc");
  });

  it("rejects non-http schemes, empties and over-long inputs", () => {
    expect(toQrTargetUrl("javascript:alert(1)")).toBeUndefined();
    expect(toQrTargetUrl("data:text/html,<script>")).toBeUndefined();
    expect(toQrTargetUrl("gs://bucket/object")).toBeUndefined();
    expect(toQrTargetUrl("   ")).toBeUndefined();
    expect(toQrTargetUrl(`https://marvedge.com/${"x".repeat(600)}`)).toBeUndefined();
    expect(toQrTargetUrl(undefined)).toBeUndefined();
  });
});

describe("sanitizeQrOptions", () => {
  it("returns undefined without a usable URL", () => {
    expect(sanitizeQrOptions(undefined)).toBeUndefined();
    expect(sanitizeQrOptions("https://marvedge.com")).toBeUndefined();
    expect(sanitizeQrOptions({})).toBeUndefined();
    expect(sanitizeQrOptions({ url: "javascript:alert(1)" })).toBeUndefined();
  });

  it("coerces query-string values and falls back to the preset on junk", () => {
    const resolved = sanitizeQrOptions({
      url: SHARE_URL,
      style: "holographic",
      size: "1024",
      quietZone: "6",
      moduleColor: "#nope",
    });
    expect(resolved).toBeDefined();
    expect(resolved?.style).toBe(MARVEDGE_QR_PRESET.style);
    expect(resolved?.size).toBe(1024);
    expect(resolved?.quietZone).toBe(6);
    expect(resolved?.moduleColor).toBe(MARVEDGE_QR_PRESET.moduleColor);
  });

  it("replaces a remote or non-raster logo with the Marvedge mark", () => {
    for (const logoDataUri of [
      "https://evil.example.com/logo.png",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "",
    ]) {
      expect(sanitizeQrOptions({ url: SHARE_URL, logoDataUri })?.logoDataUri).toBe(
        MARVEDGE_MARK_DATA_URI
      );
    }
  });
});

describe("renderQrSvg", () => {
  it("is deterministic for both styles", () => {
    for (const style of QR_STYLES) {
      expect(renderQrSvg({ url: SHARE_URL, style })).toBe(renderQrSvg({ url: SHARE_URL, style }));
    }
  });

  it("emits a well-formed, self-contained SVG document", () => {
    for (const style of QR_STYLES) {
      const svg = renderQrSvg({ url: SHARE_URL, style, size: 512 });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('width="512" height="512"');
      expect(svg).toContain('role="img"');
      // Every tag opened is self-closed — nothing here nests.
      expect(svg.match(/</g)?.length).toBe(svg.match(/>/g)?.length);
      expect(svg).not.toContain("undefined");
      expect(svg).not.toContain("NaN");
    }
  });

  it("embeds the mark inline and never references a remote URL", () => {
    for (const style of QR_STYLES) {
      const svg = renderQrSvg({ url: SHARE_URL, style });
      const images = elements(svg, "image");
      expect(images).toHaveLength(1);
      expect(images[0]).toContain('href="data:image/png;base64,');
      // A remote href would taint the canvas the PNG export draws into.
      expect(svg).not.toMatch(/href="(?!data:)/);
      expect(svg).not.toContain("xlink:href");
      expect(svg).not.toContain("<script");
    }
  });

  it("does not encode the URL into the markup, only into the modules", () => {
    const svg = renderQrSvg({ url: SHARE_URL });
    expect(svg).not.toContain("marvedge.com");
  });

  it("sizes the viewBox as the code plus a quiet zone on all four sides", () => {
    const { count } = buildQrMatrix(SHARE_URL);
    for (const quietZone of [4, 8]) {
      const svg = renderQrSvg({ url: SHARE_URL, quietZone });
      expect(svg).toContain(`viewBox="0 0 ${count + quietZone * 2} ${count + quietZone * 2}"`);
    }
  });

  it("never lets a quiet zone fall below the 4-module minimum", () => {
    const { count } = buildQrMatrix(SHARE_URL);
    for (const quietZone of [-5, 0, 1, 3]) {
      const svg = renderQrSvg({ url: SHARE_URL, quietZone });
      expect(svg).toContain(
        `viewBox="0 0 ${count + QR_QUIET_ZONE_MIN * 2} ${count + QR_QUIET_ZONE_MIN * 2}"`
      );
    }
  });

  // The quiet zone has to be background colour and nothing else. Every drawn
  // shape other than the background rect is checked to start at or after the
  // quiet-zone offset and end at or before the code's far edge.
  it("draws nothing into the quiet zone", () => {
    const quietZone = 4;
    for (const style of QR_STYLES) {
      const { count } = buildQrMatrix(SHARE_URL);
      const svg = renderQrSvg({ url: SHARE_URL, style, quietZone });
      const far = quietZone + count;

      for (const image of elements(svg, "image")) {
        expect(attr(image, "x")).toBeGreaterThanOrEqual(quietZone);
        expect(attr(image, "y")).toBeGreaterThanOrEqual(quietZone);
        expect(attr(image, "x") + attr(image, "width")).toBeLessThanOrEqual(far);
        expect(attr(image, "y") + attr(image, "height")).toBeLessThanOrEqual(far);
      }

      // Path data is a flat list of coordinates in module units; the extremes of
      // that list are the drawn bounds.
      const paths = svg.match(/<path d="([^"]+)"/g) ?? [];
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        const moves = path.match(/M([-0-9.]+) ([-0-9.]+)/g) ?? [];
        expect(moves.length).toBeGreaterThan(0);
        for (const move of moves) {
          const [x, y] = move.slice(1).split(" ").map(Number);
          expect(x).toBeGreaterThanOrEqual(quietZone);
          expect(y).toBeGreaterThanOrEqual(quietZone);
          expect(x).toBeLessThanOrEqual(far);
          expect(y).toBeLessThanOrEqual(far);
        }
      }
    }
  });

  it("puts the badge mark inside the knockout and the branded mark over the code", () => {
    const quietZone = 4;
    const { count } = buildQrMatrix(SHARE_URL);
    const knockout = qrKnockoutRegion(count);

    const badge = elements(renderQrSvg({ url: SHARE_URL, style: "badge", quietZone }), "image")[0];
    expect(attr(badge, "x")).toBeGreaterThanOrEqual(quietZone + knockout.col);
    expect(attr(badge, "width")).toBeLessThanOrEqual(knockout.size);

    const branded = elements(
      renderQrSvg({ url: SHARE_URL, style: "branded", quietZone }),
      "image"
    )[0];
    expect(attr(branded, "width")).toBeGreaterThan(knockout.size);
    expect(Number(branded.match(/opacity="([0-9.]+)"/)?.[1])).toBe(BRANDED_ART_OPACITY);
  });

  it("masks the branded art out of all three finder zones", () => {
    const quietZone = 4;
    const { count } = buildQrMatrix(SHARE_URL);
    const svg = renderQrSvg({ url: SHARE_URL, style: "branded", quietZone });
    // The pads are the one square (radius 0) path in the output, so they show up
    // as bare `M x y h size v size h -size Z` subpaths.
    for (const zone of finderZones(count)) {
      const size = QR_FINDER_ZONE_SIZE;
      const pad = `M${quietZone + zone.col} ${quietZone + zone.row}h${size}v${size}h-${size}Z`;
      expect(svg).toContain(pad);
    }
  });

  it("drops the mark, the knockout and the branded art when there is no logo", () => {
    for (const style of QR_STYLES) {
      const svg = renderQrSvg({ url: SHARE_URL, style, logoDataUri: "" });
      expect(elements(svg, "image")).toHaveLength(0);
      expect(svg).not.toContain("opacity=");
    }
  });

  it("refuses to draw a colour pair that would not scan", () => {
    expect(() =>
      renderQrSvg({ url: SHARE_URL, moduleColor: "#6387DF", backgroundColor: "#FFFFFF" })
    ).toThrow(/would not reliably scan/);
  });

  it("renders every version without blowing up", () => {
    for (const url of URLS_BY_LENGTH) {
      for (const style of QR_STYLES) {
        expect(renderQrSvg({ url, style }).length).toBeGreaterThan(500);
      }
    }
  });
});
