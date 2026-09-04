// Pure playback math for the player: clock formatting, threshold crossing,
// completion coverage, buffered ranges and seek clamping.
//
// It lives in app/lib/overlays/ rather than next to the component for one
// reason: this is the arithmetic that is easy to get subtly wrong and
// impossible to notice — an off-by-one on the completion ratio moves the
// conversion number for every demo, and nobody would see it in a browser. Kept
// DOM-free (hence BufferedRange rather than TimeRanges) so it can be unit
// tested without a jsdom, which is why the repo has no UI tests.

/** A DOM-free mirror of one entry in a media element's `buffered` TimeRanges. */
export interface BufferedRange {
  start: number;
  end: number;
}

/** Fraction of the duration that counts as "watched the whole thing". */
export const COMPLETION_RATIO = 0.95;

/** Seconds an arrow-key press moves the playhead. */
export const SEEK_STEP_SECONDS = 5;

/**
 * Format a position as a clock. Under an hour it is m:ss (matching what a native
 * control bar shows) and over an hour it grows a leading h:.
 *
 * Anything not a finite non-negative number renders "0:00" rather than "NaN:aN":
 * `duration` is genuinely NaN until metadata loads, so this is the normal case
 * on first paint, not an error path.
 */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const secs = total % 60;
  const mins = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}

/**
 * Did the playhead move from before `threshold` to at-or-after it?
 *
 * THIS IS A CROSSING TEST, NOT A TIMER, and that is the whole point. A viewer
 * who drags the scrub handle from 0:10 to the last second never has a tick land
 * near the threshold, so a setTimeout scheduled at "duration - 5s" would never
 * fire and the branch cards in PR 5 would never appear for exactly the viewer
 * most likely to be looking for what comes next. Comparing the previous tick's
 * position to this one's catches the jump, because the jump passes over the
 * threshold even though no tick landed on it.
 *
 * A backwards seek is not a crossing (prev >= threshold > next), so re-watching
 * does not re-fire. Callers that must fire once still need their own latch —
 * this answers "did we just pass it", not "have we ever passed it".
 *
 * A threshold at or below zero never crosses: there is no position before it to
 * come from. An "at the very start" trigger is a distinct case and its caller
 * (the lead gate in PR 3) handles it explicitly rather than pretending it is a
 * crossing.
 */
export function crossedThreshold(prev: number, next: number, threshold: number): boolean {
  if (!Number.isFinite(prev) || !Number.isFinite(next) || !Number.isFinite(threshold)) {
    return false;
  }
  if (threshold <= 0) {
    return false;
  }
  return prev < threshold && next >= threshold;
}

/**
 * The position at which a video counts as completed, or undefined while the
 * duration is still unknown.
 *
 * Live/unbounded streams report Infinity for duration and have no completion
 * point at all; returning undefined keeps the caller from computing
 * `Infinity * 0.95` and comparing against it forever.
 */
export function completionThresholdSec(
  duration: number,
  ratio: number = COMPLETION_RATIO
): number | undefined {
  if (!Number.isFinite(duration) || duration <= 0) {
    return undefined;
  }
  return duration * ratio;
}

/**
 * Has the viewer reached the end, by either route?
 *
 * `ended` is the honest signal and always wins. The coverage test is the second
 * route: a viewer who scrubs to the final seconds and leaves converted just as
 * much as one who sat through it, and would otherwise never be counted because
 * `ended` only fires if playback actually runs off the end.
 */
export function isCompleted(currentTime: number, duration: number, ended: boolean): boolean {
  if (ended) {
    return true;
  }
  const threshold = completionThresholdSec(duration);
  if (threshold === undefined) {
    return false;
  }
  return currentTime >= threshold;
}

/**
 * End of the buffered range containing `time`, for painting the buffered bar.
 *
 * Returns `time` itself when no range covers it, so the bar renders as "nothing
 * buffered ahead" rather than jumping backwards to a stale earlier range after a
 * seek into un-downloaded territory.
 */
export function bufferedEndAt(ranges: readonly BufferedRange[], time: number): number {
  if (!Number.isFinite(time)) {
    return 0;
  }
  for (const range of ranges) {
    if (time >= range.start && time <= range.end) {
      return range.end;
    }
  }
  return time;
}

/** Clamp a seek target into [0, duration], tolerating an unknown duration. */
export function clampSeek(target: number, duration: number): number {
  if (!Number.isFinite(target) || target < 0) {
    return 0;
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return target;
  }
  return Math.min(target, duration);
}

/**
 * Fraction of the track a pointer at `clientX` represents, clamped to [0, 1].
 *
 * A zero-width track (measured before layout, or hidden) yields 0 rather than
 * NaN — a NaN here would reach video.currentTime and throw.
 */
export function trackFraction(clientX: number, trackLeft: number, trackWidth: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(trackLeft) || !(trackWidth > 0)) {
    return 0;
  }
  const fraction = (clientX - trackLeft) / trackWidth;
  if (!Number.isFinite(fraction)) {
    return 0;
  }
  return Math.min(1, Math.max(0, fraction));
}

/** Progress as a 0-1 fraction, safe against an unknown duration. */
export function progressFraction(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, currentTime / duration));
}
