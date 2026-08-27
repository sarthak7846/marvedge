import React from "react";
import { RotateCcw } from "lucide-react";

import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_FONTS,
  SUBTITLE_FONT_LABELS,
  SUBTITLE_FONT_PX_MAX,
  SUBTITLE_FONT_PX_MIN,
  fontPctToSliderPx,
  sliderPxToFontPct,
} from "@/app/lib/subtitles";
import type { SubtitleAlignment, SubtitleAnimation, SubtitleFont } from "@/app/lib/subtitles";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";

const ALIGNMENT_OPTIONS: { value: SubtitleAlignment; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

const ANIMATION_OPTIONS: { value: SubtitleAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "pop", label: "Pop" },
  { value: "slide", label: "Slide" },
];

/** Default box colour offered the moment the background toggle is switched on. */
const DEFAULT_BOX_COLOR = "#000000";
const DEFAULT_BOX_OPACITY = 0.6;

const labelClass = "control-block-label text-[#A594F9] font-semibold text-xs";
const valueClass = "text-xs text-[#7C5CFC]";

/** Segmented control, matching the sidebar's existing pill styling. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-[#F6F3FF] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
            value === option.value
              ? "bg-[#8A76FC] text-white shadow-sm"
              : "text-[#6E5AD8] hover:bg-white/70"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={`${valueClass} font-mono uppercase`}>{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={label}
          className="h-6 w-8 cursor-pointer rounded border border-[#ede7fa] bg-transparent p-0"
        />
      </div>
    </div>
  );
}

/**
 * The subtitle style panel (SUB PR 4 / US-3, PRD §6.5).
 *
 * Every control writes one field through `setSubtitleStyle`, which sanitizes on
 * the way in — so the panel can only ever produce a style the export can also
 * render, and the preview overlay updates on the same store read. This component
 * holds no local state: what you see here is exactly what
 * `app/lib/subtitles/style.ts` will hand to both the CSS overlay and the ASS
 * writer.
 *
 * The size slider talks in px at 1080p while the store keeps a percentage of
 * frame height. That conversion is the whole reason a "24px" subtitle means the
 * same thing on a 640px preview and a 1920px export — see the font-size note in
 * style.ts.
 *
 * "Reset" clears the style back to `null` rather than writing the defaults,
 * because a demo with NO style config is what makes the export byte-identical to
 * what it was before this feature existed.
 */
