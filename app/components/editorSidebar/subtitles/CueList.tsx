import React from "react";

import type { SubtitleEditing } from "./useSubtitleEditing";
import CueRow from "./CueRow";

type CueListProps = Pick<
  SubtitleEditing,
  | "cues"
  | "activeCue"
  | "selectedIndex"
  | "focusNonce"
  | "canSplit"
  | "handleSeek"
  | "handleSelect"
  | "handleTextChange"
  | "handleTimingChange"
  | "handleSplit"
  | "handleMerge"
  | "handleDelete"
>;

/**
 * The scrollable cue list. Presentational: it decides only which row is
 * highlighted and which per-row actions are available.
 *
 * Two different highlights, deliberately: `activeCue` is whichever cue is on
 * screen at the playhead and moves on its own during playback, while
 * `selectedIndex` is the cue the user picked — here or on the timeline track —
 * and stays put until they pick another.
 *
 * Rows are keyed by index rather than by timing. A cue has no id, and keying by
 * its start time would remount the row on every timing edit — throwing away the
 * focus and the draft of the field being typed into. `CueRow` re-syncs its
 * drafts from props instead.
 */
const CueList: React.FC<CueListProps> = ({
  cues,
  activeCue,
  selectedIndex,
  focusNonce,
  canSplit,
  handleSeek,
  handleSelect,
  handleTextChange,
  handleTimingChange,
  handleSplit,
  handleMerge,
  handleDelete,
}) => {
  if (cues.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#ede7fa] px-3 py-6 text-center text-[11px] text-[#6B6B6B] dark:text-inherit">
        No subtitles yet. Generate them from the video&rsquo;s audio, or add a cue at the playhead.
      </p>
    );
  }

  return (
    <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
      {cues.map((cue, index) => (
        <CueRow
          key={index}
          cue={cue}
          index={index}
          // Identity, not a re-derived time comparison: `activeCue` is an
          // element of this very array (see findActiveCue).
          isActive={cue === activeCue}
          isSelected={index === selectedIndex}
          // Changes on every selection, so re-picking the same block on the
          // timeline scrolls this row back into view.
          focusNonce={focusNonce}
          canSplit={canSplit(index)}
          canMerge={index < cues.length - 1}
          onSeek={handleSeek}
          onSelect={handleSelect}
          onTextChange={handleTextChange}
          onTimingChange={handleTimingChange}
          onSplit={handleSplit}
          onMerge={handleMerge}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default CueList;
