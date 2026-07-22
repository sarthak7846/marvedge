import React from "react";
import { Lock, Trash2, Upload } from "lucide-react";

import type { WtmPosition } from "@/app/types/wtm";
import {
  WTM_OPACITY_MAX,
  WTM_OPACITY_MIN,
  WTM_POSITIONS,
  WTM_POSITION_LABELS,
} from "@/app/lib/wtm/watermark";
import type { WatermarkSettings } from "./useWatermarkSettings";

// Where the little dot sits inside the corner-picker preview box.
const CORNER_DOT_CLASS: Record<WtmPosition, string> = {
  tl: "top-1 left-1",
  tr: "top-1 right-1",
  bl: "bottom-1 left-1",
  br: "bottom-1 right-1",
};

/**
 * Watermark controls (WTM-6.3): enable/disable, custom PNG upload + preview,
 * opacity, and corner placement. PRO/ENTERPRISE only — FREE users see the same
 * controls in a locked, read-only state describing the forced Marvedge badge,
 * which is what jobs/create will bake in for them regardless.
 */
const WatermarkEditor: React.FC<WatermarkSettings> = ({
  planLoading,
  isPro,
  watermark,
  previewUrl,
  uploading,
  setEnabled,
  setOpacity,
  setPosition,
  handleUpload,
  handleRemoveLogo,
}) => {
  const locked = !isPro;
  const opacityPercent = Math.round(watermark.opacity * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="control-block-label text-sm font-bold text-[#A594F9]">Watermark</h3>
        {locked && (
          <span className="flex items-center gap-1 rounded-full bg-[#F6F3FF] px-2 py-0.5 text-[10px] font-semibold text-[#7C5CFC]">
            <Lock className="w-3 h-3" />
            PRO
          </span>
        )}
      </div>

      <p className="text-xs text-[#6B6B6B] dark:text-inherit mb-3">
        {locked
          ? "Exports include the Marvedge badge. Upgrade to PRO to use your own logo, adjust its transparency, or remove it."
          : "Upload your own logo, adjust its transparency and placement — or turn the watermark off entirely."}
      </p>

      <fieldset disabled={locked || planLoading} className="space-y-4 disabled:opacity-60">
        {/* Enable / disable — a PRO user may remove the watermark completely. */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-semibold text-[#7C5CFC]">Show watermark on exports</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={locked ? true : watermark.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span className="h-5 w-9 rounded-full bg-[#ede7fa] transition peer-checked:bg-[#8A76FC] peer-focus-visible:ring-2 peer-focus-visible:ring-[#A594F9]" />
            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        {/* Logo picker + preview */}
        <div>
          <span className="control-block-label block text-[#A594F9] font-semibold mb-2 text-xs">
            Logo
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#ede7fa] bg-[#F6F3FF]">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Watermark preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[9px] font-semibold text-[#B0A5D3] text-center leading-tight px-1">
                  Marvedge badge
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="relative">
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleUpload}
                  disabled={locked || uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between rounded-lg border border-[#ede7fa] px-3 py-2 text-[#7C5CFC]">
                  <span className="text-xs">
                    {uploading ? "Uploading…" : watermark.assetUrl ? "Replace PNG" : "Upload PNG"}
                  </span>
                  <Upload className="w-4 h-4" />
                </div>
              </div>

              {watermark.assetUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={locked || uploading}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#7C5CFC] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  Use the Marvedge badge instead
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transparency */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="control-block-label text-[#A594F9] font-semibold text-xs">
              Transparency
            </span>
            <span className="text-xs text-[#7C5CFC]">{opacityPercent}%</span>
          </div>
          <input
            type="range"
            min={WTM_OPACITY_MIN}
            max={WTM_OPACITY_MAX}
            step={0.05}
            value={watermark.opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full accent-[#8A76FC] cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {/* Corner placement */}
        <div>
          <span className="control-block-label block text-[#A594F9] font-semibold mb-2 text-xs">
            Placement
          </span>
          <div className="grid grid-cols-4 gap-2">
            {WTM_POSITIONS.map((position) => {
              const isActive = watermark.position === position;
              return (
                <button
                  key={position}
                  type="button"
                  onClick={() => setPosition(position)}
                  title={WTM_POSITION_LABELS[position]}
                  aria-label={WTM_POSITION_LABELS[position]}
                  aria-pressed={isActive}
                  className={`relative h-10 rounded-lg border-2 bg-white transition-all disabled:cursor-not-allowed ${
                    isActive
                      ? "border-[#7C5CFC] shadow-md"
                      : "border-[#ede7fa] hover:border-[#A594F9]"
                  }`}
                >
                  <span
                    className={`absolute h-2.5 w-2.5 rounded-sm ${CORNER_DOT_CLASS[position]} ${
                      isActive ? "bg-[#7C5CFC]" : "bg-[#D6CCF7]"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>
    </div>
  );
};

export default WatermarkEditor;
