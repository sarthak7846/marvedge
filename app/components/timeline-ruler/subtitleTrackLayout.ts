// Layout and drag arithmetic for the timeline's subtitle track (SUB-6.4).
//
// Pure: no DOM, no React, no store. Everything here is seconds in, pixels out
// (or seconds in, seconds out), so the density heuristics and the drag clamping
// can be unit-tested without a browser — which matters, because the interesting
// cases (150 cues, a cue wedged between two neighbours, a drag that reverses)
// are exactly the ones that are miserable to reproduce by hand.
//
// WHY THIS ISN'T IN app/lib/subtitles/
// ------------------------------------
// That library is the isomorphic cue algebra shared by the panel, the route
// handlers and the worker. This module talks about pixels, zoom levels and
// scroll offsets — it is view logic that only the timeline ruler has any use
// for, and shipping it into the shared library would mean the render worker
// imports a pixel layout engine.

import { MIN_CUE_SECONDS } from "@/app/lib/subtitles";
import type { SubtitleCue } from "@/app/(signed)/editor/types";

/**
 * Narrowest a cue block may be drawn and still be draggable, in pixels.
 *
 * Two 9px edge handles plus a 10px body to grab in the middle. Below this the
 * block collapses into a cluster (see `layoutSubtitleTrack`) rather than being
 * rendered as an un-hittable sliver.
 */
export const SUBTITLE_MIN_BLOCK_PX = 28;

/**
 * Widest a collapsed cluster may grow before it is closed and a new one starts.
 *
 * Without a cap, a densely-subtitled video — where every cue is a few pixels
 * wide and each abuts the next — collapses into ONE bar spanning the whole
 * track, which tells the user nothing except "there are subtitles somewhere".
 * Capping the width keeps roughly a screen-width's worth of clusters, so the
 * track still shows WHERE the dense regions are and each cluster is a
 * drill-down target for a region of a few tens of seconds.
 */
export const SUBTITLE_CLUSTER_MAX_PX = 96;

/** Snap radius for a drag, in pixels — constant on screen at every zoom level. */
export const SUBTITLE_SNAP_PX = 8;

/**
 * Pointer travel before a mousedown counts as a drag rather than a click.
 *
 * Without it, clicking a block to select it re-times the cue: the browser can
 * report a zero-distance mousemove, and a zero-distance drag still snaps.
 */
export const SUBTITLE_DRAG_THRESHOLD_PX = 3;

/** Ceiling `useTimelineZoom` (and the toolbar slider) enforces on `zoomLevel`. */
export const TIMELINE_MAX_ZOOM = 20;

/** One cue, wide enough at the current zoom to be dragged and resized. */
export interface SubtitleCueItem {
  kind: "cue";
  /** Index into the cue list — the handle every mutation is addressed by. */
  index: number;
  cue: SubtitleCue;
  leftPx: number;
  widthPx: number;
}

/**
 * A run of consecutive cues too narrow to draw individually at this zoom.
 * Not draggable: clicking one zooms in until its cues become `SubtitleCueItem`s.
 */
export interface SubtitleClusterItem {
  kind: "cluster";
  /** Inclusive index range of the cues collapsed into this bar. */
  fromIndex: number;
  toIndex: number;
  count: number;
  leftPx: number;
  widthPx: number;
  startSeconds: number;
  endSeconds: number;
}

export type SubtitleTrackItem = SubtitleCueItem | SubtitleClusterItem;

export interface SubtitleTrackLayoutOptions {
  minValue: number;
  maxValue: number;
  /** Track width in pixels at the current zoom (`baseTimelineWidth * zoomLevel`). */
  zoomedTimelineWidth: number;
  /** Override the collapse threshold. Defaults to `SUBTITLE_MIN_BLOCK_PX`. */
  minBlockPx?: number;
  /** Override the cluster width cap. Defaults to `SUBTITLE_CLUSTER_MAX_PX`. */
  clusterMaxPx?: number;
}

/** Pixels per second at the current zoom; `0` for a degenerate timeline. */
export function pixelsPerSecond(options: {
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
}): number {
  const span = options.maxValue - options.minValue;
  if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(options.zoomedTimelineWidth)) {
    return 0;
  }
  return options.zoomedTimelineWidth / span;
}

/**
 * The snap radius in seconds, for a drag at the current zoom.
 *
 * `SUBTITLE_SNAP_PX` is a constant on SCREEN, which is what makes snapping feel
 * the same however far in the user is zoomed. Converted naively, though, it is a
 * constant that grows without limit as the zoom drops: eight pixels on a
 * ten-minute demo at 1x is five seconds, wide enough that touching a block at
 * all would fling it onto a neighbour. So it is also capped in the time domain,
 * at the shortest duration a cue is allowed to have — snapping should never
 * move a cue further than the smallest cue that could exist.
 */
