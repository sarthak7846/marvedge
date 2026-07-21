import React from "react";

/**
 * WTM ("Branding") sidebar panel.
 *
 * PR 1 (this) is a scaffold only — an empty shell so the tab exists behind the
 * flag. Nothing is wired to the export yet.
 *
 * PR 3 fills it in with the watermark controls (WTM-6.3): a custom PNG upload
 * (`uploadBlobToGcs`, `kind:"watermark"`), an opacity slider, a corner-position
 * picker, and an enable/disable toggle so PRO users can remove the Marvedge
 * watermark. Those persist to `Demo.editing.wtm.watermark` via the existing
 * autosave (it already serializes the store's `wtm` field). The forced free-tier
 * Marvedge badge is decided server-side in jobs/create and is not controlled here.
 *
 * The whole panel is gated behind NEXT_PUBLIC_WTM_ENABLED by its parents
 * (EditorSidebar / SidebarHeader), so nothing here renders when the flag is off.
 */
const BrandingPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-1">Branding</h2>
        <p className="text-xs text-[#6B6B6B] dark:text-inherit mb-4">
          Add your watermark to exported videos. Upload a custom logo, adjust its transparency and
          placement, or remove the Marvedge badge (PRO).
        </p>
      </div>
    </div>
  );
};

export default BrandingPanel;
