import { useEffect } from "react";

interface UseTimelineDeleteKeyParams {
  activeZoomIdx: number;
  removeZoomSegment: (idx: number) => void;
  activeSegment: number;
  removeSegment: (idx: number) => void;
}

/**
 * Pressing Delete/Backspace removes whichever timeline item is currently
 * active (a selected zoom effect or trim segment), matching the existing
 * pattern used for text overlays in useTextOverlays.ts.
 */
export function useTimelineDeleteKey({
  activeZoomIdx,
  removeZoomSegment,
  activeSegment,
  removeSegment,
}: UseTimelineDeleteKeyParams) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTyping =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;
      if (isTyping) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        if (activeZoomIdx >= 0) {
          event.preventDefault();
          removeZoomSegment(activeZoomIdx);
          return;
        }
        if (activeSegment >= 0) {
          event.preventDefault();
          removeSegment(activeSegment);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeZoomIdx, removeZoomSegment, activeSegment, removeSegment]);
}