export function snapSecondsForZoom(pps: number, snapPx = SUBTITLE_SNAP_PX): number {
  if (!(pps > 0)) {
    return 0;
  }
  return Math.min(snapPx / pps, MIN_CUE_SECONDS);
}

/**
 * THE DENSITY SOLUTION.
 *
 * A 10-minute demo transcribes to roughly 150 cues. At default zoom the track is
 * ~956px wide, so the average cue is six pixels across — narrower than the two
 * resize handles it would need, let alone a body to grab. Rendering 150 slivers
 * produces a track that looks plausible in a screenshot and cannot be used.
 *
 * So the track renders at two levels of detail, decided per cue by its width at
 * the current zoom:
 *
 *  - **Wide enough** (`>= minBlockPx`, and with clear air before the next cue) —
 *    a real block: draggable, resizable, labelled with its text.
 *  - **Too narrow** — collapsed with its neighbours into a cluster bar carrying
 *    a count. Clicking one zooms into it (see `zoomLevelForCluster`), which is
 *    the affordance that gets the user from "150 slivers" to "eight blocks I can
 *    grab" in one click.
 *
 * Clusters are computed from the cue list and the zoom alone — never from the
 * scroll position — so their boundaries stay put while the user scrolls.
 * Culling for the viewport is a separate, later step
 * (`cullSubtitleTrackItems`), for the same reason.
 *
 * Cues are assumed sorted and non-overlapping (`normalizeCues`' invariant).
 */
export function layoutSubtitleTrack(
  cues: readonly SubtitleCue[],
  options: SubtitleTrackLayoutOptions
): SubtitleTrackItem[] {
  const { minValue } = options;
  const pps = pixelsPerSecond(options);
  if (pps <= 0 || cues.length === 0) {
    return [];
  }

  const minBlockPx = options.minBlockPx ?? SUBTITLE_MIN_BLOCK_PX;
  const clusterMaxPx = options.clusterMaxPx ?? SUBTITLE_CLUSTER_MAX_PX;
  const px = (seconds: number) => (seconds - minValue) * pps;

  const items: SubtitleTrackItem[] = [];
  let i = 0;

  while (i < cues.length) {
    const left = px(cues[i].start);
    const right = px(cues[i].end);

    if (right - left >= minBlockPx) {
      items.push({ kind: "cue", index: i, cue: cues[i], leftPx: left, widthPx: right - left });
      i += 1;
      continue;
    }

    // Collapse this cue, and every following one that the growing bar would be
    // drawn on top of, into a single clickable run.
    //
    // The bar is only ever widened to the run's real span (or to `minBlockPx`
    // when a lone short cue has room to spare after it), never past it, so two
    // items can never be drawn overlapping — which is the whole point of
    // collapsing rather than enforcing a minimum width per cue.
    const from = i;
    let spanRight = right;
    let barRight = Math.max(spanRight, left + minBlockPx);
    let j = i + 1;

    while (j < cues.length) {
      const nextLeft = px(cues[j].start);
      const clearOfBar = nextLeft >= barRight;
      // Let the next cue out of the cluster once it stands clear of the bar and
      // either is wide enough on its own or the bar has reached its cap.
      if (
        clearOfBar &&
        (px(cues[j].end) - nextLeft >= minBlockPx || barRight - left >= clusterMaxPx)
      ) {
        break;
      }
      spanRight = Math.max(spanRight, px(cues[j].end));
      barRight = Math.max(spanRight, left + minBlockPx);
      j += 1;
    }

    const widthPx = barRight - left;
    items.push({
      kind: "cluster",
      fromIndex: from,
      toIndex: j - 1,
      count: j - from,
      // A lone short cue at the very end would otherwise push its padded bar off
      // the end of the track and give the container something to scroll to.
      leftPx: Math.max(0, Math.min(left, options.zoomedTimelineWidth - widthPx)),
      widthPx,
      startSeconds: cues[from].start,
      endSeconds: cues[j - 1].end,
    });
    i = j;
  }

  return items;
}

/**
 * Drop the items that fall outside the visible pixel window.
 *
 * Separate from the layout on purpose: clustering must not depend on the scroll
 * offset (see `layoutSubtitleTrack`), and this is the cheap pass that keeps the
 * DOM small when a long demo is zoomed in — at 20x only a handful of blocks are
 * on screen, and mounting the rest costs a re-render on every scroll frame.
 *
 * `padPx` keeps a margin of off-screen items mounted so a block being dragged
 * past the edge does not unmount mid-gesture.
 */
