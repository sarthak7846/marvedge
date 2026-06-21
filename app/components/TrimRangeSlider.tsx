import { ChangeEvent } from "react";

type TrimRangeSliderProps = {
  label: string;
  displayTime: string;
  inputValue: string;
  placeholder: string;
  rangeMin: number;
  rangeMax: number;
  rangeValue: number;
  onRangeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  processing: boolean;
};

const TrimRangeSlider = ({
  label,
  displayTime,
  inputValue,
  placeholder,
  rangeMin,
  rangeMax,
  rangeValue,
  onRangeChange,
  processing,
}: TrimRangeSliderProps) => {
  return (
    <div className="pt-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="font-mono">{displayTime}</span>
      </label>

      {/* Manual input for time */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"></div>
            <input
              type="text"
              value={inputValue}
              readOnly
              placeholder={placeholder}
              disabled={processing}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50 shadow-sm transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed cursor-default"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <span className="text-xs text-gray-400 font-medium">HH:MM:SS</span>
            </div>
          </div>
        </div>
      </div>

      <input
        type="range"
        min={rangeMin}
        max={rangeMax}
        value={rangeValue}
        onChange={onRangeChange}
        disabled={processing}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );
};

export default TrimRangeSlider;
