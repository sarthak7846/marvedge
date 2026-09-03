"use client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useSettings } from "./hooks/useSettings";
import SettingsTabs from "./components/SettingsTabs";
import ProfileTab from "./components/ProfileTab";
import AccountTab from "./components/AccountTab";
import BrandingTab from "./components/BrandingTab";
import CrmTab from "./components/CrmTab";
import { TABS } from "../../lib/constants";
import { isOverlaysPanelEnabled } from "@/app/lib/overlays/flags";

export const metadata = {
  titleText: "Analytics",
  iconSRC: "/majesticons_analytics.png",
};

/**
 * OVL (#302 §2.1) adds a CRM-delivery tab. It is appended to the shared TABS
 * list rather than added to it, so with NEXT_PUBLIC_OVERLAYS_ENABLED unset this
 * page renders exactly the three tabs it renders today — the flag is read at
 * module scope because Next inlines it at build time.
 */
const CRM_TAB = "Integrations";
const TAB_LIST = isOverlaysPanelEnabled() ? [...TABS, CRM_TAB] : TABS;

const SettingsPage = () => {
  const settings = useSettings();

  return (
    <div className="settings-page min-h-screen bg-[#F3F0FC]">
      <SettingsTabs
        activeTab={settings.activeTab}
        setActiveTab={settings.setActiveTab}
        tabs={TAB_LIST}
      />

      {settings.activeTab === "Profile" && <ProfileTab settings={settings} />}

      {settings.activeTab === "Account" && <AccountTab settings={settings} />}

      {settings.activeTab === "Branding" && <BrandingTab />}

      {settings.activeTab === CRM_TAB && isOverlaysPanelEnabled() && <CrmTab />}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SettingsPage;
