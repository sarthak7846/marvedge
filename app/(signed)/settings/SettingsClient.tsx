"use client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useSettings } from "./hooks/useSettings";
import SettingsTabs from "./components/SettingsTabs";
import ProfileTab from "./components/ProfileTab";
import AccountTab from "./components/AccountTab";
import BrandingTab from "./components/BrandingTab";

export const metadata = {
  titleText: "Analytics",
  iconSRC: "/majesticons_analytics.png",
};
const SettingsPage = () => {
  const settings = useSettings();

  return (
    <div className="settings-page min-h-screen bg-[#F3F0FC]">
      <SettingsTabs activeTab={settings.activeTab} setActiveTab={settings.setActiveTab} />

      {settings.activeTab === "Profile" && <ProfileTab settings={settings} />}

      {settings.activeTab === "Account" && <AccountTab settings={settings} />}

      {settings.activeTab === "Branding" && <BrandingTab />}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SettingsPage;
