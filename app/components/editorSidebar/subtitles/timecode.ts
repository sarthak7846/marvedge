/**
 * Timecode formatting for the subtitle panel's editable timing fields.
 *
 * Deliberately NOT in app/lib/subtitles: the serializers there speak the
 * `HH:MM:SS.mmm` that SRT and VTT files require, which is too wide to type into
 * a 320px sidebar and carries a millisecond digit no one is going to nudge by
 * hand. This is the editor's own compact `m:ss.cs` readout — centisecond
 * precision, as the PRD's acceptance criteria ask for — and it exists only to be
 * shown in an input and read back out of it.
 */

/** Seconds → `m:ss.cs`, e.g. `73.456` → `"1:13.46"`. Minutes are not wrapped into hours. */
export function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  // Round to centiseconds first, so 59.999 reads as 1:00.00 rather than 0:60.00.
  const centis = Math.round(safe * 100);
  const mins = Math.floor(centis / 6000);
  const secs = Math.floor((centis % 6000) / 100);
  const cs = centis % 100;
  return `${mins}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * `m:ss.cs` → seconds, tolerating what someone actually types: a bare number of
 * seconds (`"12.5"`), `m:ss`, `h:mm:ss`, and either separator for the fraction.
 * Returns `null` for anything it cannot read, so the caller can revert the field
 * instead of committing a `NaN` into the cue list.
 */
export function parseTimecode(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":");
  if (parts.length > 3) {
    return null;
  }

  // Each part is a plain (possibly fractional) number, folded in at 60x the
  // previous one: "s", then "m:s", then "h:m:s".
  let seconds = 0;
  for (const part of parts) {
    if (part === "" || part === "." || !/^\d*\.?\d*$/.test(part)) {
      return null;
    }
    seconds = seconds * 60 + Number(part);
  }

  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** Compact `1.8s` / `12s` length readout for a cue. */
export function formatSpan(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return safe < 10 ? `${safe.toFixed(1)}s` : `${Math.round(safe)}s`;
}
