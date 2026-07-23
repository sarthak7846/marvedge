import React from "react";
import { CheckCircle2, Lock, VideoOff } from "lucide-react";

import { WTM_WEBCAM_SIZE_MAX, WTM_WEBCAM_SIZE_MIN } from "@/app/lib/wtm/webcam";
import CornerPicker from "./CornerPicker";
import type { WebcamSettings } from "./useWebcamSettings";

/**
 * Camera-bubble controls (WTM-6.4): enable/disable, corner placement, bubble
 * size, and a readout of whether this recording actually has a webcam clip.
 *
 * Deliberately unlocked for everyone — recording and configuring a bubble is
 * free, and only the composited export is PRO/ENTERPRISE, which is enforced
 * server-side. FREE users therefore get the full controls plus a note saying the
 * bubble applies on PRO.
 */
const WebcamEditor: React.FC<WebcamSettings> = ({
  planLoading,
  isPro,
  webcam,
  hasClip,
  setEnabled,
  setPosition,
  setSize,
}) => {
  const sizePercent = Math.round(webcam.size * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="control-block-label text-sm font-bold text-[#A594F9]">Camera bubble</h3>
        {!planLoading && !isPro && (
          <span className="flex items-center gap-1 rounded-full bg-[#F6F3FF] px-2 py-0.5 text-[10px] font-semibold text-[#7C5CFC]">
            <Lock className="w-3 h-3" />
            Applies on PRO
          </span>
        )}
      </div>

      <p className="text-xs text-[#6B6B6B] dark:text-inherit mb-3">
        Record yourself with the camera toggle in the recorder, then place the circular bubble on
        your exports.
      </p>

      {/* Whether there is anything to composite — the panel is configurable
          either way, but without a clip the export simply has no bubble. */}
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 text-[11px] font-semibold ${
          hasClip ? "bg-[#F6F3FF] text-[#7C5CFC]" : "bg-[#F7F7F7] text-[#8C8C8C]"
        }`}
      >
        {hasClip ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Camera clip ready
          </>
        ) : (
          <>
            <VideoOff className="w-3.5 h-3.5 shrink-0" />
            No camera clip recorded
          </>
        )}
      </div>

      <div className="space-y-4">
        {/* Enable / disable */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-semibold text-[#7C5CFC]">
            Show camera bubble on exports
          </span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={webcam.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span className="h-5 w-9 rounded-full bg-[#ede7fa] transition peer-checked:bg-[#8A76FC] peer-focus-visible:ring-2 peer-focus-visible:ring-[#A594F9]" />
            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        {/* Bubble size */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="control-block-label text-[#A594F9] font-semibold text-xs">Size</span>
            <span className="text-xs text-[#7C5CFC]">{sizePercent}%</span>
          </div>
          <input
            type="range"
            min={WTM_WEBCAM_SIZE_MIN}
            max={WTM_WEBCAM_SIZE_MAX}
            step={0.01}
            value={webcam.size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-[#8A76FC] cursor-pointer"
          />
        </div>

        {/* Corner placement */}
        <div>
          <span className="control-block-label block text-[#A594F9] font-semibold mb-2 text-xs">
            Placement
          </span>
          <CornerPicker value={webcam.position} onChange={setPosition} />
        </div>

        {!planLoading && !isPro && (
          <p className="text-[11px] text-[#6B6B6B] dark:text-inherit">
            Camera bubble applies on PRO — upgrade to have it composited into your exports.
          </p>
        )}
      </div>
    </div>
  );
};

export default WebcamEditor;
