import React from "react";
import Image from "next/image";
import { MainTab } from "./backgroundOptions";
import { isAvsPanelEnabled } from "@/app/lib/avs/flags";
import { isWtmPanelEnabled } from "@/app/lib/wtm/flags";
import { isSubtitleEditorEnabled } from "@/app/lib/subtitles";
import { isAudioPanelEnabled } from "@/app/lib/audio/flags";
import SidebarTabs from "./SidebarTabs";

interface SidebarHeaderProps {
  title: string;
  onToggleDashboardMenu?: () => void;
  onOpenSaveDemo?: () => void;
  savingDemo: boolean;
  demoSaved: boolean;
  onExportWebM: () => void;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  title,
  onToggleDashboardMenu,
  onOpenSaveDemo,
  savingDemo,
  demoSaved,
  onExportWebM,
  activeTab,
  setActiveTab,
}) => {
  const tabs: { id: MainTab; label: string }[] = [
    { id: "background", label: "Background" },
    { id: "tools", label: "Tools" },
    { id: "cta", label: "CTA" },
    ...(isAvsPanelEnabled() ? [{ id: "avs" as MainTab, label: "AI Voice" }] : []),
    ...(isSubtitleEditorEnabled() ? [{ id: "subtitles" as MainTab, label: "Subtitles" }] : []),
    ...(isAudioPanelEnabled() ? [{ id: "audio" as MainTab, label: "Audio" }] : []),
    ...(isWtmPanelEnabled() ? [{ id: "branding" as MainTab, label: "Branding" }] : []),
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggleDashboardMenu?.()}
          className="h-[54px] w-[68px] rounded-xl bg-[#A594F9] hover:bg-[#7C5CFC] transition flex items-center justify-center shrink-0 shadow-sm"
          aria-label="Open dashboard menu"
        >
          <div className="flex flex-col gap-1.5">
            <span className="block w-6 h-0.5 bg-white rounded-full" />
            <span className="block w-6 h-0.5 bg-white rounded-full opacity-90" />
            <span className="block w-6 h-0.5 bg-white rounded-full opacity-80" />
          </div>
        </button>
        <div className="min-w-0">
          <div className="text-xl font-bold text-[#A594F9] tracking-tight truncate">
            {title?.trim() ? title.trim() : "Untitled demo"}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenSaveDemo?.()}
        disabled={savingDemo || demoSaved}
        className={`flex items-center justify-center gap-2 w-full h-[54px] font-semibold rounded-lg shadow transition text-sm ${
          savingDemo
            ? "bg-[#8A76FC] text-white opacity-70 cursor-not-allowed"
            : demoSaved
              ? "bg-[#A594F9] text-white cursor-not-allowed opacity-80"
              : "bg-[#8A76FC] hover:bg-[#7A66EC] text-white"
        }`}
      >
        {savingDemo ? "Saving..." : demoSaved ? "Saved" : "Save Demo"}
      </button>

      <div className="relative">
        <button
          className="export-btn flex items-center justify-center gap-2 w-full h-[54px] bg-[#A594F9] hover:bg-[#7C5CFC] text-white font-semibold py-1.5 rounded-lg shadow transition text-sm"
          onClick={() => {
            onExportWebM();
          }}
        >
          <Image src="/icons/bx_export.svg" alt="export_icon" width={24} height={24} />
          <span className="text-md">Export Video</span>
        </button>

        {}
      </div>

      <SidebarTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
};

export default SidebarHeader;
