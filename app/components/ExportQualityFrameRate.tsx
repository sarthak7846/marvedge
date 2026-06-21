import { ChevronUp, ChevronDown } from "lucide-react";
import type { ExportSettings } from "./ExportSettingsModal";

type ExportQualityFrameRateProps = {
  settings: ExportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
};

export default function ExportQualityFrameRate({
  settings,
  setSettings,
}: ExportQualityFrameRateProps) {
  return (
    <div className="flex gap-4 mb-5">
      {/* Quality */}
      <div className="flex-1">
        <label className="block text-[#8A76FC] text-[15px] mb-2">Quality</label>
        <div className="flex bg-[#EAE5FB] rounded-xl p-1 relative h-[42px]">
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#8A76FC] rounded-lg transition-transform duration-300 ease-in-out"
            style={{
              transform: settings.quality === "1080p" ? "translateX(100%)" : "translateX(0)",
            }}
          />
          <button
            className={`flex-1 relative z-10 text-sm font-medium transition-colors ${
              settings.quality === "720p" ? "text-white" : "text-[#8A76FC]"
            }`}
            onClick={() => setSettings({ ...settings, quality: "720p" })}
          >
            720p
          </button>
          <button
            className={`flex-1 relative z-10 text-sm font-medium transition-colors ${
              settings.quality === "1080p" ? "text-white" : "text-[#8A76FC]"
            }`}
            onClick={() => setSettings({ ...settings, quality: "1080p" })}
          >
            1080p
          </button>
        </div>
      </div>

      {/* Frame Rate */}
      <div className="flex-1">
        <label className="block text-[#8A76FC] text-[15px] mb-2">Frame rate</label>
        <div
          className="flex bg-[#EAE5FB] rounded-xl px-3 h-[42px] items-center justify-between cursor-pointer"
          onClick={() =>
            setSettings({
              ...settings,
              fps:
                settings.fps === "24 FPS"
                  ? "30 FPS"
                  : settings.fps === "30 FPS"
                    ? "60 FPS"
                    : "24 FPS",
            })
          }
        >
          <span className="text-[#8A76FC] text-sm font-medium">{settings.fps}</span>
          <div className="flex flex-col text-[#8A76FC] opacity-50">
            <ChevronUp size={14} className="-mb-1" />
            <ChevronDown size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
