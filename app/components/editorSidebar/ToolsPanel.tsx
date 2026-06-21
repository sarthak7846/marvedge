import React from "react";
import AddTextSection from "./AddTextSection";

interface ToolsPanelProps {
  aspectRatio: string;
  setAspectRatio?: (ratio: string) => void;
  browserFrameDrawShadow: boolean;
  setBrowserFrameDrawShadow?: (enabled: boolean) => void;
  browserFrameDrawBorder: boolean;
  setBrowserFrameDrawBorder?: (enabled: boolean) => void;
  textOverlayInput: string;
  setTextOverlayInput?: (value: string) => void;
  textOverlayFontFamily: string;
  setTextOverlayFontFamily?: (value: string) => void;
  textOverlayFontSize: number;
  setTextOverlayFontSize?: (value: number) => void;
  onAddTextOverlay?: () => void;
  textOverlayColor: string;
  setTextOverlayColor?: (value: string) => void;
  onAddSubtitles?: () => void;
  onClearSubtitles?: () => void;
  subtitlesLoading: boolean;
  hasSubtitles: boolean;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({
  aspectRatio,
  setAspectRatio,
  browserFrameDrawShadow,
  setBrowserFrameDrawShadow,
  browserFrameDrawBorder,
  setBrowserFrameDrawBorder,
  textOverlayInput,
  setTextOverlayInput,
  textOverlayFontFamily,
  setTextOverlayFontFamily,
  textOverlayFontSize,
  setTextOverlayFontSize,
  onAddTextOverlay,
  textOverlayColor,
  setTextOverlayColor,
  onAddSubtitles,
  onClearSubtitles,
  subtitlesLoading,
  hasSubtitles,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">Aspect Ratio</h2>
        <div className="relative w-[180px]">
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio && setAspectRatio(e.target.value)}
            className="w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#7C5CFC] font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-[#A594F9] cursor-pointer"
          >
            <option value="native">Native</option>
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
            <option value="4:5">4:5</option>
            <option value="2:3">2:3</option>
            <option value="9:16">9:16</option>
          </select>

          <div className="absolute top-0 right-0 h-full w-10 flex items-center justify-center pointer-events-none">
            <svg
              className="w-4 h-4 text-[#7C5CFC]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">Browser Frame</h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() =>
              setBrowserFrameDrawShadow && setBrowserFrameDrawShadow(!browserFrameDrawShadow)
            }
            className="toggle-flex-row w-full flex items-center justify-between py-1 text-sm"
          >
            <span className="text-[#6B6B6B] dark:text-inherit">Draw Shadow</span>
            <span
              className={`pill-slider relative inline-flex h-6 w-11 items-center rounded-full transition ${
                browserFrameDrawShadow ? "bg-[#8A76FC]" : "bg-[#A3A3A3]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  browserFrameDrawShadow ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setBrowserFrameDrawBorder && setBrowserFrameDrawBorder(!browserFrameDrawBorder)
            }
            className="toggle-flex-row w-full flex items-center justify-between py-1 text-sm"
          >
            <span className="text-[#6B6B6B] dark:text-inherit">Draw Border</span>
            <span
              className={`pill-slider relative inline-flex h-6 w-11 items-center rounded-full transition ${
                browserFrameDrawBorder ? "bg-[#8A76FC]" : "bg-[#A3A3A3]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  browserFrameDrawBorder ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <AddTextSection
        textOverlayInput={textOverlayInput}
        setTextOverlayInput={setTextOverlayInput}
        textOverlayFontFamily={textOverlayFontFamily}
        setTextOverlayFontFamily={setTextOverlayFontFamily}
        textOverlayFontSize={textOverlayFontSize}
        setTextOverlayFontSize={setTextOverlayFontSize}
        textOverlayColor={textOverlayColor}
        setTextOverlayColor={setTextOverlayColor}
        onAddTextOverlay={onAddTextOverlay}
      />

      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">Subtitles</h2>
        <button
          type="button"
          disabled={subtitlesLoading}
          onClick={() => onAddSubtitles && onAddSubtitles()}
          className="w-full rounded-lg bg-[#8A76FC] text-white py-2 text-sm font-semibold hover:bg-[#7C5CFC] transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {subtitlesLoading
            ? "Generating..."
            : hasSubtitles
              ? "Regenerate Subtitles"
              : "Add Subtitles"}
        </button>
        {hasSubtitles && (
          <button
            type="button"
            onClick={() => onClearSubtitles && onClearSubtitles()}
            className="btn-subtitles-block w-full mt-2 rounded-lg border border-[#8A76FC] text-[#8A76FC] py-2 text-sm font-semibold hover:bg-[#F6F3FF] transition"
          >
            Skip Subtitles
          </button>
        )}
      </div>
    </div>
  );
};

export default ToolsPanel;
