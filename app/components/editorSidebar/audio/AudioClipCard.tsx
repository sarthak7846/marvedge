"use client";

import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { AudioClipDto } from "@/app/types/audio";
import { formatDuration } from "./format";
import { useAudioWaveform } from "./useAudioWaveform";

const iconBtnClass =
  "p-1.5 rounded-md text-[#7C5CFC] hover:bg-[#EDE7FA] transition disabled:opacity-40 disabled:cursor-not-allowed";

const STATUS_LABEL: Record<AudioClipDto["status"], { label: string; className: string }> = {
  UPLOADING: { label: "Uploading", className: "bg-amber-100 text-amber-700" },
  PROCESSING: { label: "Processing", className: "bg-amber-100 text-amber-700" },
  TRIM_PROCESSING: { label: "Trimming", className: "bg-amber-100 text-amber-700" },
  READY: { label: "Ready", className: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-700" },
};

interface ClipMenuProps {
  renaming: boolean;
  confirmingDelete: boolean;
  onStartRename: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

const ClipMenu: React.FC<ClipMenuProps> = ({
  renaming,
  confirmingDelete,
  onStartRename,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}) => {
  if (renaming) {
    return null;
  }
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-[#ede7fa] pt-2">
      <button
        type="button"
        onClick={onStartRename}
        className="flex items-center gap-1 rounded-md border border-[#8A76FC] text-[#8A76FC] px-2 py-1 text-xs font-semibold hover:bg-[#EDE7FA] transition"
      >
        <Pencil size={12} />
        Rename
      </button>
      {confirmingDelete ? (
        <>
          <span className="text-xs text-gray-600">Delete this clip?</span>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-red-500 text-white px-2 py-1 text-xs font-semibold hover:bg-red-600 transition"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="rounded-md border border-gray-300 text-gray-600 px-2 py-1 text-xs font-semibold hover:bg-gray-100 transition"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onConfirmDelete}
          className="flex items-center gap-1 rounded-md border border-red-200 text-red-600 px-2 py-1 text-xs font-semibold hover:bg-red-50 transition"
        >
          <Trash2 size={12} />
          Delete
        </button>
      )}
    </div>
  );
};

interface TrimControlsProps {
  trimStart: string;
  trimEnd: string;
  durationSec: number | null;
  busy: boolean;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  onTrim: () => void;
}

const TrimControls: React.FC<TrimControlsProps> = ({
  trimStart,
  trimEnd,
  durationSec,
  busy,
  onChangeStart,
  onChangeEnd,
  onTrim,
}) => {
  return (
    <div className="mt-2 border-t border-[#ede7fa] pt-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.1"
              value={trimStart}
              onChange={(e) => onChangeStart(e.target.value)}
              aria-label="Trim start (seconds)"
              className="w-full rounded border border-[#ede7fa] bg-white px-2 py-1 text-xs text-[#7C5CFC] focus:outline-none focus:ring-2 focus:ring-[#A594F9]"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={trimEnd}
              onChange={(e) => onChangeEnd(e.target.value)}
              aria-label="Trim end (seconds)"
              className="w-full rounded border border-[#ede7fa] bg-white px-2 py-1 text-xs text-[#7C5CFC] focus:outline-none focus:ring-2 focus:ring-[#A594F9]"
            />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            seconds — original length {formatDuration(durationSec)}
          </p>
        </div>
        <button
          type="button"
          onClick={onTrim}
          disabled={busy}
          className="flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[#8A76FC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7C5CFC] transition disabled:opacity-60"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Trim
        </button>
      </div>
    </div>
  );
};

interface AudioClipCardProps {
  clip: AudioClipDto;
  index: number;
  total: number;
  onRename: (clipId: string, fileName: string) => Promise<void>;
  onReorder: (clipId: string, order: number) => Promise<void>;
  onDelete: (clipId: string) => Promise<void>;
  onTrim: (clipId: string, trimStartSec: number, trimEndSec: number) => Promise<void>;
}

const AudioClipCard: React.FC<AudioClipCardProps> = ({
  clip,
  index,
  total,
  onRename,
  onReorder,
  onDelete,
  onTrim,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(clip.fileName);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [trimStart, setTrimStart] = useState(clip.trimStartSec.toString());
  const [trimEnd, setTrimEnd] = useState(
    clip.trimEndSec?.toString() ?? (clip.durationSec ? clip.durationSec.toString() : "")
  );
  const [trimming, setTrimming] = useState(false);

  const status = STATUS_LABEL[clip.status];
  const canTrim = clip.status === "READY" || clip.status === "FAILED";
  const playableUrl = clip.status === "READY" ? (clip.trimmedUrl ?? clip.originalUrl) : null;
  const waveform = useAudioWaveform(playableUrl);

  const commitRename = async () => {
    const next = nameDraft.trim();
    if (!next || next === clip.fileName) {
      setRenaming(false);
      setMenuOpen(false);
      return;
    }
    try {
      await onRename(clip.id, next);
      setRenaming(false);
      setMenuOpen(false);
    } catch {
      setNameDraft(clip.fileName);
    }
  };

  const commitTrim = async () => {
    const start = Number(trimStart);
    const end = Number(trimEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return;
    }
    setTrimming(true);
    try {
      await onTrim(clip.id, start, end);
    } catch {
      // Store surfaces the error; keep the inputs so the user can retry.
    } finally {
      setTrimming(false);
    }
  };

  const handleMove = (direction: "up" | "down") => {
    const next = direction === "up" ? index - 1 : index + 1;
    void onReorder(clip.id, next);
  };

  return (
    <li className="rounded-lg border border-[#ede7fa] bg-[#F6F3FF] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[#7C5CFC]">
              {renaming ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void commitRename();
                    }
                    if (e.key === "Escape") {
                      setRenaming(false);
                    }
                  }}
                  onBlur={() => void commitRename()}
                  className="w-full border border-[#ede7fa] bg-white rounded px-2 py-1 text-sm text-[#7C5CFC] focus:outline-none focus:ring-2 focus:ring-[#A594F9]"
                />
              ) : (
                clip.fileName
              )}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            <span>{formatDuration(clip.durationSec)}</span>
            {clip.trimmedUrl ? (
              <span className="rounded bg-[#EDE7FA] px-1.5 py-0.5 text-[10px] text-[#7C5CFC]">
                trimmed
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative flex shrink-0 items-center">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => handleMove("up")}
            className={iconBtnClass}
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => handleMove("down")}
            className={iconBtnClass}
          >
            <ChevronDown size={15} />
          </button>
          <button
            type="button"
            aria-label="Clip actions"
            onClick={() => setMenuOpen((v) => !v)}
            className={iconBtnClass}
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>

      {waveform ? (
        <div className="mt-2 flex h-10 items-end gap-[2px]">
          {waveform.peaks.map((peak, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-[#A594F9]"
              style={{ height: `${Math.max(8, Math.min(100, peak * 100))}%` }}
            />
          ))}
        </div>
      ) : null}

      {clip.status === "FAILED" ? (
        <p className="mt-2 text-xs text-red-600">{clip.error ?? "Processing failed"}</p>
      ) : null}

      {menuOpen ? (
        <ClipMenu
          renaming={renaming}
          confirmingDelete={confirmDelete}
          onStartRename={() => {
            setConfirmDelete(false);
            setRenaming(true);
            setMenuOpen(false);
          }}
          onConfirmDelete={() => setConfirmDelete(true)}
          onCancelDelete={() => setConfirmDelete(false)}
          onDelete={() => void onDelete(clip.id)}
        />
      ) : null}

      {canTrim ? (
        <TrimControls
          trimStart={trimStart}
          trimEnd={trimEnd}
          durationSec={clip.durationSec}
          busy={trimming}
          onChangeStart={setTrimStart}
          onChangeEnd={setTrimEnd}
          onTrim={() => void commitTrim()}
        />
      ) : null}
    </li>
  );
};

export default AudioClipCard;
