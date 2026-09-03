"use client";

import BrandingVisualsCard from "./branding/BrandingVisualsCard";
import HostingCard from "./branding/HostingCard";
import HubContentCard from "./branding/HubContentCard";
import VerificationCard from "./branding/VerificationCard";
import { useHubSettings } from "./branding/useHubSettings";

export default function BrandingTab() {
  const {
    loading,
    saving,
    verifying,
    logoUploading,
    fileInputRef,
    form,
    handleChange,
    handleColorChange,
    handleRemoveLogo,
    handleLogoUpload,
    handleSave,
    handleVerify,
  } = useHubSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-[#7C5CFC] text-xl animate-pulse font-medium">
          Loading hub settings...
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 md:px-8 lg:px-16 xl:px-24 max-w-7xl mx-auto mt-8 mb-12">
      <div className="w-full mb-6">
        <h2 className="text-2xl font-bold mb-1 text-gray-800">Demo Hub &amp; Branding</h2>
        <p className="text-gray-500">
          Configure your customizable product showcase portal and white-label custom domain
          settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          <BrandingVisualsCard
            form={form}
            logoUploading={logoUploading}
            fileInputRef={fileInputRef}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={handleRemoveLogo}
            onColorChange={handleColorChange}
          />

          <HubContentCard form={form} onChange={handleChange} />

          <HostingCard form={form} onChange={handleChange} />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`px-8 py-3 bg-[#7C5CFC] hover:bg-[#6c4be0] text-white font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                saving ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving settings..." : "Save Configuration"}
            </button>
          </div>
        </form>

        <VerificationCard form={form} verifying={verifying} onVerify={handleVerify} />
      </div>
    </div>
  );
}
