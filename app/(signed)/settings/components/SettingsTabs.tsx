import { TABS } from "../../../lib/constants";
import { isBdhRoutingEnabled } from "@/app/lib/bdh/flags";

type SettingsTabsProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export default function SettingsTabs({ activeTab, setActiveTab }: SettingsTabsProps) {
  // With BDH off the hub APIs return 404, so don't offer a tab that can only
  // fail. NEXT_PUBLIC_BDH_ENABLED is inlined at build time and safe on the client.
  const tabs = isBdhRoutingEnabled() ? TABS : TABS.filter((tab) => tab !== "Branding");

  return (
    <div className="tabs flex flex-wrap items-center gap-2 px-2 sm:px-4 md:px-8 pb-3 pt-4 bg-white border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`tab flex-1 min-w-[120px] px-3 sm:px-6 py-2 border rounded-lg text-base sm:text-lg font-medium transition-colors focus:outline-none whitespace-nowrap ${
            activeTab === tab
              ? "active bg-[#7C5CFC] text-white shadow"
              : "bg-transparent text-gray-500 hover:bg-[#ede7fa]"
          }`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
