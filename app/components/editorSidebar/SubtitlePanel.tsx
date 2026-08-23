import React from "react";
import { Plus, Undo2 } from "lucide-react";

import CueList from "./subtitles/CueList";
import SubtitleGenerateActions from "./subtitles/SubtitleGenerateActions";
import type { SubtitleGenerateActionsProps } from "./subtitles/SubtitleGenerateActions";
import { useSubtitleEditing } from "./subtitles/useSubtitleEditing";
import { formatTimecode } from "./subtitles/timecode";

interface SubtitlePanelProps extends SubtitleGenerateActionsProps {
  /** Move the player to `seconds`. Supplied by the editor, which owns the ref. */
  onSeek?: (seconds: number) => void;
}

/**
 * Subtitle sidebar panel (SUB-6.3 / US-2).
 *
 * PR 2 makes generated subtitles editable — the single largest gap in the PRD,
 * since nothing about a transcript could be corrected before this. The cue list
 * below is the fine-grained tool: fix a mis-transcribed word, retime a cue to
 * the centisecond, split a long one at the playhead, merge two short ones, drop
 * or add one.
 *
 * PR 3 adds the coarse tool next to it: a subtitle track on the timeline ruler,
 * where a cue is dragged and resized like a trim segment. Selection is shared
 * both ways — picking a block there scrolls this list to the matching row and
 * highlights it, and picking a row here highlights the block.
 *
 * PR 4 adds styling (font, size, colour, outline, position), shared by the live
 * preview overlay and the burned-in export through one style module.
 *
 * PR 5 adds languages: pick the spoken language before generating, and translate
 * a finished track into another one (PRO/ENTERPRISE, gated server-side).
 *
 * PR 6 adds file export — .srt / .vtt / .txt — plus importing an existing
 * subtitle file.
 *
 * Edits persist through the existing autosave, which already serializes the
 * subtitle store's cues into `Demo.editing.subtitles`; there is no save button
 * and no new persistence path here.
 *
 * The whole panel is gated behind NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED by its
 * parents (EditorSidebar / SidebarHeader), so nothing here renders when the flag
 * is off.
 */
const SubtitlePanel: React.FC<SubtitlePanelProps> = ({
  onAddSubtitles,
  onClearSubtitles,
  subtitlesLoading,
  hasSubtitles,
  onSeek,
}) => {
  const editing = useSubtitleEditing({ onSeek });

  return (
    <div className="space-y-6">
      <SubtitleGenerateActions
        onAddSubtitles={onAddSubtitles}
        onClearSubtitles={onClearSubtitles}
        subtitlesLoading={subtitlesLoading}
        hasSubtitles={hasSubtitles}
      />

      <div className="border-t border-[#ede7fa] pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="control-block-label text-sm font-bold text-[#A594F9]">Edit subtitles</h3>
          <button
            type="button"
            onClick={editing.handleUndo}
            disabled={!editing.canUndo}
            title="Undo the last subtitle edit"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[#7C5CFC] transition hover:bg-[#F6F3FF] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Undo2 size={12} />
            Undo
          </button>
        </div>

        <CueList
          cues={editing.cues}
          activeCue={editing.activeCue}
          selectedIndex={editing.selectedIndex}
          focusNonce={editing.focusNonce}
          canSplit={editing.canSplit}
          handleSeek={editing.handleSeek}
          handleSelect={editing.handleSelect}
          handleTextChange={editing.handleTextChange}
          handleTimingChange={editing.handleTimingChange}
          handleSplit={editing.handleSplit}
          handleMerge={editing.handleMerge}
          handleDelete={editing.handleDelete}
        />

        <button
          type="button"
          onClick={editing.handleAddCue}
          disabled={!editing.canAddCue}
          title={
            editing.canAddCue
              ? `Add a subtitle at ${formatTimecode(editing.currentTime)}`
              : "Move the playhead to a gap between subtitles"
          }
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#A594F9] px-3 py-2 text-xs font-semibold text-[#7C5CFC] transition hover:bg-[#F6F3FF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          Add cue at {formatTimecode(editing.currentTime)}
        </button>

        <p className="mt-3 text-[11px] text-[#6B6B6B] dark:text-inherit">
          {editing.cues.length} subtitle{editing.cues.length === 1 ? "" : "s"}
          {" · click one to jump to it · edits save automatically."}
        </p>
      </div>
    </div>
  );
};

export default SubtitlePanel;
