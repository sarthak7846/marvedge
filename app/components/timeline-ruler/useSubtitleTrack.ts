import React from "react";
import { useShallow } from "zustand/react/shallow";

import { isSubtitleEditorEnabled } from "@/app/lib/subtitles";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";
import type { SubtitleCue } from "@/app/(signed)/editor/types";
import { useSubtitleCueDrag } from "./useTimelineDrags";
import {
  type SubtitleClusterItem,
  type SubtitleTrackItem,
  cullSubtitleTrackItems,
  layoutSubtitleTrack,
  pixelsPerSecond,
  scrollLeftForTime,
  zoomLevelForCluster,
} from "./subtitleTrackLayout";

interface UseSubtitleTrackProps {
  minValue: number;
  maxValue: number;
  baseTimelineWidth: number;
  zoomedTimelineWidth: number;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  scrollLeft: number;
  setScrollLeft: React.Dispatch<React.SetStateAction<number>>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Current playhead position — a snap target while dragging. */
  playheadSeconds: number;
  /** The ruler's own seek channel: sets the editor's time and moves the player. */
  onValueChange?: (value: number) => void;
}

export interface SubtitleTrackVm {
  /** Whether to render the track at all. False keeps the ruler exactly as it is today. */
  visible: boolean;
  /** Layout items for the visible slice of the track. */
  items: SubtitleTrackItem[];
  cueCount: number;
  selectedCueIndex: number | null;
  /** Index being dragged right now, or `null`. Blocks use it to stay lit. */
  draggingIndex: number | null;
  setDragSubtitleState: ReturnType<typeof useSubtitleCueDrag>["setDragSubtitleState"];
  /** Select a cue and move the playhead to its start. */
  selectCueAt: (index: number) => void;
  /** Clear the selection — clicking the ruler away from a block. */
  clearSelection: () => void;
  /** Zoom in on a collapsed run until its cues become individually draggable. */
  focusCluster: (cluster: SubtitleClusterItem) => void;
}

/**
 * Everything the ruler's subtitle track needs, in one place: the cue list, the
 * level-of-detail layout, the drag wiring, and the zoom-and-scroll affordance
 * that gets a user from a dense track to an editable one.
 *
 * This is the only file in app/components/timeline-ruler/ that touches a store.
 * The ruler's other hooks are strictly props-in, and dragging store access into
 * them for one feature would leave the timeline half-lifted. Cue state,
 * meanwhile, genuinely IS shared — the sidebar list and this track select each
 * other's rows, and the preview overlay reads the same cues — so plumbing it
 * through `TimelineRulerProps` would mean threading it through four components
 * that have no other use for it.
 */
