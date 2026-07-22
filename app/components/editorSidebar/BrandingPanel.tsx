import React from "react";

import WatermarkEditor from "./wtm/WatermarkEditor";
import { useWatermarkSettings } from "./wtm/useWatermarkSettings";
import WebcamEditor from "./wtm/WebcamEditor";
import { useWebcamSettings } from "./wtm/useWebcamSettings";

/**
 * WTM ("Branding") sidebar panel.
 *
 * PR 3 fills the scaffold with the watermark controls (WTM-6.3): a custom PNG
 * upload (`uploadBlobToGcs`, `kind:"watermark"`), an opacity slider, a corner
 * placement picker, and an enable/disable toggle so PRO users can remove the
 * Marvedge watermark. Those persist to `Demo.editing.wtm.watermark` via the
 * existing autosave (it already serializes the store's `wtm` field) and are
 * carried into the export payload by useExportFlow.
 *
 * PR 4 adds the camera bubble (WTM-6.4) below it: the recorder captures and
 * uploads a webcam clip to `Demo.editing.wtm.webcam.sourceUrl`, and these
 * controls place and size the circular bubble that gets composited over the
 * export. Configuring it is free for everyone; only the composited output is
 * PRO, and that is enforced server-side.
 *
 * The panel only decides what a user is *offered*: jobs/create re-resolves the
 * watermark from the user's real plan, so FREE/anonymous exports always get the
 * forced Marvedge badge no matter what is persisted here.
 *
 * The whole panel is gated behind NEXT_PUBLIC_WTM_ENABLED by its parents
 * (EditorSidebar / SidebarHeader), so nothing here renders when the flag is off.
 */
const BrandingPanel: React.FC = () => {
  const watermarkSettings = useWatermarkSettings();
  const webcamSettings = useWebcamSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-1">Branding</h2>
        <p className="text-xs text-[#6B6B6B] dark:text-inherit mb-4">
          Add your watermark to exported videos. Upload a custom logo, adjust its transparency and
          placement, or remove the Marvedge badge (PRO).
        </p>

        <WatermarkEditor {...watermarkSettings} />
      </div>

      <div className="border-t border-[#ede7fa] pt-6">
        <WebcamEditor {...webcamSettings} />
      </div>
    </div>
  );
};

export default BrandingPanel;
