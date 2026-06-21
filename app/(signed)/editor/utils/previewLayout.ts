interface PreviewLayoutParams {
  selectedBackground: string | null;
  aspectRatio: string;
  nativeAspectRatio: string;
  browserFrameDrawBorder: boolean;
  browserFrameDrawShadow: boolean;
  isFullscreen: boolean;
}

export function computePreviewLayout({
  selectedBackground,
  aspectRatio,
  nativeAspectRatio,
  browserFrameDrawBorder,
  browserFrameDrawShadow,
  isFullscreen,
}: PreviewLayoutParams) {
  const hasCanvasBackground =
    !!selectedBackground &&
    selectedBackground !== "none" &&
    selectedBackground !== "hidden" &&
    selectedBackground !== "transparent";
  const previewObjectFit = "contain" as const;
  const previewFrameAspectRatio =
    aspectRatio === "native" ? nativeAspectRatio : aspectRatio.replace(":", "/");
  const ratioParts = previewFrameAspectRatio.split("/");
  const ratioW = Number(ratioParts[0]);
  const ratioH = Number(ratioParts[1]);
  const previewRatioValue =
    Number.isFinite(ratioW) && Number.isFinite(ratioH) && ratioW > 0 && ratioH > 0
      ? ratioW / ratioH
      : 16 / 9;

  const browserFrameBorder = browserFrameDrawBorder ? "4px solid rgba(255,255,255,0.55)" : "none";
  const browserFrameShadow = browserFrameDrawShadow ? "0 14px 34px rgba(0,0,0,0.32)" : "none";
  const isPortraitPreview = previewRatioValue < 1;
  const stageHeight = selectedBackground
    ? isPortraitPreview
      ? isFullscreen
        ? "82%"
        : "92%"
      : isFullscreen
        ? "73%"
        : "84%"
    : "100%";
  const stageMaxWidth = selectedBackground ? (isPortraitPreview ? "95%" : "92%") : "100%";
  const stageContainerPadY = isPortraitPreview ? (isFullscreen ? 14 : 18) : isFullscreen ? 18 : 24;

  return {
    hasCanvasBackground,
    previewObjectFit,
    previewFrameAspectRatio,
    browserFrameBorder,
    browserFrameShadow,
    stageHeight,
    stageMaxWidth,
    stageContainerPadY,
  };
}
