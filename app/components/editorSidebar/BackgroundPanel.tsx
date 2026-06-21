import React from "react";
import { colorOptions, gradientOptions } from "./backgroundOptions";
import { useEditorSidebarBackground } from "./useEditorSidebarBackground";
import ImageBackgroundTab from "./ImageBackgroundTab";

interface BackgroundPanelProps {
  selectedBackground?: string | null;
  setSelectedBackground?: (bg: string | null) => void;
  backgroundType?: string;
  setBackgroundType?: (type: string) => void;
  customBackground?: File | null;
  setCustomBackground?: (file: File | null) => void;
}

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({
  selectedBackground,
  setSelectedBackground,
  backgroundType,
  setBackgroundType,
  customBackground,
  setCustomBackground,
}) => {
  const {
    bgSubTab,
    localSelectedBackground,
    localBackgroundType,
    setLocalBackgroundType,
    localCustomBackground,
    customBackgroundUrl,
    handleBackgroundSelect,
    handleCustomBackgroundUpload,
    filteredImageBackgroundOptions,
  } = useEditorSidebarBackground({
    selectedBackground,
    setSelectedBackground,
    backgroundType,
    customBackground,
    setCustomBackground,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="control-block-label text-lg font-bold text-[#A594F9]">Background</h2>
      </div>

      {bgSubTab === "image" && (
        <ImageBackgroundTab
          filteredImageBackgroundOptions={filteredImageBackgroundOptions}
          localSelectedBackground={localSelectedBackground}
          handleBackgroundSelect={handleBackgroundSelect}
          customBackgroundUrl={customBackgroundUrl}
          localCustomBackground={localCustomBackground}
          localBackgroundType={localBackgroundType}
          setLocalBackgroundType={setLocalBackgroundType}
          setBackgroundType={setBackgroundType}
          handleCustomBackgroundUpload={handleCustomBackgroundUpload}
        />
      )}

      {bgSubTab === "gradient" && (
        <div className="grid grid-cols-3 gap-2">
          {gradientOptions.map((g) => {
            const val = `gradient:${g.id}`;
            const isActive = localSelectedBackground === val;
            return (
              <button
                key={g.id}
                onClick={() => handleBackgroundSelect(val)}
                className={`relative h-16 rounded-lg border-2 ${g.css} ${
                  isActive
                    ? "border-[#7C5CFC] shadow-md"
                    : "border-[#ede7fa] hover:border-[#A594F9]"
                }`}
                title={g.name}
              >
                {isActive && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-[#7C5CFC] rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {bgSubTab === "color" && (
        <div className="grid grid-cols-6 gap-2">
          {colorOptions.map((c) => {
            const val = `color:${c.hex}`;
            const isActive = localSelectedBackground === val;
            return (
              <button
                key={c.hex}
                onClick={() => handleBackgroundSelect(val)}
                className={`relative h-10 rounded-md border-2 ${
                  isActive ? "border-[#7C5CFC] shadow" : "border-[#ede7fa] hover:border-[#A594F9]"
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {isActive && (
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#7C5CFC] rounded-full" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {bgSubTab === "hidden" && (
        <div className="rounded-lg border border-dashed border-[#ede7fa] p-4 text-sm text-gray-600">
          <p className="mb-2">Hide background completely.</p>
          <button
            onClick={() => handleBackgroundSelect("hidden")}
            className={`px-3 py-1.5 rounded-md font-semibold ${
              localSelectedBackground === "hidden"
                ? "bg-[#7C5CFC] text-white"
                : "bg-[#E6E1FA] text-[#7C5CFC] hover:bg-[#d1c6fa]"
            }`}
          >
            Set Hidden
          </button>
        </div>
      )}
    </div>
  );
};

export default BackgroundPanel;
