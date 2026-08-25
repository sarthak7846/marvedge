export function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
