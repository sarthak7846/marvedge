import React from "react";
import { ChevronsDownUp, Play, Scissors, Trash2 } from "lucide-react";

import type { SubtitleCue } from "@/app/(signed)/editor/types";
import { formatSpan, formatTimecode, parseTimecode } from "./timecode";

interface CueRowProps {
  cue: SubtitleCue;
  index: number;
  /** This cue is on screen at the playhead. */
  isActive: boolean;
  /** The user picked this cue — here, or on the timeline's subtitle track. */
  isSelected: boolean;
  /** Bumped on every selection; a selected row scrolls itself into view on it. */
  focusNonce: number;
  canSplit: boolean;
  canMerge: boolean;
  onSeek: (seconds: number) => void;
  onSelect: (index: number) => void;
  onTextChange: (index: number, text: string) => void;
  onTimingChange: (index: number, timing: { start?: number; end?: number }) => void;
  onSplit: (index: number) => void;
  onMerge: (index: number) => void;
  onDelete: (index: number) => void;
}

const ACTION_BUTTON =
  "rounded-md p-1 text-[#7C5CFC] transition hover:bg-[#F6F3FF] disabled:cursor-not-allowed disabled:opacity-35";

const TIME_INPUT =
  "w-[68px] rounded-md border border-[#ede7fa] bg-white px-1.5 py-1 text-center font-mono text-[11px] text-[#2D1F61] focus:border-[#A594F9] focus:outline-none";

/**
 * One `m:ss.cs` field. Both timings behave identically — commit on blur, Enter
 * to commit, Escape to put the cue's own value back — so they are one component.
 */
const TimecodeInput: React.FC<{
  label: string;
  draft: string;
  setDraft: (value: string) => void;
  /** Restore the field from the cue, discarding the draft. */
  revert: () => void;
  commit: () => void;
}> = ({ label, draft, setDraft, revert, commit }) => (
  <input
    value={draft}
    onChange={(e) => setDraft(e.target.value)}
    onBlur={commit}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
      if (e.key === "Escape") {
        revert();
        e.currentTarget.blur();
      }
    }}
    aria-label={label}
    className={TIME_INPUT}
  />
);

/**
 * One editable subtitle in the panel's list: text, both timings, and the split /
 * merge / delete actions.
 *
 * Presentational — every action is handed up to `useSubtitleEditing`.
 *
 * Fields are drafted locally and committed on blur (Escape reverts) rather than
 * on every keystroke. Two reasons: a mutation runs `normalizeCues`, which sorts
 * the list, and re-sorting under a cursor mid-keystroke would move the row the
 * user is typing in; and a half-typed timecode (`"1:"`) is not a number yet.
 */
const CueRow: React.FC<CueRowProps> = ({
  cue,
  index,
  isActive,
  isSelected,
  focusNonce,
  canSplit,
  canMerge,
  onSeek,
  onSelect,
  onTextChange,
  onTimingChange,
  onSplit,
  onMerge,
  onDelete,
}) => {
  const [textDraft, setTextDraft] = React.useState(cue.text);
  const [startDraft, setStartDraft] = React.useState(() => formatTimecode(cue.start));
  const [endDraft, setEndDraft] = React.useState(() => formatTimecode(cue.end));

  // Selecting a block on the timeline track scrolls the matching row into view
  // here. `block: "nearest"` so a row that is already visible does not move, and
  // so the surrounding page is not dragged along with the list.
  const rowRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isSelected) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected, focusNonce]);

  // Follow the cue when it changes underneath us — an undo, a split, or a
  // neighbour's edit truncating this one through the overlap rule.
  React.useEffect(() => setTextDraft(cue.text), [cue.text]);
  React.useEffect(() => setStartDraft(formatTimecode(cue.start)), [cue.start]);
  React.useEffect(() => setEndDraft(formatTimecode(cue.end)), [cue.end]);

  const commitText = () => {
    const next = textDraft.trim();
    if (!next) {
      setTextDraft(cue.text); // Blank is an unfinished edit, not a delete.
      return;
    }
    onTextChange(index, next);
  };

  const commitTiming = (edge: "start" | "end") => {
    const draft = edge === "start" ? startDraft : endDraft;
    const seconds = parseTimecode(draft);
    if (seconds === null) {
      setStartDraft(formatTimecode(cue.start));
      setEndDraft(formatTimecode(cue.end));
      return;
    }
    onTimingChange(index, { [edge]: seconds });
  };

  // Clicking the row selects and seeks, but not when the click was aimed at
  // something interactive inside it.
  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, textarea, button")) {
      return;
    }
    onSelect(index);
    onSeek(cue.start);
  };

  return (
    <div
      ref={rowRef}
      onClick={handleRowClick}
      // Selection is a ring, the playhead's cue is a fill: the two are
      // independent and often land on different rows during playback.
      className={`cue-row rounded-lg border px-2 py-2 transition ${
        isSelected ? "ring-2 ring-[#8A76FC] ring-offset-1" : ""
      } ${
        isActive ? "border-[#A594F9] bg-[#F6F3FF]" : "border-[#ede7fa] bg-white hover:bg-[#FBFAFF]"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onSeek(cue.start)}
          title="Jump to this subtitle"
          className="flex items-center gap-1 rounded-md px-1 py-0.5 font-mono text-[11px] font-semibold text-[#7C5CFC] transition hover:bg-[#F6F3FF]"
        >
          <Play size={10} fill="currentColor" />
          {formatTimecode(cue.start)}
        </button>

        <div className="flex items-center gap-0.5">
          <span className="mr-1 font-mono text-[10px] text-[#9A8FC0]">
            {formatSpan(cue.end - cue.start)}
          </span>
          <button
            type="button"
            onClick={() => onSplit(index)}
            disabled={!canSplit}
            title="Split at the playhead"
            aria-label="Split at the playhead"
            className={ACTION_BUTTON}
          >
            <Scissors size={13} />
          </button>
          <button
            type="button"
            onClick={() => onMerge(index)}
            disabled={!canMerge}
            title="Merge with the next subtitle"
            aria-label="Merge with the next subtitle"
            className={ACTION_BUTTON}
          >
            <ChevronsDownUp size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(index)}
            title="Delete this subtitle"
            aria-label="Delete this subtitle"
            className={`${ACTION_BUTTON} hover:text-[#D94A4A]`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <textarea
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setTextDraft(cue.text);
            e.currentTarget.blur();
          }
        }}
        rows={2}
        aria-label={`Subtitle text at ${formatTimecode(cue.start)}`}
        className="mt-1.5 w-full resize-none rounded-md border border-[#ede7fa] bg-white px-2 py-1 text-xs text-[#2D1F61] focus:border-[#A594F9] focus:outline-none"
      />

      <div className="mt-1.5 flex items-center gap-1.5">
        <TimecodeInput
          label="Start time"
          draft={startDraft}
          setDraft={setStartDraft}
          revert={() => setStartDraft(formatTimecode(cue.start))}
          commit={() => commitTiming("start")}
        />
        <span className="text-[11px] text-[#9A8FC0]">→</span>
        <TimecodeInput
          label="End time"
          draft={endDraft}
          setDraft={setEndDraft}
          revert={() => setEndDraft(formatTimecode(cue.end))}
          commit={() => commitTiming("end")}
        />
      </div>
    </div>
  );
};

export default CueRow;