export function useSubtitleTrack({
  minValue,
  maxValue,
  baseTimelineWidth,
  zoomedTimelineWidth,
  zoomLevel,
  setZoomLevel,
  scrollLeft,
  setScrollLeft,
  scrollContainerRef,
  playheadSeconds,
  onValueChange,
}: UseSubtitleTrackProps): SubtitleTrackVm {
  // Read once per module load: Next inlines NEXT_PUBLIC_* at build time, so this
  // cannot change between renders.
  const enabled = isSubtitleEditorEnabled();

  const { cues, selectedCueIndex, selectCue, beginCueDrag, dragCues, endCueDrag } =
    useSubtitleStore(
      useShallow((s) => ({
        cues: s.subtitleCues,
        selectedCueIndex: s.selectedCueIndex,
        selectCue: s.selectCue,
        beginCueDrag: s.beginCueDrag,
        dragCues: s.dragCues,
        endCueDrag: s.endCueDrag,
      }))
    );
  const cueFocusNonce = useSubtitleStore((s) => s.cueFocusNonce);

  // The track only exists once there is something to put on it. An empty lane
  // is noise on a timeline that is already three tracks deep, and with the flag
  // off the ruler must be byte-for-byte what it is today.
  const visible = enabled && cues.length > 0;

  // Clustering depends on the cue list and the zoom, never on the scroll offset,
  // so cluster boundaries hold still while the user scrolls.
  const items = React.useMemo(
    () => (visible ? layoutSubtitleTrack(cues, { minValue, maxValue, zoomedTimelineWidth }) : []),
    [visible, cues, minValue, maxValue, zoomedTimelineWidth]
  );

  // Culling is the separate, cheap pass — at 20x on a long demo this is the
  // difference between mounting eight blocks and mounting all 150.
  const visibleItems = React.useMemo(
    () => cullSubtitleTrackItems(items, scrollLeft, baseTimelineWidth),
    [items, scrollLeft, baseTimelineWidth]
  );

  const getOriginCues = React.useCallback(() => useSubtitleStore.getState().subtitleCues, []);
  const onDragMove = React.useCallback(
    (next: SubtitleCue[]) => dragCues(next, { durationSeconds: maxValue }),
    [dragCues, maxValue]
  );

  const { dragSubtitleState, setDragSubtitleState } = useSubtitleCueDrag({
    minValue,
    maxValue,
    zoomedTimelineWidth,
    playheadSeconds,
    getOriginCues,
    onDragStart: beginCueDrag,
    onDragMove,
    onDragEnd: endCueDrag,
  });

  const selectCueAt = React.useCallback(
    (index: number) => {
      selectCue(index);
      const cue = cues[index];
      if (cue) {
        onValueChange?.(cue.start);
      }
    },
    [cues, onValueChange, selectCue]
  );

  const clearSelection = React.useCallback(() => selectCue(null), [selectCue]);

  /** Scroll the track so `seconds` is centred, at whatever the zoom is now. */
  const scrollTo = React.useCallback(
    (seconds: number) => {
      const el = scrollContainerRef.current;
      if (!el) {
        return;
      }
      const target = scrollLeftForTime(seconds, {
        minValue,
        maxValue,
        zoomedTimelineWidth,
        viewportWidthPx: el.clientWidth,
      });
      el.scrollLeft = target;
      setScrollLeft(target);
    },
    [maxValue, minValue, scrollContainerRef, setScrollLeft, zoomedTimelineWidth]
  );

  // A zoom change only reaches the DOM on the next render, so a focus that needs
  // one is parked here and applied by the effect below once the track has its
  // new width.
  const pendingFocusRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const seconds = pendingFocusRef.current;
    if (seconds === null) {
      return;
    }
    pendingFocusRef.current = null;
    scrollTo(seconds);
  }, [zoomedTimelineWidth, scrollTo]);

  const focusCluster = React.useCallback(
    (cluster: SubtitleClusterItem) => {
      selectCue(cluster.fromIndex);
      const centre = (cluster.startSeconds + cluster.endSeconds) / 2;
      const zoom = zoomLevelForCluster(cues, cluster, {
        minValue,
        maxValue,
        baseTimelineWidth,
      });

      if (zoom > zoomLevel + 1e-3) {
        pendingFocusRef.current = centre;
        setZoomLevel(zoom);
        return;
      }
      // Already zoomed in far enough (or at the ceiling): just go there.
      scrollTo(centre);
    },
    [baseTimelineWidth, cues, maxValue, minValue, scrollTo, selectCue, setZoomLevel, zoomLevel]
  );

  // Selecting a cue in the sidebar list brings its block into view here, mirror-
  // ing the list scrolling to a block selected on the track. Held in a ref and
  // fired off the focus nonce alone, so editing a cue's text does not yank the
  // timeline around, and re-selecting the same cue still works.
  const revealSelectedRef = React.useRef<() => void>(() => {});
  revealSelectedRef.current = () => {
    const el = scrollContainerRef.current;
    const cue = selectedCueIndex === null ? undefined : cues[selectedCueIndex];
    if (!el || !cue) {
      return;
    }
    const pps = pixelsPerSecond({ minValue, maxValue, zoomedTimelineWidth });
    if (pps <= 0) {
      return;
    }
    const left = (cue.start - minValue) * pps;
    const right = (cue.end - minValue) * pps;
    if (right >= el.scrollLeft && left <= el.scrollLeft + el.clientWidth) {
      return; // Already on screen — do not fight the user's own scrolling.
    }
    scrollTo((cue.start + cue.end) / 2);
  };

  React.useEffect(() => {
    revealSelectedRef.current();
  }, [cueFocusNonce]);

  return {
    visible,
    items: visibleItems,
    cueCount: cues.length,
    selectedCueIndex,
    draggingIndex: dragSubtitleState?.index ?? null,
    setDragSubtitleState,
    selectCueAt,
    clearSelection,
    focusCluster,
  };
}
