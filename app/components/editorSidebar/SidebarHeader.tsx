import React from "react";
import Image from "next/image";
import { MainTab } from "./backgroundOptions";
import { isAvsPanelEnabled } from "@/app/lib/avs/flags";

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

      <div className="tab-switcher flex justify-between bg-[#F6F3FF] rounded-xl p-1">
        <button
          className={`tab-item flex-1 cursor-pointer py-2 rounded-lg text-sm font-semibold ${
            activeTab === "background" ? "active bg-white text-[#7C5CFC] shadow" : "text-gray-600"
          }`}
          onClick={() => setActiveTab("background")}
        >
          Background
        </button>
        <button
          className={`tab-item flex-1 cursor-pointer py-2 rounded-lg text-sm font-semibold ${
            activeTab === "tools" ? "active bg-white text-[#7C5CFC] shadow" : "text-gray-600"
          }`}
          onClick={() => setActiveTab("tools")}
        >
          Tools
        </button>
        <button
          className={`tab-item flex-1 cursor-pointer py-2 rounded-lg text-sm font-semibold ${
            activeTab === "cta" ? "active bg-white text-[#7C5CFC] shadow" : "text-gray-600"
          }`}
          onClick={() => setActiveTab("cta")}
        >
          CTA
        </button>
        {isAvsPanelEnabled() && (
          <button
            className={`tab-item flex-1 cursor-pointer py-2 rounded-lg text-sm font-semibold ${
              activeTab === "avs" ? "active bg-white text-[#7C5CFC] shadow" : "text-gray-600"
            }`}
            onClick={() => setActiveTab("avs")}
          >
            AI Voice
          </button>
        )}
      </div>
    </>
  );
};

export default SidebarHeader;
