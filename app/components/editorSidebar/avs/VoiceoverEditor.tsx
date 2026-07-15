import React from "react";

import { AVS_VOICES } from "@/app/lib/avs/voices";
import type { VoiceoverGeneration } from "./useVoiceoverGeneration";

/**
 * AVS voiceover editor (AVS-2.2). Renders the Deepgram Aura voice picker, an
 * optional pronunciation dictionary, the "Generate Voiceover" action, and an
 * <audio> preview of the produced continuous MP3. All state lives in the
 * `useVoiceoverGeneration` hook; this component is presentational.
 */
const VoiceoverEditor: React.FC<VoiceoverGeneration> = ({
  voiceId,
  setVoiceId,
  hasContent,
  generating,
  voiceover,
  handleGenerate,
  pronunciation,
  addPronunciation,
  updatePronunciation,
  removePronunciation,
}) => {
  const inputClass =
    "w-full rounded-lg border border-[#ede7fa] bg-white px-2.5 py-1.5 text-sm text-[#333] " +
    "placeholder:text-[#B7B7B7] focus:border-[#A594F9] focus:outline-none focus:ring-1 " +
    "focus:ring-[#A594F9] dark:text-inherit";

  return (
    <div>
      <h3 className="control-block-label mb-3 text-sm font-bold text-[#A594F9]">Voiceover</h3>

      {/* Voice picker */}
      <label className="mb-1 block text-[11px] font-semibold text-[#6B6B6B] dark:text-inherit">
        Voice
      </label>
      <div className="grid grid-cols-1 gap-2">
        {AVS_VOICES.map((v) => {
          const selected = v.id === voiceId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoiceId(v.id)}
              aria-pressed={selected}
              className={`flex flex-col rounded-lg px-3 py-2 text-left transition ${
                selected
                  ? "bg-[#8A76FC] text-white"
                  : "border border-[#A594F9] text-[#7C5CFC] hover:bg-[#F6F3FF]"
              }`}
            >
              <span className="text-xs font-semibold">{v.label}</span>
              <span
                className={`text-[11px] ${selected ? "text-white/80" : "text-[#8f8f8f] dark:text-inherit"}`}
              >
                {v.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pronunciation dictionary */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-semibold text-[#6B6B6B] dark:text-inherit">
            Pronunciation
          </label>
          <button
            type="button"
            onClick={addPronunciation}
            className="text-[11px] font-semibold text-[#7C5CFC] underline-offset-2 hover:underline"
          >
            + Add rule
          </button>
        </div>
        {pronunciation.length === 0 ? (
          <p className="text-[11px] text-[#B7B7B7]">
            Optional — swap a term for a phonetic spelling before the voice reads it.
          </p>
        ) : (
          <div className="space-y-2">
            {pronunciation.map((rule, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={rule.term}
                  onChange={(e) => updatePronunciation(i, { term: e.target.value })}
                  placeholder="Term"
                  className={inputClass}
                />
                <span className="text-[#B7B7B7]">→</span>
                <input
                  value={rule.phonetic}
                  onChange={(e) => updatePronunciation(i, { phonetic: e.target.value })}
                  placeholder="Phonetic"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removePronunciation(i)}
                  aria-label="Remove pronunciation rule"
                  className="shrink-0 rounded-md px-2 py-1 text-sm text-[#B7B7B7] hover:bg-[#F6F3FF] hover:text-[#7C5CFC]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !hasContent}
        className="mt-4 w-full rounded-lg bg-[#8A76FC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7A66EC] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate Voiceover"}
      </button>

      {/* Audio preview */}
      {voiceover?.audioUrl ? (
        <div className="mt-3">
          <audio key={voiceover.audioUrl} controls src={voiceover.audioUrl} className="w-full" />
          <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-inherit">
            {voiceover.stepTimings.length} step
            {voiceover.stepTimings.length === 1 ? "" : "s"} · {voiceover.duration.toFixed(1)}s ·
            saved automatically.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[#6B6B6B] dark:text-inherit">
          Turns the script above into one continuous AI voiceover. English only.
        </p>
      )}
    </div>
  );
};

export default VoiceoverEditor;
