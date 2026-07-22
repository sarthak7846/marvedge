import React from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import type { WatermarkConfig, WtmPosition, WtmState } from "@/app/types/wtm";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { isWtmAllowed } from "@/app/lib/wtm/access";
import {
  DEFAULT_WATERMARK,
  WTM_OPACITY_MAX,
  WTM_OPACITY_MIN,
  clampNumber,
} from "@/app/lib/wtm/watermark";
import { uploadBlobToGcs } from "@/app/lib/gcsUploadClient";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — a corner badge never needs more.

export interface WatermarkSettings {
  /** Whether the plan gate is still being resolved (renders as locked until known). */
  planLoading: boolean;
  /** PRO/ENTERPRISE — may customize or remove the watermark. */
  isPro: boolean;
  /** The config to render controls from (persisted values, or the defaults). */
  watermark: WatermarkConfig;
  /** True once this demo has its own persisted config (vs. showing defaults). */
  hasConfig: boolean;
  /** Object URL of a just-picked file, or the persisted asset URL — for preview. */
  previewUrl: string | null;
  uploading: boolean;
  setEnabled: (enabled: boolean) => void;
  setOpacity: (opacity: number) => void;
  setPosition: (position: WtmPosition) => void;
  handleUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Drop the custom logo and fall back to the bundled Marvedge badge. */
  handleRemoveLogo: () => void;
}

/**
 * Owns the watermark half of the Branding panel (WTM-6.3).
 *
 * Reads/writes `editing.wtm.watermark` through the editor store's `wtm` slice —
 * the existing autosave already serializes that field, so everything here
 * persists into `Demo.editing.wtm` with no migration. The export payload picks
 * the same config up (see useExportFlow), and the render engine bakes it in.
 *
 * The plan gate mirrors the server's: only PRO/ENTERPRISE may upload a logo,
 * change opacity/placement, or switch the watermark off. This hook only decides
 * what the UI offers — app/api/jobs/create/route.ts re-resolves the watermark
 * from the user's real plan, so a FREE user always gets the forced Marvedge
 * badge regardless of what is persisted here.
 */
export function useWatermarkSettings(): WatermarkSettings {
  const { wtm, setWtm } = useEditorStore(
    useShallow((s) => ({
      wtm: s.wtm,
      setWtm: s.setWtm,
    }))
  );

  const [plan, setPlan] = React.useState<string | null>(null);
  const [planLoading, setPlanLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  // Local preview for a file the user just picked: the upload bucket may be
  // private, so the persisted https URL is not always renderable in the browser.
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(null);

  // Same source of truth as the export modal's plan check (/api/user/export-count).
  React.useEffect(() => {
    let cancelled = false;
    axios
      .get("/api/user/export-count")
      .then((res) => {
        if (!cancelled && res.data && typeof res.data.plan === "string") {
          setPlan(res.data.plan);
        }
      })
      .catch((err) => console.error("Could not fetch plan for branding panel", err))
      .finally(() => {
        if (!cancelled) {
          setPlanLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const isPro = isWtmAllowed(plan);
  const persisted = wtm?.watermark;
  const watermark = persisted ?? DEFAULT_WATERMARK;

  // Merge into the watermark config while preserving the rest of the WTM state
  // (e.g. the forward-compat `webcam` key).
  const updateWatermark = React.useCallback(
    (patch: Partial<WatermarkConfig>) => {
      setWtm((prev) => {
        const base: WtmState = prev ?? {};
        return {
          ...base,
          watermark: { ...DEFAULT_WATERMARK, ...base.watermark, ...patch },
        };
      });
    },
    [setWtm]
  );

  const setEnabled = React.useCallback(
    (enabled: boolean) => updateWatermark({ enabled }),
    [updateWatermark]
  );

  const setOpacity = React.useCallback(
    (opacity: number) =>
      updateWatermark({
        opacity: clampNumber(opacity, WTM_OPACITY_MIN, WTM_OPACITY_MAX, DEFAULT_WATERMARK.opacity),
      }),
    [updateWatermark]
  );

  const setPosition = React.useCallback(
    (position: WtmPosition) => updateWatermark({ position }),
    [updateWatermark]
  );

  const handleUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Let the same file be re-picked after an error.
      event.target.value = "";
      if (!file) {
        return;
      }
      if (file.type !== "image/png") {
        toast.error("Watermark must be a PNG");
        return;
      }
      if (file.size > MAX_LOGO_BYTES) {
        toast.error("Watermark must be under 2 MB");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setLocalPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return objectUrl;
      });

      const toastId = toast.loading("Uploading watermark…");
      setUploading(true);
      try {
        const uploaded = await uploadBlobToGcs({
          blob: file,
          filename: file.name || "watermark.png",
          kind: "watermark",
        });
        // Prefer the https form: it is what the worker downloads and what the
        // panel can preview after a reload. `url` (gs://) is normalized server-side.
        updateWatermark({ enabled: true, assetUrl: uploaded.publicUrl || uploaded.url });
        toast.success("Watermark uploaded", { id: toastId });
      } catch (error) {
        console.error("Watermark upload failed:", error);
        toast.error("Failed to upload watermark", { id: toastId });
        setLocalPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return null;
        });
      } finally {
        setUploading(false);
      }
    },
    [updateWatermark]
  );

  const handleRemoveLogo = React.useCallback(() => {
    setLocalPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setWtm((prev) => {
      const base: WtmState = prev ?? {};
      const next: WatermarkConfig = { ...DEFAULT_WATERMARK, ...base.watermark };
      // Drop assetUrl entirely so the worker falls back to the bundled badge.
      delete next.assetUrl;
      return { ...base, watermark: next };
    });
  }, [setWtm]);

  return {
    planLoading,
    isPro,
    watermark,
    hasConfig: Boolean(persisted),
    previewUrl: localPreviewUrl ?? watermark.assetUrl ?? null,
    uploading,
    setEnabled,
    setOpacity,
    setPosition,
    handleUpload,
    handleRemoveLogo,
  };
}
