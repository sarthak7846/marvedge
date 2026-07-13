import React from "react";

import StepTimeline from "./avs/StepTimeline";
import { useStepEditing } from "./avs/useStepEditing";

/**
 * AVS ("AI Voice & Script") sidebar panel.
 *
 * PR 2 fills the scaffold with step editing: the demo auto-slices into steps
 * from click-capture timestamps (reusing the auto-zoom ingestion, #216), shown
 * on a timeline where the user can split at the playhead, merge adjacent steps,
 * and drag boundaries. Steps persist to `Demo.editing.avs.steps` via the
 * existing autosave (it already serializes the store's `avs` field).
 *
 * The whole panel is gated behind NEXT_PUBLIC_AVS_ENABLED by its parents
 * (EditorSidebar / SidebarHeader), so nothing here runs when the flag is off.
 */
const AvsPanel: React.FC = () => {
  const {
    steps,
    duration,
    currentTime,
    selectedStepId,
    setSelectedStepId,
    clickTimes,
    splittable,
    canMerge,
    handleSplit,
    handleMerge,
    handleAutoSlice,
    handleAdjustBoundary,
  } = useStepEditing();

  const btnBase =
    "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-1">
          AI Voice &amp; Script
        </h2>
        <p className="text-xs text-[#6B6B6B] dark:text-inherit mb-4">
          Break the demo into steps. Each step becomes a unit for the AI script and synced
          voiceover.
        </p>

        <StepTimeline
          steps={steps}
          duration={duration}
          currentTime={currentTime}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onAdjustBoundary={handleAdjustBoundary}
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSplit}
            disabled={!splittable}
            className={`${btnBase} bg-[#8A76FC] text-white hover:bg-[#7A66EC]`}
          >
            Split at playhead
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={!canMerge}
            className={`${btnBase} border border-[#A594F9] text-[#7C5CFC] hover:bg-[#F6F3FF]`}
          >
            Merge selected
          </button>
        </div>

        <button
          type="button"
          onClick={handleAutoSlice}
          disabled={clickTimes.length === 0}
          className={`${btnBase} mt-2 w-full border border-[#A594F9] text-[#7C5CFC] hover:bg-[#F6F3FF]`}
        >
          {clickTimes.length > 0
            ? `Auto-slice from ${clickTimes.length} click${clickTimes.length === 1 ? "" : "s"}`
            : "No clicks captured"}
        </button>

        <p className="mt-3 text-[11px] text-[#6B6B6B] dark:text-inherit">
          {steps.length} step{steps.length === 1 ? "" : "s"}
          {" · select a step to merge, or drag a boundary to adjust."}
        </p>
      </div>
    </div>
  );
};

export default AvsPanel;
