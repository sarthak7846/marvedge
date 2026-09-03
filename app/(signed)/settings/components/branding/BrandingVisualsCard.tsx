import Image from "next/image";
import type { RefObject } from "react";

import { CARD_CLASS, CARD_HEADING_CLASS } from "./styles";
import type { HubSettingsData } from "./useHubSettings";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2 border dark:border-[rgba(255,255,255,0.08)] rounded-md p-2 bg-gray-50 dark:bg-[#151229]">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-[rgba(255,255,255,0.15)]"
        />
        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{value}</span>
      </div>
    </div>
  );
}

interface BrandingVisualsCardProps {
  form: HubSettingsData;
  logoUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onColorChange: (name: string, value: string) => void;
}

export default function BrandingVisualsCard({
  form,
  logoUploading,
  fileInputRef,
  onLogoUpload,
  onRemoveLogo,
  onColorChange,
}: BrandingVisualsCardProps) {
  return (
    <div className={`${CARD_CLASS} p-6 md:p-8 space-y-6`}>
      <h3 className={CARD_HEADING_CLASS}>Branding Visuals</h3>

      {/* Logo Section */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-lg bg-gray-50 dark:bg-[#151229] border border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.15)] flex items-center justify-center overflow-hidden shrink-0 relative">
          {form.logoUrl ? (
            <Image src={form.logoUrl} alt="Logo" fill className="object-contain p-2" />
          ) : (
            <span className="text-gray-400 dark:text-gray-500 text-xs text-center px-2">
              No logo uploaded
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Hub Custom Logo
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Supported formats: PNG, JPG, WEBP. Max size 2MB.
          </span>
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="px-4 py-2 bg-[#7C5CFC] hover:bg-[#6c4be0] text-white text-xs font-semibold rounded-md transition-colors"
            >
              {logoUploading ? "Uploading..." : "Upload logo"}
            </button>
            {form.logoUrl && (
              <button
                type="button"
                onClick={onRemoveLogo}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#151229] dark:hover:bg-[#1b1735] text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-md border dark:border-[rgba(255,255,255,0.08)] transition-colors"
              >
                Remove
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={onLogoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Color Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <ColorField
          label="Brand Color"
          value={form.brandColor}
          onChange={(v) => onColorChange("brandColor", v)}
        />
        <ColorField
          label="Text Color"
          value={form.textColor}
          onChange={(v) => onColorChange("textColor", v)}
        />
        <ColorField
          label="Accent Background"
          value={form.accentColor}
          onChange={(v) => onColorChange("accentColor", v)}
        />
      </div>
    </div>
  );
}
