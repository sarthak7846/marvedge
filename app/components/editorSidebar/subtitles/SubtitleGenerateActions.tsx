import React from "react";

export interface SubtitleGenerateActionsProps {
  onAddSubtitles?: () => void;
  onClearSubtitles?: () => void;
  subtitlesLoading: boolean;
  hasSubtitles: boolean;
  /**
   * Stop waiting on the running job (PRD §13). Optional: with no handler the
   * Cancel button does not render, so a caller that has not adopted it sees the
   * panel exactly as it was.
   */
  onCancelSubtitles?: () => void;
  /** True while the cancel request itself is in flight. */
  cancelling?: boolean;
}

/**
 * "Add Subtitles" / "Regenerate Subtitles" / "Skip Subtitles".
 *
 * Lifted out of ToolsPanel unchanged (same markup, same handlers) so exactly one
 * copy of these buttons exists. The subtitle panel renders it at the top of the
 * tab; with NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED off that tab does not exist, and
 * EditorSidebar renders this in the Tools tab instead — generation stays exactly
 * where it is today for anyone who has not turned the editor on.
 *
 * The generation itself still lives in `useSubtitles` (it needs the editor's
 * video URL and demo id) and arrives here as props, so this stays presentational
 * and there is no second copy of the generate-and-poll flow.
 */
const SubtitleGenerateActions: React.FC<SubtitleGenerateActionsProps> = ({
  onAddSubtitles,
  onClearSubtitles,
  subtitlesLoading,
  hasSubtitles,
  onCancelSubtitles,
  cancelling = false,
}) => {
  return (
    <div>
      <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">Subtitles</h2>
      <button
        type="button"
        disabled={subtitlesLoading}
        onClick={() => onAddSubtitles && onAddSubtitles()}
        className="w-full rounded-lg bg-[#8A76FC] text-white py-2 text-sm font-semibold hover:bg-[#7C5CFC] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {subtitlesLoading
          ? "Generating..."
          : hasSubtitles
            ? "Regenerate Subtitles"
            : "Add Subtitles"}
      </button>

      {/* Cancel (PR 7 / PRD §13). Only while a job is actually running — there
          is nothing to cancel otherwise. The copy is deliberately literal: the
          Cloud Run call cannot be aborted, so what the user gets back is the
          editor, and the transcript is discarded rather than stopped. Saying
          "stop generating" here would promise something this cannot do. */}
      {subtitlesLoading && onCancelSubtitles && (
        <>
          <button
            type="button"
            disabled={cancelling}
            onClick={() => onCancelSubtitles()}
            className="w-full mt-2 rounded-lg border border-[#8A76FC] text-[#8A76FC] py-2 text-sm font-semibold hover:bg-[#F6F3FF] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelling ? "Cancelling..." : "Cancel"}
          </button>
          <p className="mt-2 text-[11px] text-[#6B6B6B] dark:text-inherit">
            Cancelling frees up the editor right away. Transcription that has already started
            finishes on the server and its result is discarded.
          </p>
        </>
      )}

      {hasSubtitles && !subtitlesLoading && (
        <button
          type="button"
          onClick={() => onClearSubtitles && onClearSubtitles()}
          className="btn-subtitles-block w-full mt-2 rounded-lg border border-[#8A76FC] text-[#8A76FC] py-2 text-sm font-semibold hover:bg-[#F6F3FF] transition"
        >
          Skip Subtitles
        </button>
      )}
    </div>
  );
};

export default SubtitleGenerateActions;
