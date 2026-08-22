import React from "react";
import { useShallow } from "zustand/react/shallow";

import { MIN_CUE_SECONDS, findActiveCue } from "@/app/lib/subtitles";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";
import type { SubtitleCue } from "@/app/(signed)/editor/types";

interface UseSubtitleEditingProps {
  /** Move the player (and the playhead) to `seconds`. */
  onSeek?: (seconds: number) => void;
}

export interface SubtitleEditing {
  cues: SubtitleCue[];
  currentTime: number;
  duration: number;
  /** The cue on screen right now, by identity into `cues`. `null` in a gap. */
  activeCue: SubtitleCue | null;
  canUndo: boolean;
  /** Whether the playhead currently sits in a gap wide enough for a new cue. */
  canAddCue: boolean;
  /** Whether the playhead is far enough inside cue `index` to split it. */
  canSplit: (index: number) => boolean;
  handleSeek: (seconds: number) => void;
  handleTextChange: (index: number, text: string) => void;
  handleTimingChange: (index: number, timing: { start?: number; end?: number }) => void;
  handleSplit: (index: number) => void;
  handleMerge: (index: number) => void;
  handleDelete: (index: number) => void;
  handleAddCue: () => void;
  handleUndo: () => void;
}

/**
 * Owns the subtitle panel's behaviour: reads the live cue list and playhead,
 * and binds every mutation to the video's duration so the store can clamp cues
 * into the timeline.
 *
 * The arithmetic is all in app/lib/subtitles and the mutations are all in
 * `subtitleStore`; this hook is the wiring between them and the player. It adds
 * no cue maths of its own beyond the "is this action available right now?"
 * predicates that grey the buttons out — and those mirror the same guards the
 * store enforces, so a stale render can never commit an invalid edit.
 */
export function useSubtitleEditing({ onSeek }: UseSubtitleEditingProps = {}): SubtitleEditing {
  const { currentTime, duration, setCurrentTime } = useEditorStore(
    useShallow((s) => ({
      currentTime: s.currentTime,
      duration: s.duration,
      setCurrentTime: s.setCurrentTime,
    }))
  );

  const {
    cues,
    undoDepth,
    setCueText,
    setCueTiming,
    splitCue,
    mergeCueWithNext,
    removeCue,
    addCue,
    undoCueEdit,
  } = useSubtitleStore(
    useShallow((s) => ({
      cues: s.subtitleCues,
      undoDepth: s.subtitleUndoStack.length,
      setCueText: s.setCueText,
      setCueTiming: s.setCueTiming,
      splitCue: s.splitCue,
      mergeCueWithNext: s.mergeCueWithNext,
      removeCue: s.removeCue,
      addCue: s.addCue,
      undoCueEdit: s.undoCueEdit,
    }))
  );

  // Every mutation is clamped against the same timeline the export uses.
  const options = React.useMemo(() => ({ durationSeconds: duration }), [duration]);

  // The same binary search the preview overlay runs, so the highlighted row and
  // the text on the video can never disagree about which cue is on screen.
  const activeCue = React.useMemo(() => findActiveCue(cues, currentTime), [cues, currentTime]);

  const handleSeek = React.useCallback(
    (seconds: number) => {
      const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
      setCurrentTime(target);
      onSeek?.(target);
    },
    [duration, onSeek, setCurrentTime]
  );

  const canSplit = React.useCallback(
    (index: number) => {
      const cue = cues[index];
      return (
        !!cue &&
        currentTime - cue.start >= MIN_CUE_SECONDS &&
        cue.end - currentTime >= MIN_CUE_SECONDS
      );
    },
    [cues, currentTime]
  );

  // A new cue needs a free instant and room to live in: no cue covering the
  // playhead, and `MIN_CUE_SECONDS` before whatever comes next.
  const canAddCue = React.useMemo(() => {
    if (!Number.isFinite(currentTime) || currentTime < 0 || activeCue) {
      return false;
    }
    const nextStart = cues.find((c) => c.start > currentTime)?.start;
    const ceiling = Math.min(
      nextStart ?? Number.POSITIVE_INFINITY,
      duration > 0 ? duration : Number.POSITIVE_INFINITY
    );
    return ceiling - currentTime >= MIN_CUE_SECONDS;
  }, [activeCue, cues, currentTime, duration]);

  const handleTextChange = React.useCallback(
    (index: number, text: string) => setCueText(index, text, options),
    [setCueText, options]
  );

  const handleTimingChange = React.useCallback(
    (index: number, timing: { start?: number; end?: number }) =>
      setCueTiming(index, timing, options),
    [setCueTiming, options]
  );

  const handleSplit = React.useCallback(
    (index: number) => splitCue(index, currentTime, options),
    [splitCue, currentTime, options]
  );

  const handleMerge = React.useCallback(
    (index: number) => mergeCueWithNext(index, options),
    [mergeCueWithNext, options]
  );

  const handleDelete = React.useCallback(
    (index: number) => removeCue(index, options),
    [removeCue, options]
  );

  const handleAddCue = React.useCallback(
    () => addCue(currentTime, options),
    [addCue, currentTime, options]
  );

  return {
    cues,
    currentTime,
    duration,
    activeCue,
    canUndo: undoDepth > 0,
    canAddCue,
    canSplit,
    handleSeek,
    handleTextChange,
    handleTimingChange,
    handleSplit,
    handleMerge,
    handleDelete,
    handleAddCue,
    handleUndo: undoCueEdit,
  };
}
