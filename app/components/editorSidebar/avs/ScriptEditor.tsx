import React from "react";

import { SCRIPT_TONES } from "@/app/lib/avs/tones";
import type { ScriptEditing } from "./useScriptEditing";

/**
 * AVS script editor (AVS-2.1). Renders the tone selector, the per-step (or
 * single-blob fallback) narration text areas, and the "Rewrite with AI" action.
 * All state lives in the `useScriptEditing` hook; this component is presentational.
 */
const ScriptEditor: React.FC<ScriptEditing> = ({
  hasSteps,
  lines,
  raw,
  tone,
  hasTranscript,
  hasContent,
  rewriting,
  setTone,
  updateLine,
  setRaw,
  seedFromTranscript,
  handleRewrite,
}) => {
  const textareaClass =
    "w-full resize-y rounded-lg border border-[#ede7fa] bg-white px-3 py-2 text-sm text-[#333] " +
    "placeholder:text-[#B7B7B7] focus:border-[#A594F9] focus:outline-none focus:ring-1 " +
    "focus:ring-[#A594F9] dark:text-inherit";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="control-block-label text-sm font-bold text-[#A594F9]">Script</h3>
        <button
          type="button"
          onClick={seedFromTranscript}
          disabled={!hasTranscript}
          title={
            hasTranscript
              ? "Replace the text with the demo transcript"
              : "Generate subtitles first to seed from the transcript"
          }
          className="text-[11px] font-semibold text-[#7C5CFC] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#B7B7B7] disabled:no-underline"
        >
          Seed from transcript
        </button>
      </div>

      {/* Tone selector */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {SCRIPT_TONES.map((t) => {
          const selected = t.id === tone;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              aria-pressed={selected}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                selected
                  ? "bg-[#8A76FC] text-white"
                  : "border border-[#A594F9] text-[#7C5CFC] hover:bg-[#F6F3FF]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Editable narration */}
      {hasSteps ? (
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={line.stepId}>
              <label className="mb-1 block text-[11px] font-semibold text-[#6B6B6B] dark:text-inherit">
                Step {i + 1}
              </label>
              <textarea
                value={line.text}
                onChange={(e) => updateLine(line.stepId, e.target.value)}
                rows={2}
                placeholder="Narration for this step…"
                className={textareaClass}
              />
            </div>
          ))}
        </div>
      ) : (
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder="Write or paste your demo narration here…"
          className={textareaClass}
        />
      )}

      <button
        type="button"
        onClick={handleRewrite}
        disabled={rewriting || !hasContent}
        className="mt-3 w-full rounded-lg bg-[#8A76FC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7A66EC] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {rewriting ? "Rewriting…" : "Rewrite with AI"}
      </button>

      <p className="mt-2 text-[11px] text-[#6B6B6B] dark:text-inherit">
        Rewrites the narration above into the selected tone. English only — your edits are saved
        automatically.
      </p>
    </div>
  );
};

export default ScriptEditor;
