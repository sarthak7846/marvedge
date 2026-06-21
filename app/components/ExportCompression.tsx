import type { ExportSettings } from "./ExportSettingsModal";

type ExportCompressionProps = {
  settings: ExportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
};

export default function ExportCompression({ settings, setSettings }: ExportCompressionProps) {
  return (
    <div className="mb-5">
      <label className="block text-[#8A76FC] text-[15px] mb-2">Compression</label>
      <div className="flex bg-[#EAE5FB] rounded-xl p-1 relative h-[42px]">
        <div
          className="absolute top-1 bottom-1 w-[calc(25%-6px)] bg-[#8A76FC] rounded-lg transition-transform duration-300 ease-in-out"
          style={{
            transform:
              settings.compression === "Web"
                ? "translateX(0)"
                : settings.compression === "Medium"
                  ? "translateX(105%)"
                  : settings.compression === "High"
                    ? "translateX(210%)"
                    : "translateX(315%)",
          }}
        />
        {["Web", "Medium", "High", "Ultra"].map((comp) => (
          <button
            key={comp}
            className={`flex-1 relative z-10 text-sm font-medium transition-colors ${
              settings.compression === comp ? "text-white" : "text-[#8A76FC]"
            }`}
            onClick={() =>
              setSettings({
                ...settings,
                compression: comp as ExportSettings["compression"],
              })
            }
          >
            {comp}
          </button>
        ))}
      </div>
    </div>
  );
}
