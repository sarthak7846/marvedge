import { useCallback } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import type { WtmState } from "@/app/types/wtm";
import { isWtmPanelEnabled } from "@/app/lib/wtm/flags";
import { sanitizeWebcamConfig } from "@/app/lib/wtm/webcam";

// The compositor decodes both inputs, runs a per-pixel circular mask and
// re-encodes the whole source in one pass, so it is far slower than a normal
// request. Sits just past the route's own 300s `maxDuration`, so the route's
// error surfaces first when it can.
const WTM_COMPOSITE_TIMEOUT_MS = 330 * 1000;

/**
 * The WTM camera-bubble pre-pass (WTM-6.4), shaped as `exportVideo`'s
 * `prepareSourceUrl` hook: bake the circular bubble into the source before the
 * chunked export runs, and hand back the composited MP4's URL to export in
 * place of the original. The watermark is NOT done here — it keeps riding the
 * recipe into the render, resolved by plan server-side.
 *
 * Ordering matters: compositing is the earliest transform, so everything the
 * normal export does (trim / zoom / background / text / subtitles / watermark)
 * then applies on top of a source that already has the bubble.
 *
 * It never fails an export. No config, no recorded clip, the flag off, a
 * non-PRO user, or a worker error all degrade to the original source — with a
 * toast where the user could act on it — because losing the bubble is much
 * better than losing the export.
 */
export function useWebcamComposite(wtm: WtmState | null) {
  return useCallback(
    async (
      sourceVideoUrl: string,
      { setStatus }: { setStatus: (message: string) => void }
    ): Promise<string> => {
      const webcam = sanitizeWebcamConfig(wtm?.webcam);
      if (!isWtmPanelEnabled() || !webcam?.enabled || !webcam.sourceUrl) {
        return sourceVideoUrl;
      }

      try {
        setStatus("Compositing camera…");
        const res = await axios.post(
          "/api/wtm/composite",
          { videoUrl: sourceVideoUrl, webcam },
          { timeout: WTM_COMPOSITE_TIMEOUT_MS }
        );
        const composited = res.data?.compositedVideoUrl;
        return typeof composited === "string" && composited ? composited : sourceVideoUrl;
      } catch (error) {
        console.error("WTM composite pre-pass failed:", error);
        // 404 means WTM_ENABLED is off server-side — the feature is meant to be
        // invisible then, so say nothing and export as usual.
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status !== 404) {
          const serverMessage = axios.isAxiosError(error)
            ? (error.response?.data as { error?: string } | undefined)?.error
            : undefined;
          // A 403 carries the "PRO plan" explanation, which is worth showing
          // verbatim; anything else is an internal failure the user cannot act
          // on, so it just explains what the export will be missing.
          toast.error(
            status === 403 && serverMessage
              ? serverMessage
              : "Could not add the camera bubble — exporting without it."
          );
        }
        return sourceVideoUrl;
      }
    },
    [wtm]
  );
}
