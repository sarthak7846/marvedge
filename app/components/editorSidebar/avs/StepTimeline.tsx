import React from "react";

import type { Step } from "@/app/types/avs";

interface StepTimelineProps {
  steps: Step[];
  duration: number;
  currentTime: number;
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  /** Move the boundary between step `index` and `index + 1` to `time` (seconds). */
  onAdjustBoundary: (index: number, time: number) => void;
}

/** Compact m:ss.d readout for a step length. */
function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return mins > 0 ? `${mins}:${secs.toFixed(1).padStart(4, "0")}` : `${secs.toFixed(1)}s`;
}

/**
 * Horizontal step timeline for the AVS panel. Renders each step as a proportion
 * of the video duration, shows a live playhead, and lets the user drag the
 * boundaries between adjacent steps. Purely presentational: split / merge and
 * persistence live in the parent (AvsPanel).
 */
const StepTimeline: React.FC<StepTimelineProps> = ({
  steps,
  duration,
  currentTime,
  selectedStepId,
  onSelectStep,
  onAdjustBoundary,
}) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const pct = React.useCallback(
    (time: number) =>
      safeDuration > 0 ? Math.max(0, Math.min(100, (time / safeDuration) * 100)) : 0,
    [safeDuration]
  );

  const timeFromClientX = React.useCallback(
    (clientX: number): number | null => {
      const el = trackRef.current;
      if (!el || safeDuration <= 0) {
        return null;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) {
        return null;
      }
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, ratio)) * safeDuration;
    },
    [safeDuration]
  );

  React.useEffect(() => {
    if (dragIndex === null) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      const time = timeFromClientX(e.clientX);
      if (time !== null) {
        onAdjustBoundary(dragIndex, time);
      }
    };
    const onUp = () => setDragIndex(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragIndex, timeFromClientX, onAdjustBoundary]);

  if (safeDuration <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#ede7fa] bg-[#F6F3FF] px-4 py-6 text-center text-sm text-[#7C5CFC]">
        Load a video to edit steps.
      </div>
    );
  }

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        className="relative h-14 w-full overflow-hidden rounded-lg border border-[#A594F9] bg-white dark:bg-[#0a081a]"
      >
        {steps.map((step, idx) => {
          const left = pct(step.startTime);
          const width = pct(step.endTime) - left;
          const selected = step.id === selectedStepId;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep(selected ? null : step.id)}
              title={`Step ${idx + 1} · ${formatDuration(step.endTime - step.startTime)}`}
              className={`absolute top-0 flex h-full items-center justify-center overflow-hidden border-r border-white/70 text-[11px] font-semibold transition-colors last:border-r-0 ${
                selected
                  ? "bg-[#8A76FC] text-white"
                  : idx % 2 === 0
                    ? "bg-[#F6F3FF] text-[#7C5CFC] hover:bg-[#ede7fa]"
                    : "bg-[#ede7fa] text-[#7C5CFC] hover:bg-[#e2d9fb]"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="truncate px-1">{idx + 1}</span>
            </button>
          );
        })}

        {/* Draggable interior boundaries (between step i and i+1). */}
        {steps.slice(0, -1).map((step, idx) => (
          <div
            key={`boundary-${step.id}`}
            role="separator"
            aria-orientation="vertical"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragIndex(idx);
            }}
            className="absolute top-0 z-20 h-full w-2 -translate-x-1/2 cursor-ew-resize"
            style={{ left: `${pct(step.endTime)}%` }}
          >
            <div className="mx-auto h-full w-px bg-[#8A76FC]" />
          </div>
        ))}

        {/* Live playhead. */}
        <div
          className="pointer-events-none absolute top-0 z-10 h-full w-px bg-green-500"
          style={{ left: `${pct(currentTime)}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[11px] font-medium text-[#A594F9]">
        <span>0.0s</span>
        <span>{formatDuration(safeDuration)}</span>
      </div>
    </div>
  );
};

export default StepTimeline;
