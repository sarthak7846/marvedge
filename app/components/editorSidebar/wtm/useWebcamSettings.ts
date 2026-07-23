import React from "react";
import { useShallow } from "zustand/react/shallow";

import type { WebcamOverlay, WtmPosition, WtmState } from "@/app/types/wtm";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useWtmPlan } from "@/app/hooks/useWtmPlan";
import { clampNumber } from "@/app/lib/wtm/watermark";
import { DEFAULT_WEBCAM, WTM_WEBCAM_SIZE_MAX, WTM_WEBCAM_SIZE_MIN } from "@/app/lib/wtm/webcam";

export interface WebcamSettings {
  /** Whether the plan gate is still being resolved (the PRO note is held back). */
  planLoading: boolean;
  /** PRO/ENTERPRISE — exports actually get the bubble composited in. */
  isPro: boolean;
  /** The config to render controls from (persisted values, or the defaults). */
  webcam: WebcamOverlay;
  /** True once this demo has its own persisted config (vs. showing defaults). */
  hasConfig: boolean;
  /** True when a webcam clip was captured and uploaded for this recording. */
  hasClip: boolean;
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: WtmPosition) => void;
  setSize: (size: number) => void;
}

/**
 * Owns the camera-bubble half of the Branding panel (WTM-6.4).
 *
 * Reads/writes `editing.wtm.webcam` through the editor store's `wtm` slice — the
 * same slice the watermark uses, and already serialized by the existing autosave,
 * so everything here persists into `Demo.editing.wtm` with no migration. The
 * `sourceUrl` itself is not set here: it is written by the recorder when a camera
 * clip is captured and uploaded (see app/lib/wtm/webcamSource.ts).
 *
 * Unlike the watermark, the controls are NOT locked for FREE users — capturing
 * and configuring a bubble is free, and the PRO gate is enforced server-side at
 * composite/export time. `isPro` here only decides whether to show that note.
 */
export function useWebcamSettings(): WebcamSettings {
  const { wtm, setWtm } = useEditorStore(
    useShallow((s) => ({
      wtm: s.wtm,
      setWtm: s.setWtm,
    }))
  );

  const { isPro, planLoading } = useWtmPlan();

  const persisted = wtm?.webcam;
  const webcam = persisted ?? DEFAULT_WEBCAM;

  // Merge into the webcam config while preserving the rest of the WTM state
  // (notably the watermark, which the sibling hook owns).
  const updateWebcam = React.useCallback(
    (patch: Partial<WebcamOverlay>) => {
      setWtm((prev) => {
        const base: WtmState = prev ?? {};
        return {
          ...base,
          webcam: { ...DEFAULT_WEBCAM, ...base.webcam, ...patch },
        };
      });
    },
    [setWtm]
  );

  const setEnabled = React.useCallback(
    (enabled: boolean) => updateWebcam({ enabled }),
    [updateWebcam]
  );

  const setPosition = React.useCallback(
    (position: WtmPosition) => updateWebcam({ position }),
    [updateWebcam]
  );

  const setSize = React.useCallback(
    (size: number) =>
      updateWebcam({
        size: clampNumber(size, WTM_WEBCAM_SIZE_MIN, WTM_WEBCAM_SIZE_MAX, DEFAULT_WEBCAM.size),
      }),
    [updateWebcam]
  );

  return {
    planLoading,
    isPro,
    webcam,
    hasConfig: Boolean(persisted),
    hasClip: Boolean(webcam.sourceUrl),
    setEnabled,
    setPosition,
    setSize,
  };
}
