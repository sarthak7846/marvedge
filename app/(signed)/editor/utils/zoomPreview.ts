import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { clamp } from "./clamp";

interface ZoomPreviewParams {
  zoomSegments: ZoomEffect[];
  activeZoomIdx: number;
  currentTime: number;
}

export function computeZoomPreview({
  zoomSegments,
  activeZoomIdx,
  currentTime,
}: ZoomPreviewParams) {
  const resolvedZoomIdx =
    activeZoomIdx >= 0 && activeZoomIdx < zoomSegments.length
      ? activeZoomIdx
      : zoomSegments.length > 0
        ? 0
        : -1;
  const activeEditedZoomSegment = resolvedZoomIdx >= 0 ? zoomSegments[resolvedZoomIdx] : null;
  const activePlaybackZoomSegment = zoomSegments.find(
    (segment) => currentTime >= segment.startTime && currentTime <= segment.endTime
  );
  const activePreviewZoomSegment = activePlaybackZoomSegment ?? activeEditedZoomSegment;
  const isWithinActiveEditedSegment =
    !!activeEditedZoomSegment &&
    currentTime >= activeEditedZoomSegment.startTime &&
    currentTime <= activeEditedZoomSegment.endTime;
  const shouldShowZoomFocusBox = !!activeEditedZoomSegment && isWithinActiveEditedSegment;
  const shouldApplyZoomPreview = !!activePlaybackZoomSegment;

  const previewZoomScale = activePreviewZoomSegment
    ? 1 + (Math.max(1, activePreviewZoomSegment.zoomLevel) - 1) * 0.8
    : 1;
  const zoomFocusSizePct = 15;

  const zoomCx = (activePreviewZoomSegment?.x ?? 0.5) * 100;
  const zoomCy = (activePreviewZoomSegment?.y ?? 0.5) * 100;
  const zoomTranslateX = shouldApplyZoomPreview
    ? clamp(zoomCx - 50 / previewZoomScale, 0, 100 - 100 / previewZoomScale)
    : 0;
  const zoomTranslateY = shouldApplyZoomPreview
    ? clamp(zoomCy - 50 / previewZoomScale, 0, 100 - 100 / previewZoomScale)
    : 0;

  return {
    resolvedZoomIdx,
    activeEditedZoomSegment,
    shouldShowZoomFocusBox,
    shouldApplyZoomPreview,
    previewZoomScale,
    zoomFocusSizePct,
    zoomTranslateX,
    zoomTranslateY,
  };
}
