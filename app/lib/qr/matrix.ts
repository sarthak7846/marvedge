// The QR matrix, plus the predicates that keep decoration off the function
// patterns.
//
// `qrcode-generator` is zero-dependency and isomorphic: it computes the module
// grid and nothing else, which is exactly what we want, because every pixel is
// drawn by app/lib/qr/svg.ts. It has no canvas, no DOM and no native binding, so
// one code path serves a client component and a route handler alike.
//
// Nothing in here knows about pixels, colours or styling.

import qrcode from "qrcode-generator";

/**
 * Always ECC level "H" — 30% recovery. This is not a preference: it is what pays
 * for the centre knockout and the decorative modules. Lowering it makes every
 * styled QR in the product less likely to scan, so it is a constant, not an
 * option.
 */
export const QR_ECC_LEVEL = "H" as const;

/** Each of the three finder patterns is 7x7 modules. */
export const QR_FINDER_SIZE = 7;

/**
 * A finder is followed by a 1-module light separator, so the region art must
 * never reach is 8x8 measured from the code's outer edge.
 */
export const QR_FINDER_ZONE_SIZE = QR_FINDER_SIZE + 1;

/** Timing patterns run the length of row 6 and column 6. */
export const QR_TIMING_INDEX = 6;

/** A read-only view of the module grid. */
export interface QrMatrix {
  /** Modules per side, excluding the quiet zone. 21 at version 1, +4 per version. */
  count: number;
  /** True when the module at (row, col) is dark. False outside the grid. */
  isDark(row: number, col: number): boolean;
}

/**
 * Build the matrix for `url`. Type number 0 lets the library pick the smallest
 * version that fits at ECC "H".
 */
export function buildQrMatrix(url: string): QrMatrix {
  const qr = qrcode(0, QR_ECC_LEVEL);
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  return {
    count,
    // The library throws on out-of-range indices; callers iterating a padded
    // canvas should get "light", not an exception.
    isDark: (row: number, col: number): boolean => {
      if (row < 0 || col < 0 || row >= count || col >= count) {
        return false;
      }
      return qr.isDark(row, col);
    },
  };
}

/** A square block of modules, addressed by its top-left corner. */
export interface QrRegion {
  row: number;
  col: number;
  size: number;
}

/** True when (row, col) falls inside `region`. */
export function isInRegion(row: number, col: number, region: QrRegion): boolean {
  return (
    row >= region.row &&
    row < region.row + region.size &&
    col >= region.col &&
    col < region.col + region.size
  );
}

/**
 * The three finder patterns, top-left / top-right / bottom-left. There is no
 * fourth: its absence is how a scanner works out the code's rotation.
 */
export function finderOrigins(count: number): readonly QrRegion[] {
  const far = count - QR_FINDER_SIZE;
  return [
    { row: 0, col: 0, size: QR_FINDER_SIZE },
    { row: 0, col: far, size: QR_FINDER_SIZE },
    { row: far, col: 0, size: QR_FINDER_SIZE },
  ];
}

/**
 * Each finder plus its light separator — the 8x8 blocks background art must be
 * masked out of, so nothing ever bleeds into a finder or the light ring that
 * delimits it.
 */
export function finderZones(count: number): readonly QrRegion[] {
  const far = count - QR_FINDER_ZONE_SIZE;
  return [
    { row: 0, col: 0, size: QR_FINDER_ZONE_SIZE },
    { row: 0, col: far, size: QR_FINDER_ZONE_SIZE },
    { row: far, col: 0, size: QR_FINDER_ZONE_SIZE },
  ];
}

/**
 * True inside one of the three 7x7 finder patterns. These must stay solid
 * module-colour on background-colour; rounding their corners is safe, tinting or
 * occluding them is not.
 */
export function isFinderModule(row: number, col: number, count: number): boolean {
  return finderOrigins(count).some((region) => isInRegion(row, col, region));
}

/** True inside a finder pattern *or* its light separator — the no-art region. */
export function isFinderZoneModule(row: number, col: number, count: number): boolean {
  return finderZones(count).some((region) => isInRegion(row, col, region));
}

/**
 * True on a timing pattern. Deliberately the whole of row 6 and column 6 rather
 * than only the stretch between the finders: the ends are function modules too,
 * and a conservative predicate cannot be the reason a QR stops scanning.
 */
export function isTimingModule(row: number, col: number, count: number): boolean {
  if (row < 0 || col < 0 || row >= count || col >= count) {
    return false;
  }
  return row === QR_TIMING_INDEX || col === QR_TIMING_INDEX;
}

/** True on any module decoration must leave alone. */
export function isFunctionModule(row: number, col: number, count: number): boolean {
  return isFinderModule(row, col, count) || isTimingModule(row, col, count);
}
