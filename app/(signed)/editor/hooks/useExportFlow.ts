import { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import { ExportSettings } from "@/app/components/ExportSettingsModal";
import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { exportVideo } from "../utils/videoHandlers";
import { useWebcamComposite } from "./useWebcamComposite";
import { sanitizeSubtitleStyle } from "@/app/lib/subtitles";
import type { SubtitleStyle } from "@/app/lib/subtitles";
import { sanitizeWatermarkConfig } from "@/app/lib/wtm/watermark";
import { buildExportSpeed, resolveExportBackgroundSelection } from "../utils/exportHelpers";
import { SubtitleCue, TextOverlayItem } from "../types";
import type { EditorState } from "../apiTypes";

interface UseExportFlowProps {
  editorState: EditorState;
  imageMap: Record<string, string>;
  segments: { start: number; end: number }[];
  zoomSegments: ZoomEffect[];
  subtitleCues: SubtitleCue[];
  subtitleStyle: SubtitleStyle | null;
  subtitleLanguage: string;
  textOverlays: TextOverlayItem[];
  playbackSpeed: number;
}

type PendingExport = {
  exportedUrl: string;
  sourceVideoUrl: string;
  downloadAsMp4: (url: string) => Promise<void>;
  uploadedSourceVideo: boolean;
  settings: ExportSettings;
  demoId: string | null;
  shareUrl?: string;
};

export function useExportFlow({
  editorState,
  imageMap,
  segments,
  zoomSegments,
  subtitleCues,
  subtitleStyle,
  subtitleLanguage,
  textOverlays,
  playbackSpeed,
}: UseExportFlowProps) {
  const {
    videoUrl,
    customBackground,
    selectedBackground,
    sidebarTitle,
    sidebarDescription,
    aspectRatio,
    browserFrameMode,
    browserFrameDrawShadow,
    browserFrameDrawBorder,
    duration,
    savedDemoId,
    wtm,
  } = editorState;

  const [showExportSettings, setShowExportSettings] = useState(false);
  const [showExportResultModal, setShowExportResultModal] = useState(false);
  const [resultActionLoading, setResultActionLoading] = useState(false);
  const [shareLinkSaved, setShareLinkSaved] = useState(false);
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);

  const setProgress = () => {};

  const saveExportedVideoRecord = async (
    exportedUrl: string,
    sourceVideoUrl: string,
    settings: ExportSettings,
    demoId?: string | null
  ) => {
    const res = await axios.post("/api/exported-videos", {
      title: sidebarTitle?.trim() || "Untitled Export",
      description: sidebarDescription?.trim() || "",
      exportedUrl,
      sourceVideoUrl,
      settings,
      demoId: demoId || null,
      upsertByDemo: Boolean(demoId),
    });
    return res.data?.exportedVideo?.id;
  };

  // WTM: the camera-bubble pre-pass, run over the source before the chunked
  // export (see useWebcamComposite). A no-op without a recorded clip.
  const compositeWebcamBubble = useWebcamComposite(wtm);

  const onExportVideo = async (settings: ExportSettings) => {
    setShowExportSettings(false);

    const localObjectUrl = customBackground ? URL.createObjectURL(customBackground) : null;
    const { resolvedSelectedBackground, resolvedCustomBackgroundUrl } =
      resolveExportBackgroundSelection({ selectedBackground, imageMap, localObjectUrl });

    const result = await exportVideo({
      videoUrl: videoUrl!,
      selectedBackground: resolvedSelectedBackground,
      customBackgroundUrl: resolvedCustomBackgroundUrl,
      imageMap,
      sidebarTitle,
      sidebarDescription,
      segments,
      zoomSegments,
      subtitles: subtitleCues,
      // SUB: the demo's persisted style, re-sanitized server-side by
      // /api/jobs/create. Undefined for a demo that was never styled → the
      // recipe carries no style and the worker keeps master's hardcoded one.
      subtitleStyle: sanitizeSubtitleStyle(subtitleStyle),
      // SUB PR 5: the active track's language. The worker needs it to decide
      // right-to-left layout for the burn-in; the route re-normalizes it.
      subtitleLanguage,
      // SUB PR 6: the export-settings switch. Only ever false when the user
      // explicitly turned burn-in off — undefined and true both mean "burn
      // them in", which is what every export did before the switch existed.
      burnSubtitles: settings.burnSubtitles,
      textOverlays,
      setProgress,
      aspectRatio,
      browserFrame: {
        mode: browserFrameMode,
        drawShadow: browserFrameDrawShadow,
        drawBorder: browserFrameDrawBorder,
      },
      duration,
      savedDemoId,
      settings: {
        ...settings,
        fps: "24 FPS",
        speed: buildExportSpeed(playbackSpeed),
      },
      // WTM: hand the demo's persisted watermark config to the export. The
      // server decides the effective watermark from the user's plan (FREE →
      // forced Marvedge badge), so this is a request, not the final word.
      // Undefined for demos with no branding config → payload unchanged.
      watermark: sanitizeWatermarkConfig(wtm?.watermark),
      // WTM: composite the camera bubble into the source first (a no-op for
      // demos without a recorded clip), so the chunked export renders the
      // already-composited MP4.
      prepareSourceUrl: compositeWebcamBubble,
    });

    if (result) {
      setPendingExport({
        ...result,
        settings,
        demoId: savedDemoId ?? null,
      });
      setShareLinkSaved(false);
      setShowExportResultModal(true);
    }

    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl);
    }
  };

  const handleDownloadMp4Only = async () => {
    if (!pendingExport) {
      return;
    }
    try {
      setResultActionLoading(true);
      await pendingExport.downloadAsMp4(pendingExport.exportedUrl);
      await axios.post("/api/exported-videos/cleanup", {
        exportedUrl: pendingExport.exportedUrl,
        sourceVideoUrl: pendingExport.uploadedSourceVideo ? pendingExport.sourceVideoUrl : null,
        demoId: pendingExport.demoId,
      });
      toast.success("Downloaded MP4 without saving share link");
      setShowExportResultModal(false);
      setPendingExport(null);
    } catch (cleanupError) {
      console.error("Failed during download-only cleanup:", cleanupError);
      toast.error("MP4 downloaded, but cleanup failed");
    } finally {
      setResultActionLoading(false);
    }
  };

  const handleSaveShareLink = async () => {
    if (!pendingExport) {
      return;
    }

    try {
      setResultActionLoading(true);
      const exportedVideoId = await saveExportedVideoRecord(
        pendingExport.exportedUrl,
        pendingExport.sourceVideoUrl,
        pendingExport.settings,
        pendingExport.demoId
      );

      const generatedShareUrl = `${window.location.origin}/share/video/${exportedVideoId}`;
      setPendingExport((prev) => (prev ? { ...prev, shareUrl: generatedShareUrl } : null));
      setShareLinkSaved(true);

      toast.success("Share link generated successfully!");
    } catch (saveError) {
      console.error("Failed to generate share link:", saveError);
      toast.error("Failed to generate share link");
    } finally {
      setResultActionLoading(false);
    }
  };

  return {
    showExportSettings,
    setShowExportSettings,
    showExportResultModal,
    setShowExportResultModal,
    resultActionLoading,
    shareLinkSaved,
    pendingExport,
    setPendingExport,
    onExportVideo,
    handleDownloadMp4Only,
    handleSaveShareLink,
  };
}
