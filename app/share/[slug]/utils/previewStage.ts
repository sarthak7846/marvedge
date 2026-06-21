const RATIO_MAP: Record<string, string> = {
  "16:9": "16 / 9",
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "9:16": "9 / 16",
  "3:4": "3 / 4",
};

export type PreviewStage = {
  previewFrameAspectRatio: string;
  stageWidth: string;
  stageHeight: string;
  stageMaxWidth: string;
};

export function getPreviewStage(aspectRatio: string): PreviewStage {
  const previewFrameAspectRatio =
    aspectRatio === "native" ? "16 / 9" : RATIO_MAP[aspectRatio] || "16 / 9";
  const [w, h] = previewFrameAspectRatio.split("/").map((v) => Number(v.trim()));
  const previewRatioValue =
    Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 16 / 9;
  const isPortraitPreview = previewRatioValue < 1;
  const isSquarePreview = Math.abs(previewRatioValue - 1) < 0.05;

  const stageWidth = isPortraitPreview
    ? "min(420px, 52vw)"
    : isSquarePreview
      ? "min(700px, 74vw)"
      : "min(1120px, 94vw)";
  const stageHeight = isPortraitPreview ? "88%" : "84%";
  const stageMaxWidth = isPortraitPreview ? "46%" : isSquarePreview ? "62%" : "92%";

  return { previewFrameAspectRatio, stageWidth, stageHeight, stageMaxWidth };
}
