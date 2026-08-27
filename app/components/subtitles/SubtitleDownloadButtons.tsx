"use client";

import React from "react";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import {
  SUBTITLE_FORMATS,
  SUBTITLE_FORMAT_MIME,
  isSubtitleEditorEnabled,
  normalizeCues,
  serializeCues,
  subtitleFileName,
} from "@/app/lib/subtitles";
import type { SubtitleFormat } from "@/app/lib/subtitles";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useSubtitleStore } from "@/app/store/editor/subtitleStore";

export interface SubtitleDownloadButtonsProps {
  /** Extra classes for the button row — spacing from the host, not chrome. */
  className?: string;
}

export interface SubtitleDownloadCardProps {
  /** Host-modal card styling: radius and border, so this matches its surroundings. */
  className?: string;
}

/** What each button says. */
const FORMAT_LABEL: Record<SubtitleFormat, string> = {
  srt: ".SRT",
  vtt: ".VTT",
  txt: ".TXT",
};

/** Why someone would pick that one, on hover. */
const FORMAT_TITLE: Record<SubtitleFormat, string> = {
  srt: "SubRip — the format YouTube, Vimeo and most players accept",
  vtt: "WebVTT — for HTML5 <track> captions on the web",
  txt: "Plain-text transcript, no timings",
};

/**
 * Download the active subtitle track as .srt / .vtt / .txt (PRD §6.8 / US-5).
 *
 * Rendered in two places: the subtitle sidebar panel, and ExportResultModal —
 * the post-export moment, next to the share QR, which is when someone actually
 * wants the caption file to upload alongside the MP4.
 *
 * THE FILE IS BUILT IN THE BROWSER, not fetched from /api/subtitles/export.
 * Both produce the same bytes — they call the same serializer — but the store
 * holds the cue list the user is looking at, including the edit they made three
 * seconds ago that autosave has not flushed yet. Downloading a track with a typo
 * the user already fixed is the one failure mode this feature cannot have. It
 * also means an unsaved or anonymous demo can still get its subtitles out. The
 * route stays the surface for everything outside the editor, and resolves the
 * same cues server-side.
 *
 * Gated by NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED, like the rest of the panel, so
 * an environment that has not opted in sees no new buttons anywhere.
 */
export default function SubtitleDownloadButtons({ className = "" }: SubtitleDownloadButtonsProps) {
  // Guarded before anything else, so with the flag off there is no store
  // subscription and no empty row left behind.
  if (!isSubtitleEditorEnabled()) {
    return null;
  }
  return <DownloadRow className={className} />;
}

/**
 * The same buttons in a card, for ExportResultModal. Renders nothing when the
 * demo has no subtitles — the panel shows the row disabled (it is where
 * downloads live, and the user is about to generate some), but an empty card
 * next to the share QR would just be a dead box.
 *
 * Borders and radius come from the host via `className`, exactly like
 * ShareQrCode, so this cannot drift away from the modal it sits in.
 */
export function SubtitleDownloadCard({ className = "" }: SubtitleDownloadCardProps) {
  if (!isSubtitleEditorEnabled()) {
    return null;
  }
  return <DownloadCard className={className} />;
}

function DownloadCard({ className }: { className: string }) {
  const cueCount = useSubtitleStore((s) => s.subtitleCues.length);
  if (cueCount === 0) {
    return null;
  }

  return (
    <div className={`border bg-white p-4 ${className}`}>
      <p className="text-sm font-semibold text-[#2D1F61]">Subtitle files</p>
      <p className="mt-1 text-xs leading-relaxed text-[#8C82B4]">
        {cueCount} subtitle{cueCount === 1 ? "" : "s"} — download them to upload alongside the MP4,
        or to keep the transcript.
      </p>
      <DownloadRow className="mt-3" />
    </div>
  );
}

function DownloadRow({ className }: { className: string }) {
  const { subtitleCues, subtitleLanguage } = useSubtitleStore(
    useShallow((s) => ({
      subtitleCues: s.subtitleCues,
      subtitleLanguage: s.subtitleLanguage,
    }))
  );
  const sidebarTitle = useEditorStore((s) => s.sidebarTitle);

  const handleDownload = React.useCallback(
    (format: SubtitleFormat) => {
      // Sorted and non-overlapping before serializing: a player fed two
      // overlapping cues draws them on top of each other, and the burn-in this
      // file is meant to match was normalized too.
      const cues = normalizeCues(subtitleCues);
      if (cues.length === 0) {
        toast.error("There are no subtitles to download yet");
        return;
      }

      const filename = subtitleFileName(sidebarTitle, subtitleLanguage, format);
      const blob = new Blob([serializeCues(cues, format)], {
        type: `${SUBTITLE_FORMAT_MIME[format]};charset=utf-8`,
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoke on the next tick — Safari needs the object URL to outlive the
      // click (same reason as app/components/qr/useShareQr.ts).
      window.setTimeout(() => URL.revokeObjectURL(href), 0);

      toast.success(`Downloaded ${filename}`);
    },
    [subtitleCues, subtitleLanguage, sidebarTitle]
  );

  const disabled = subtitleCues.length === 0;

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {SUBTITLE_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          onClick={() => handleDownload(format)}
          disabled={disabled}
          title={disabled ? "Generate subtitles first" : FORMAT_TITLE[format]}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DAFB] bg-[#F6F3FF] px-2 py-2 text-xs font-semibold text-[#7C5CFC] transition hover:bg-[#EAE5FB] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          {FORMAT_LABEL[format]}
        </button>
      ))}
    </div>
  );
}