export function cullSubtitleTrackItems(
  items: readonly SubtitleTrackItem[],
  viewportLeftPx: number,
  viewportWidthPx: number,
  padPx = 240
): SubtitleTrackItem[] {
  if (!Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0) {
    return items.slice();
  }
  const from = viewportLeftPx - padPx;
  const to = viewportLeftPx + viewportWidthPx + padPx;
  return items.filter((item) => item.leftPx + item.widthPx >= from && item.leftPx <= to);
}

/**
 * The zoom level at which a cluster's cues become individually draggable.
 *
 * Sized off the cluster's MEAN cue duration rather than its shortest: one 0.2s
 * cue in the run would otherwise demand a zoom far past the 20x ceiling and the
 * result would be clamped anyway, wasting the click. At the mean, the great
 * majority of the run becomes draggable and anything still too short stays a
 * (now much smaller) cluster the user can click again.
 *
 * The 1.5 factor is headroom, so blocks land comfortably above the collapse
 * threshold instead of flickering across it.
 */
export function zoomLevelForCluster(
  cues: readonly SubtitleCue[],
  cluster: SubtitleClusterItem,
  options: {
    minValue: number;
    maxValue: number;
    baseTimelineWidth: number;
    minBlockPx?: number;
    maxZoom?: number;
  }
): number {
  const { minValue, maxValue, baseTimelineWidth } = options;
  const minBlockPx = options.minBlockPx ?? SUBTITLE_MIN_BLOCK_PX;
  const maxZoom = options.maxZoom ?? TIMELINE_MAX_ZOOM;
  const span = maxValue - minValue;

  if (!(span > 0) || !(baseTimelineWidth > 0)) {
    return 1;
  }

  let total = 0;
  let counted = 0;
  for (let i = cluster.fromIndex; i <= cluster.toIndex && i < cues.length; i += 1) {
    const duration = cues[i].end - cues[i].start;
    if (duration > 0) {
      total += duration;
      counted += 1;
    }
  }
  if (counted === 0) {
    return maxZoom;
  }

  const meanDuration = total / counted;
  const neededWidthPx = ((minBlockPx * 1.5) / meanDuration) * span;
  const zoom = neededWidthPx / baseTimelineWidth;
  return Math.min(maxZoom, Math.max(1, zoom));
}

/** Scroll offset that centres `seconds` in the viewport, clamped to the track. */
export function scrollLeftForTime(
  seconds: number,
  options: {
    minValue: number;
    maxValue: number;
    zoomedTimelineWidth: number;
    viewportWidthPx: number;
  }
): number {
  const pps = pixelsPerSecond(options);
  if (pps <= 0) {
    return 0;
  }
  const centre = (seconds - options.minValue) * pps;
  const maxScroll = Math.max(0, options.zoomedTimelineWidth - options.viewportWidthPx);
  return Math.max(0, Math.min(centre - options.viewportWidthPx / 2, maxScroll));
}

/** Snap `value` to the nearest target within `tolerance`, else leave it alone. */
export function snapTime(value: number, targets: readonly number[], tolerance: number): number {
  if (!(tolerance > 0)) {
    return value;
  }
  let best = value;
  let bestDelta = tolerance;
  for (const target of targets) {
    if (!Number.isFinite(target)) {
      continue;
    }
    const delta = Math.abs(target - value);
    if (delta <= bestDelta) {
      bestDelta = delta;
      best = target;
    }
  }
  return best;
}

/** One in-flight drag, expressed against the values captured at mousedown. */
export interface CueDragGesture {
  /** Index into the ORIGIN list. Stable for the whole gesture — see `resolveCueDrag`. */
  index: number;
  mode: "edge" | "segment";
  /** Which edge is being dragged. `edge` mode only. */
  side?: "left" | "right";
  /** The dragged edge's value at mousedown (`segment` mode: the block's start). */
  startValue: number;
  /** The block's end at mousedown. `segment` mode only. */
  endValue?: number;
  /** Seconds the pointer has travelled since mousedown. */
  deltaSeconds: number;
}

export interface CueDragBounds {
  minValue: number;
  maxValue: number;
  /** Snap radius in seconds — `SUBTITLE_SNAP_PX` converted at the current zoom. */
  snapSeconds: number;
  /** Playhead position, a snap target. Omit when it is not meaningful. */
  playheadSeconds?: number;
  /** Structural floor on a cue's duration. Defaults to `MIN_CUE_SECONDS`. */
  minCueSeconds?: number;
}