const SubtitleStyleControls: React.FC = () => {
  const subtitleStyle = useSubtitleStore((s) => s.subtitleStyle);
  const setSubtitleStyle = useSubtitleStore((s) => s.setSubtitleStyle);

  // Nothing saved yet → show the defaults, which are what the export renders.
  const style = subtitleStyle ?? DEFAULT_SUBTITLE_STYLE;
  const sizePx = fontPctToSliderPx(style.fontSizePct ?? DEFAULT_SUBTITLE_STYLE.fontSizePct);
  const hasBox = Boolean(style.backgroundColor);
  const boxOpacityPercent = Math.round((style.backgroundOpacity ?? DEFAULT_BOX_OPACITY) * 100);
  const outlinePercent = Math.round((style.outlineWidth ?? 0) * 100);
  const shadowPercent = Math.round((style.shadowDepth ?? 0) * 100);

  return (
    <div className="border-t border-[#ede7fa] pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="control-block-label text-sm font-bold text-[#A594F9]">Style</h3>
        <button
          type="button"
          onClick={() => setSubtitleStyle(null)}
          disabled={subtitleStyle === null}
          title="Restore the default subtitle appearance"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[#7C5CFC] transition hover:bg-[#F6F3FF] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      <div className="space-y-4">
        {/* Font */}
        <div>
          <span className={`${labelClass} mb-2 block`}>Font</span>
          <div className="grid grid-cols-2 gap-1.5">
            {SUBTITLE_FONTS.map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => setSubtitleStyle({ fontFamily: font })}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                  (style.fontFamily as SubtitleFont) === font
                    ? "border-[#8A76FC] bg-[#F6F3FF] text-[#2D1F61]"
                    : "border-[#ede7fa] text-[#6E5AD8] hover:border-[#A594F9]"
                }`}
              >
                {SUBTITLE_FONT_LABELS[font]}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Size</span>
            <span className={valueClass}>{sizePx}px</span>
          </div>
          <input
            type="range"
            min={SUBTITLE_FONT_PX_MIN}
            max={SUBTITLE_FONT_PX_MAX}
            step={1}
            value={sizePx}
            onChange={(e) =>
              setSubtitleStyle({ fontSizePct: sliderPxToFontPct(Number(e.target.value)) })
            }
            aria-label="Subtitle size"
            className="w-full cursor-pointer accent-[#8A76FC]"
          />
        </div>

        {/* Text colour */}
        <ColorField
          label="Text colour"
          value={style.color ?? DEFAULT_SUBTITLE_STYLE.color}
          onChange={(color) => setSubtitleStyle({ color })}
        />

        {/* Background box */}
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center justify-between">
            <span className={labelClass}>Background box</span>
            <input
              type="checkbox"
              checked={hasBox}
              onChange={(e) =>
                setSubtitleStyle(
                  e.target.checked
                    ? {
                        backgroundColor: DEFAULT_BOX_COLOR,
                        backgroundOpacity: DEFAULT_BOX_OPACITY,
                      }
                    : { backgroundColor: undefined, backgroundOpacity: undefined }
                )
              }
              className="h-3.5 w-3.5 cursor-pointer accent-[#8A76FC]"
            />
          </label>

          {hasBox && (
            <div className="space-y-2 rounded-lg bg-[#F6F3FF] p-2.5">
              <ColorField
                label="Box colour"
                value={style.backgroundColor ?? DEFAULT_BOX_COLOR}
                onChange={(backgroundColor) => setSubtitleStyle({ backgroundColor })}
              />
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelClass}>Box opacity</span>
                  <span className={valueClass}>{boxOpacityPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={style.backgroundOpacity ?? DEFAULT_BOX_OPACITY}
                  onChange={(e) => setSubtitleStyle({ backgroundOpacity: Number(e.target.value) })}
                  aria-label="Background opacity"
                  className="w-full cursor-pointer accent-[#8A76FC]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Border (outline) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Border</span>
            <span className={valueClass}>
              {outlinePercent === 0 ? "None" : `${outlinePercent}%`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.25}
            step={0.005}
            value={style.outlineWidth ?? DEFAULT_SUBTITLE_STYLE.outlineWidth}
            onChange={(e) => setSubtitleStyle({ outlineWidth: Number(e.target.value) })}
            aria-label="Border thickness"
            className="w-full cursor-pointer accent-[#8A76FC]"
          />
          <div className="mt-2">
            <ColorField
              label="Border colour"
              value={style.outlineColor ?? DEFAULT_SUBTITLE_STYLE.outlineColor}
              onChange={(outlineColor) => setSubtitleStyle({ outlineColor })}
            />
          </div>
        </div>

        {/* Shadow */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Shadow</span>
            <span className={valueClass}>{shadowPercent === 0 ? "None" : `${shadowPercent}%`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.25}
            step={0.005}
            value={style.shadowDepth ?? DEFAULT_SUBTITLE_STYLE.shadowDepth}
            onChange={(e) => setSubtitleStyle({ shadowDepth: Number(e.target.value) })}
            aria-label="Shadow depth"
            className="w-full cursor-pointer accent-[#8A76FC]"
          />
        </div>

        {/* Position */}
        <div>
          <span className={`${labelClass} mb-2 block`}>Position</span>
          <Segmented
            value={(style.alignment as SubtitleAlignment) ?? DEFAULT_SUBTITLE_STYLE.alignment}
            options={ALIGNMENT_OPTIONS}
            onChange={(alignment) => setSubtitleStyle({ alignment })}
          />
        </div>

        {/* Animation */}
        <div>
          <span className={`${labelClass} mb-2 block`}>Animation</span>
          <Segmented
            value={(style.animation as SubtitleAnimation) ?? DEFAULT_SUBTITLE_STYLE.animation}
            options={ANIMATION_OPTIONS}
            onChange={(animation) => setSubtitleStyle({ animation })}
          />
        </div>
      </div>
    </div>
  );
};

export default SubtitleStyleControls;
