import React from "react";

/**
 * AVS ("AI Voice & Script") sidebar panel — scaffold only.
 *
 * PR 1 ships this as an empty shell behind the client feature flag
 * (NEXT_PUBLIC_AVS_ENABLED). Later AVS PRs fill it in: step editing, AI script,
 * Deepgram Aura voiceover, subtitle stabilization and time-alignment. Styling
 * mirrors ToolsPanel so it drops into the existing sidebar unchanged.
 */
const AvsPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">
          AI Voice &amp; Script
        </h2>
        <div className="rounded-lg border border-[#ede7fa] bg-[#F6F3FF] px-4 py-6 text-sm text-[#7C5CFC]">
          <p className="font-semibold">Coming soon</p>
          <p className="mt-1 text-[#6B6B6B] dark:text-inherit">
            Generate an AI script, voiceover, and perfectly synced audio for your demo.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AvsPanel;
