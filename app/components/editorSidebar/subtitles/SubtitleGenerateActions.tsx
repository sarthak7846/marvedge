import React from "react";

export interface SubtitleGenerateActionsProps {
  onAddSubtitles?: () => void;
  onClearSubtitles?: () => void;
  subtitlesLoading: boolean;
  hasSubtitles: boolean;
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
      {hasSubtitles && (
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
