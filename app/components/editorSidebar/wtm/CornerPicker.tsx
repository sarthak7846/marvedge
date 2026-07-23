import React from "react";

import type { WtmPosition } from "@/app/types/wtm";
import { WTM_POSITIONS, WTM_POSITION_LABELS } from "@/app/lib/wtm/watermark";

// Where the little dot sits inside the corner-picker preview box.
const CORNER_DOT_CLASS: Record<WtmPosition, string> = {
  tl: "top-1 left-1",
  tr: "top-1 right-1",
  bl: "bottom-1 left-1",
  br: "bottom-1 right-1",
};

interface CornerPickerProps {
  value: WtmPosition;
  onChange: (position: WtmPosition) => void;
}

/**
 * The four-corner placement picker shared by the watermark and the camera
 * bubble, so both overlays are anchored the same way and stay visually in sync.
 * Inherits its disabled state from an enclosing <fieldset>.
 */
const CornerPicker: React.FC<CornerPickerProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-4 gap-2">
    {WTM_POSITIONS.map((position) => {
      const isActive = value === position;
      return (
        <button
          key={position}
          type="button"
          onClick={() => onChange(position)}
          title={WTM_POSITION_LABELS[position]}
          aria-label={WTM_POSITION_LABELS[position]}
          aria-pressed={isActive}
          className={`relative h-10 rounded-lg border-2 bg-white transition-all disabled:cursor-not-allowed ${
            isActive ? "border-[#7C5CFC] shadow-md" : "border-[#ede7fa] hover:border-[#A594F9]"
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
);

export default CornerPicker;
