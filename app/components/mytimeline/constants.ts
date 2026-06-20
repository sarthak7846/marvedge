export const HEIGHT = 90;
export const MARGIN = 40;
export const TIMELINE_Y = 40;
export const TIMELINE_HEIGHT = 12; // Matches Figma ruler thickness
export const HANDLE_WIDTH = 20; // Matches Figma triangle base
export const HANDLE_HEIGHT = 24; // Matches Figma triangle height
export const RULER_COLOR = "#A594F9"; // Figma purple
export const TRIM_COLOR = "#E6E1FA"; // Light background
export const HANDLE_COLOR = "#A594F9"; // Figma handle color
export const TICK_COLOR = "#A594F9";
export const LABEL_COLOR = "#A594F9";

// Helper function to convert time string to seconds
export const convertTimeStringToSeconds = (timeString: string): number => {
  const parts = timeString.split(":");
  if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
};

export type Tick = { time: number; x: number };
export type MajorTick = { time: number; x: number; label: string };

// Major ticks (every 20 seconds), minor ticks (every 5 seconds), and micro ticks (every 1 second)
export function computeTicks(duration: number, timeToX: (t: number) => number) {
  const majorTickCount = 5; // 0, 20, 40, 60, 80 (or dynamic duration)
  const minorTickInterval = 5; // Minor ticks every 5 seconds
  const microTickInterval = 1; // Micro ticks every 1 second for finer granularity

  const majorTicks: MajorTick[] = Array.from({ length: majorTickCount }, (_, i) => {
    const t = ((duration || 80.0) * i) / (majorTickCount - 1);
    return {
      time: t,
      x: timeToX(t),
      label: t.toFixed(2),
    };
  });

  const minorTicks: Tick[] = [];
  for (let i = 0; i <= (duration || 80.0); i += minorTickInterval) {
    minorTicks.push({
      time: i,
      x: timeToX(i),
    });
  }

  const microTicks: Tick[] = [];
  for (let i = 0; i <= (duration || 80.0); i += microTickInterval) {
    microTicks.push({
      time: i,
      x: timeToX(i),
    });
  }

  return { majorTicks, minorTicks, microTicks };
}
