import React from "react";

interface AddTextSectionProps {
  textOverlayInput: string;
  setTextOverlayInput?: (value: string) => void;
  textOverlayFontFamily: string;
  setTextOverlayFontFamily?: (value: string) => void;
  textOverlayFontSize: number;
  setTextOverlayFontSize?: (value: number) => void;
  textOverlayColor: string;
  setTextOverlayColor?: (value: string) => void;
  onAddTextOverlay?: () => void;
}

const AddTextSection: React.FC<AddTextSectionProps> = ({
  textOverlayInput,
  setTextOverlayInput,
  textOverlayFontFamily,
  setTextOverlayFontFamily,
  textOverlayFontSize,
  setTextOverlayFontSize,
  textOverlayColor,
  setTextOverlayColor,
  onAddTextOverlay,
}) => {
  return (
    <div>
      <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">Add Text</h2>
      <div className="space-y-3">
        <input
          type="text"
          value={textOverlayInput}
          onChange={(e) => setTextOverlayInput && setTextOverlayInput(e.target.value)}
          className="w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#4A3C87] focus:outline-none focus:ring-2 focus:ring-[#A594F9]"
          placeholder="Write your text"
        />

        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <select
              value={textOverlayFontFamily}
              onChange={(e) => setTextOverlayFontFamily && setTextOverlayFontFamily(e.target.value)}
              className="w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#7C5CFC] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#A594F9] cursor-pointer"
            >
              <option value="Arial">Arial</option>
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Poppins">Poppins</option>
              <option value="Caveat">Caveat</option>
              <option value="Georgia">Georgia</option>
            </select>
            <div className="absolute top-0 right-0 h-full w-8 flex items-center justify-center pointer-events-none">
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

          <div className="relative">
            <select
              value={String(textOverlayFontSize)}
              onChange={(e) =>
                setTextOverlayFontSize && setTextOverlayFontSize(Number(e.target.value))
              }
              className="w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#7C5CFC] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#A594F9] cursor-pointer"
            >
              <option value="16">16</option>
              <option value="20">20</option>
              <option value="24">24</option>
              <option value="28">28</option>
              <option value="32">32</option>
              <option value="40">40</option>
            </select>
            <div className="absolute top-0 right-0 h-full w-8 flex items-center justify-center pointer-events-none">
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

          <div className="relative">
            <select
              value={textOverlayColor}
              onChange={(e) => setTextOverlayColor && setTextOverlayColor(e.target.value)}
              className="w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#7C5CFC] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#A594F9] cursor-pointer"
            >
              <option value="#ffffff">White</option>
              <option value="#000000">Black</option>
              <option value="#ff0000">Red</option>
              <option value="#00ff00">Green</option>
              <option value="#0000ff">Blue</option>
              <option value="#ffff00">Yellow</option>
              <option value="#A594F9">Purple</option>
            </select>
            <div className="absolute top-0 right-0 h-full w-8 flex items-center justify-center pointer-events-none">
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

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAddTextOverlay && onAddTextOverlay()}
            className="w-full rounded-lg bg-[#8A76FC] text-white py-2 text-sm font-semibold hover:bg-[#7C5CFC] transition"
          >
            Add Text
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTextSection;
