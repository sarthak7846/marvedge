import React from "react";

import type { PipelineStage, StageStatus } from "./useAvsPipeline";

/**
 * The headline AVS action (PR 7): one "Generate AI Voiceover Demo" button that
 * runs the whole pipeline — steps → script → voiceover → subtitles →
 * time-alignment → export — with a per-stage progress list. All logic lives in
 * `useAvsPipeline`; this component is presentational.
 */
interface AvsPipelineProps {
  stages: PipelineStage[];
  running: boolean;
  canRun: boolean;
  blockedReason: string | null;
  exportedUrl: string | null;
  onRun: () => void;
}

const STATUS_STYLES: Record<StageStatus, { symbol: string; className: string }> = {
  pending: { symbol: "○", className: "text-[#C4B9F5]" },
  running: { symbol: "◐", className: "text-[#7C5CFC] animate-pulse" },
  done: { symbol: "✓", className: "text-[#36b37e]" },
  warning: { symbol: "!", className: "text-[#E5A200]" },
  error: { symbol: "✕", className: "text-[#E5484D]" },
};

const StageRow: React.FC<{ stage: PipelineStage }> = ({ stage }) => {
  const { symbol, className } = STATUS_STYLES[stage.status];
  return (
    <li className="flex items-start gap-2 py-1">
      <span className={`mt-0.5 w-4 shrink-0 text-center text-xs font-bold ${className}`}>
        {symbol}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className={`text-xs font-semibold ${
            stage.status === "pending"
              ? "text-[#9a9a9a] dark:text-inherit"
              : "text-[#4b4b4b] dark:text-inherit"
          }`}
        >
          {stage.label}
        </span>
        {stage.note ? (
          <span className="ml-1.5 text-[11px] text-[#8f8f8f] dark:text-inherit">
            · {stage.note}
          </span>
        ) : null}
      </div>
    </li>
  );
};

const AvsPipeline: React.FC<AvsPipelineProps> = ({
  stages,
  running,
  canRun,
  blockedReason,
  exportedUrl,
  onRun,
}) => {
  const started = running || stages.some((s) => s.status !== "pending");

  return (
    <div className="rounded-xl border border-[#ede7fa] bg-[#F6F3FF] p-4 dark:bg-transparent">
      <h3 className="control-block-label mb-1 text-sm font-bold text-[#A594F9]">
        One-click AI voiceover
      </h3>
      <p className="mb-3 text-[11px] text-[#6B6B6B] dark:text-inherit">
        Runs the whole pipeline — steps, script, voiceover, captions, sync, and export — into one
        AI-voiced, synced, subtitled video.
      </p>

      <button
        type="button"
        onClick={onRun}
        disabled={running || !canRun}
        className="w-full rounded-lg bg-[#8A76FC] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#7A66EC] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Generating…" : "Generate AI Voiceover Demo"}
      </button>

      {!canRun && blockedReason ? (
        <p className="mt-2 text-[11px] text-[#E5A200]">{blockedReason}</p>
      ) : null}

      {started ? (
        <ul className="mt-3 border-t border-[#ede7fa] pt-2">
          {stages.map((stage) => (
            <StageRow key={stage.id} stage={stage} />
          ))}
        </ul>
      ) : null}

      {exportedUrl ? (
        <a
          href={exportedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full rounded-lg border border-[#A594F9] px-3 py-2 text-center text-xs font-semibold text-[#7C5CFC] transition hover:bg-white"
        >
          Open exported video
        </a>
      ) : null}
    </div>
  );
};

export default AvsPipeline;
