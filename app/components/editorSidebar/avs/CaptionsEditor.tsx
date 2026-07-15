import React from "react";

import type { CaptionsGeneration } from "./useCaptions";

/**
 * AVS captions editor (AVS-2.3). Generates flicker-free captions from the
 * voiceover audio and lets the user export them as a `.vtt` file. All state
 * lives in the `useCaptions` hook; this component is presentational.
 */
const CaptionsEditor: React.FC<CaptionsGeneration> = ({
  hasVoiceover,
  generating,
  captions,
  handleGenerate,
  handleDownloadVtt,
}) => {
  const hasCaptions = !!captions && captions.length > 0;

  return (
    <div>
      <h3 className="control-block-label mb-3 text-sm font-bold text-[#A594F9]">Captions</h3>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !hasVoiceover}
        className="w-full rounded-lg bg-[#8A76FC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7A66EC] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate Captions"}
      </button>

      <button
        type="button"
        onClick={handleDownloadVtt}
        disabled={!hasCaptions}
        className="mt-2 w-full rounded-lg border border-[#A594F9] px-3 py-2 text-xs font-semibold text-[#7C5CFC] transition hover:bg-[#F6F3FF] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download .vtt
      </button>

      {hasCaptions ? (
        <p className="mt-3 text-[11px] text-[#6B6B6B] dark:text-inherit">
          {captions.length} caption{captions.length === 1 ? "" : "s"} · stabilized against flicker ·
          saved automatically.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[#6B6B6B] dark:text-inherit">
          {hasVoiceover
            ? "Transcribes the voiceover into clean, word-timed captions (no rapid flicker)."
            : "Generate a voiceover first, then caption it here."}
        </p>
      )}
    </div>
  );
};

export default CaptionsEditor;