/**
 * Resolve a drag into a complete candidate cue list.
 *
 * TWO PROPERTIES THIS BUYS, BOTH LOAD-BEARING:
 *
 * 1. **It is computed from the ORIGIN list, not the previous frame.** The caller
 *    snapshots the cue list at mousedown and passes that same snapshot on every
 *    mousemove. So a drag that consumes part of a neighbour and is then dragged
 *    back restores that neighbour exactly, floating-point drift cannot
 *    accumulate over a gesture, and the whole drag collapses to one undo step.
 *
 * 2. **The dragged cue can never cross a neighbour**, because a neighbour yields
 *    only down to `minCueSeconds` and the drag clamps there. Sort order is
 *    therefore preserved for the whole gesture, which is what makes addressing
 *    the cue by INDEX safe: `normalizeCues` re-sorts after every frame, and an
 *    index that could reorder mid-drag would silently start re-timing a
 *    different cue halfway through.
 *
 * WHO YIELDS. The cue you are dragging wins; the neighbour it moves into is
 * truncated at the new boundary, down to `minCueSeconds`, and the drag clamps
 * there. This is deliberately NOT delegated to `normalizeCues`' overlap rule,
 * which is asymmetric on purpose — it always truncates the EARLIER cue, so a
 * rightward drag would shrink the block being dragged instead of the one it is
 * pushing into. `normalizeCues` still runs on the result as the backstop; this
 * function decides intent, that one enforces the invariant.
 *
 * Cascading stops at one neighbour on each side: a drag long enough to consume a
 * whole neighbour clamps rather than rippling down the rest of the timeline and
 * re-timing work the user never touched.
 *
 * Returns `null` when the gesture addresses no cue.
 */
export function resolveCueDrag(
  origin: readonly SubtitleCue[],
  gesture: CueDragGesture,
  bounds: CueDragBounds
): SubtitleCue[] | null {
  const cue = origin[gesture.index];
  if (!cue) {
    return null;
  }

  const { minValue, maxValue, snapSeconds } = bounds;
  const minCue = bounds.minCueSeconds ?? MIN_CUE_SECONDS;
  const prev = origin[gesture.index - 1];
  const next = origin[gesture.index + 1];

  // Snap targets: the boundaries this cue can actually be brought flush against
  // — where each neighbour meets it, the playhead, and the ends of the timeline.
  // A neighbour's FAR edge is not a target: the clamping below puts it out of
  // reach, so offering it would only pull the drag towards a wall.
  const targets: number[] = [minValue, maxValue];
  if (prev) {
    targets.push(prev.end);
  }
  if (next) {
    targets.push(next.start);
  }
  if (typeof bounds.playheadSeconds === "number") {
    targets.push(bounds.playheadSeconds);
  }

  // How far the block may reach before a neighbour would be squeezed below the
  // structural minimum.
  const floor = Math.max(minValue, prev ? prev.start + minCue : minValue);
  const ceiling = Math.min(maxValue, next ? next.end - minCue : maxValue);

  const out = origin.slice();
  let start = cue.start;
  let end = cue.end;

  if (gesture.mode === "segment") {
    const width = (gesture.endValue ?? cue.end) - gesture.startValue;
    const raw = gesture.startValue + gesture.deltaSeconds;
    // Snap whichever edge lands closest to a target, then move the block as a
    // unit — snapping the two edges independently would change its duration.
    // An edge that found nothing to snap to is not a candidate at all: its
    // "correction" is zero, which would otherwise always beat a real snap.
    const rawEnd = raw + width;
    const snappedStart = snapTime(raw, targets, snapSeconds);
    const snappedEnd = snapTime(rawEnd, targets, snapSeconds);
    const startShift = snappedStart === raw ? null : snappedStart - raw;
    const endShift = snappedEnd === rawEnd ? null : snappedEnd - rawEnd;

    let candidate = raw;
    if (startShift !== null && (endShift === null || Math.abs(startShift) <= Math.abs(endShift))) {
      candidate = snappedStart;
    } else if (endShift !== null) {
      candidate = snappedEnd - width;
    }

    start = Math.max(floor, Math.min(candidate, ceiling - width));
    end = start + width;
  } else if (gesture.side === "left") {
    const raw = snapTime(gesture.startValue + gesture.deltaSeconds, targets, snapSeconds);
    start = Math.max(floor, Math.min(raw, cue.end - minCue));
  } else {
    const raw = snapTime(gesture.startValue + gesture.deltaSeconds, targets, snapSeconds);
    end = Math.min(ceiling, Math.max(raw, cue.start + minCue));
  }

  out[gesture.index] = { ...cue, start, end };
  if (prev && start < prev.end) {
    out[gesture.index - 1] = { ...prev, end: start };
  }
  if (next && end > next.start) {
    out[gesture.index + 1] = { ...next, start: end };
  }
  return out;
}
