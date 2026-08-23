import React from "react";
import { Languages, Loader2 } from "lucide-react";

import {
  AUTO_DETECT_LANGUAGE,
  SUBTITLE_LANGUAGES,
  isSttOffered,
  isTranslationTarget,
  languageLabel,
} from "@/app/lib/subtitles";
import type { SubtitleTrackSummary } from "@/app/store/editor/subtitleStore";

export interface SubtitleLanguageControlsProps {
  /** Language the next generation run will request. */
  generationLanguage: string;
  onGenerationLanguageChange: (code: string) => void;
  /** Language of the track currently on screen. */
  activeLanguage: string;
  tracks: SubtitleTrackSummary[];
  onSelectTrack: (language: string) => void;
  onTranslate: (targetLanguage: string) => void;
  translating: boolean;
  /** Generation is running — the picker must not change mid-run. */
  busy: boolean;
  /** Translation needs a saved demo and existing cues. */
  canTranslate: boolean;
  /** Whether the translate section renders at all (SUBTITLE_TRANSLATE_ENABLED). */
  translateEnabled: boolean;
}

/** Languages we are willing to transcribe into, plus auto-detect. */
const GENERATION_OPTIONS = [
  { code: AUTO_DETECT_LANGUAGE, label: "Auto-detect", nativeLabel: "" },
  ...SUBTITLE_LANGUAGES.filter((lang) => isSttOffered(lang.code)).map((lang) => ({
    code: lang.code,
    label: lang.label,
    nativeLabel: lang.nativeLabel,
  })),
];

/** Languages we are willing to translate into. */
const TRANSLATION_OPTIONS = SUBTITLE_LANGUAGES.filter((lang) => isTranslationTarget(lang.code));

const labelClass = "control-block-label text-[#A594F9] font-semibold text-xs";

const selectClass =
  "w-full rounded-lg border border-[#ede7fa] bg-white px-2 py-1.5 text-xs font-semibold " +
  "text-[#2D1F61] outline-none transition focus:border-[#8A76FC] disabled:cursor-not-allowed " +
  "disabled:opacity-50";

/** How a track came to exist, for the switcher's secondary line. */
const SOURCE_LABEL: Record<string, string> = {
  stt: "Transcribed",
  translation: "Translated",
  manual: "Edited",
};

/**
 * Language controls for the subtitle panel (SUB PR 5 / US-4, PRD §6.6 + §6.7).
 *
 * Three things, in the order a user meets them:
 *   1. which language to TRANSCRIBE in (before generating),
 *   2. which of the demo's tracks is ACTIVE (what the preview and the export
 *      show), and
 *   3. translating the active track into another language.
 *
 * Only (3) is gated. It is hidden entirely when SUBTITLE_TRANSLATE_ENABLED is
 * off and refused server-side for non-PRO plans — this component deliberately
 * does NOT pre-disable the button by plan, because the client does not hold the
 * authoritative plan and a stale copy would either lie to someone who just
 * upgraded or imply the gate lives somewhere it doesn't. The 403's own message
 * is what the user sees.
 *
 * The pickers are built from `isSttOffered` / `isTranslationTarget` rather than
 * from the raw language list, so a language whose coverage or rendering has not
 * been confirmed cannot appear here by accident. That is why Arabic is absent
 * today — see RTL_RENDERING_VERIFIED in app/lib/subtitles/languages.ts.
 */
const SubtitleLanguageControls: React.FC<SubtitleLanguageControlsProps> = ({
  generationLanguage,
  onGenerationLanguageChange,
  activeLanguage,
  tracks,
  onSelectTrack,
  onTranslate,
  translating,
  busy,
  canTranslate,
  translateEnabled,
}) => {
  const [target, setTarget] = React.useState<string>("");

  // Translating into the language already on screen is a no-op the server
  // rejects; drop it from the list rather than letting the user pick it.
  const targets = TRANSLATION_OPTIONS.filter((lang) => lang.code !== activeLanguage);

  React.useEffect(() => {
    if (targets.length > 0 && !targets.some((lang) => lang.code === target)) {
      setTarget(targets[0].code);
    }
  }, [targets, target]);

  return (
    <div className="border-t border-[#ede7fa] pt-6">
      <h3 className="control-block-label mb-3 text-sm font-bold text-[#A594F9]">Language</h3>

      <div className="space-y-4">
        {/* Spoken language for the next generation run */}
        <div>
          <label className={`${labelClass} mb-2 block`} htmlFor="subtitle-generation-language">
            Spoken language
          </label>
          <select
            id="subtitle-generation-language"
            value={generationLanguage}
            disabled={busy}
            onChange={(e) => onGenerationLanguageChange(e.target.value)}
            className={selectClass}
          >
            {GENERATION_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeLabel ? `${option.label} — ${option.nativeLabel}` : option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-inherit">
            {generationLanguage === AUTO_DETECT_LANGUAGE
              ? "The transcriber will detect the language itself."
              : "Used the next time you generate subtitles."}
          </p>
        </div>

        {/* Track switcher */}
        {tracks.length > 0 && (
          <div>
            <span className={`${labelClass} mb-2 block`}>Tracks</span>
            <div className="space-y-1">
              {tracks.map((track) => {
                const isActive = track.language === activeLanguage;
                return (
                  <button
                    key={track.language}
                    type="button"
                    onClick={() => onSelectTrack(track.language)}
                    disabled={busy || translating}
                    className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive
                        ? "border-[#8A76FC] bg-[#F6F3FF]"
                        : "border-[#ede7fa] hover:border-[#A594F9]"
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-[#2D1F61]">
                      {languageLabel(track.language)}
                    </span>
                    <span className="text-[10px] text-[#7C5CFC]">
                      {SOURCE_LABEL[track.source] ?? track.source} · {track.cueCount}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-inherit">
              The active track is what the preview and the export show.
            </p>
          </div>
        )}

        {/* Translation — the only gated surface in the feature */}
        {translateEnabled && targets.length > 0 && (
          <div>
            <span className={`${labelClass} mb-2 block`}>Translate</span>
            <div className="flex items-center gap-1.5">
              <select
                value={target}
                disabled={translating || busy || !canTranslate}
                onChange={(e) => setTarget(e.target.value)}
                aria-label="Translation target language"
                className={selectClass}
              >
                {targets.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label} — {lang.nativeLabel}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => target && onTranslate(target)}
                disabled={translating || busy || !canTranslate || !target}
                title={
                  canTranslate
                    ? `Translate the ${languageLabel(activeLanguage)} track`
                    : "Save the demo and generate subtitles first"
                }
                className="flex shrink-0 items-center gap-1 rounded-lg bg-[#8A76FC] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#7C5CFC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {translating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Languages size={12} />
                )}
                {translating ? "Translating" : "Translate"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-inherit">
              Timings are kept exactly as they are; only the words change. PRO and ENTERPRISE plans.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubtitleLanguageControls;
