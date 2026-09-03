"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { HardDrive, Music, Upload, X, Trash2, Check } from "lucide-react";
import { useAudioClipStore } from "@/app/store/audioClipStore";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { isProcessingStatus } from "@/app/lib/audio/status";
import {
  saveLocalAudio,
  listLocalAudio,
  deleteLocalAudio,
  type LocalAudioFile,
} from "@/app/lib/audio/localAudioStorage";
import AudioUploader from "./AudioUploader";
import AudioClipCard from "./AudioClipCard";

const POLL_INTERVAL_MS = 2500;
type Tab = "device" | "local";

interface AudioUploadModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AudioUploadModal({ open, onClose }: AudioUploadModalProps) {
  const savedDemoId = useEditorStore((s) => s.savedDemoId);
  const setShowSaveDemoModal = useEditorStore((s) => s.setShowSaveDemoModal);
  const clips = useAudioClipStore((s) => s.clips);
  const error = useAudioClipStore((s) => s.error);
  const fetchClips = useAudioClipStore((s) => s.fetchClips);
  const uploadFile = useAudioClipStore((s) => s.uploadFile);
  const renameClip = useAudioClipStore((s) => s.renameClip);
  const reorderClip = useAudioClipStore((s) => s.reorderClip);
  const deleteClip = useAudioClipStore((s) => s.deleteClip);
  const requestTrim = useAudioClipStore((s) => s.requestTrim);

  const [tab, setTab] = useState<Tab>("device");
  const [localFiles, setLocalFiles] = useState<LocalAudioFile[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  const demoIdRef = useRef(savedDemoId);
  demoIdRef.current = savedDemoId;

  useEffect(() => {
    if (open && savedDemoId) {
      void fetchClips(savedDemoId);
    }
  }, [open, savedDemoId, fetchClips]);

  // Poll while any clip is being processed.
  useEffect(() => {
    if (!open || !savedDemoId) {
      return;
    }
    const hasProcessing = () => clips.some((c) => isProcessingStatus(c.status));
    const interval = setInterval(() => {
      if (hasProcessing() && demoIdRef.current) {
        void fetchClips(demoIdRef.current);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, clips, fetchClips, savedDemoId]);

  const refreshLocal = useCallback(async () => {
    setLocalLoading(true);
    try {
      setLocalFiles(await listLocalAudio());
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tab === "local") {
      void refreshLocal();
    }
  }, [open, tab, refreshLocal]);

  const handleSaveToFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    await saveLocalAudio(file);
    await refreshLocal();
    e.target.value = "";
  };

  const handleUploadLocal = async (file: LocalAudioFile) => {
    if (!demoIdRef.current) {
      return;
    }
    const blob = new File([file.blob], file.name, { type: file.mimeType });
    await uploadFile(demoIdRef.current, blob);
  };

  const handleDeleteLocal = async (id: string) => {
    await deleteLocalAudio(id);
    await refreshLocal();
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add audio"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-lg max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-[#E6E1FA] flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede7fa]">
          <div className="flex items-center gap-2">
            <Music size={18} className="text-[#A594F9]" />
            <h2 className="text-base font-bold text-[#7C5CFC]">Add audio</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:bg-[#EDE7FA] hover:text-[#7C5CFC] transition"
            aria-label="Close audio panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#ede7fa]">
          <button
            type="button"
            onClick={() => setTab("device")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition cursor-pointer ${
              tab === "device"
                ? "text-[#7C5CFC] border-b-2 border-[#7C5CFC]"
                : "text-gray-400 hover:text-[#7C5CFC]"
            }`}
          >
            <Upload size={16} />
            Upload from device
          </button>
          <button
            type="button"
            onClick={() => setTab("local")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition cursor-pointer ${
              tab === "local"
                ? "text-[#7C5CFC] border-b-2 border-[#7C5CFC]"
                : "text-gray-400 hover:text-[#7C5CFC]"
            }`}
          >
            <HardDrive size={16} />
            Local audio
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {tab === "device" ? (
            savedDemoId ? (
              <AudioUploader demoId={savedDemoId} />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[#E5DFF7] bg-[#F6F3FF] px-4 py-6 text-center">
                <p className="text-sm text-gray-500">
                  Save the demo first to attach audio clips to it.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setShowSaveDemoModal(true);
                  }}
                  className="px-4 py-2 bg-[#8A76FC] hover:bg-[#7C5CFC] text-white text-sm font-semibold rounded-lg shadow-sm transition cursor-pointer"
                >
                  Save demo
                </button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Audio files you save here are stored in your browser. Pick one to add to this demo.
              </p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E5DFF7] bg-white px-4 py-4 text-center transition hover:border-[#A594F9] hover:bg-[#F6F3FF]">
                <HardDrive size={18} className="text-[#A594F9]" />
                <span className="text-sm font-medium text-[#7C5CFC]">
                  Save audio to local storage
                </span>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg"
                  className="hidden"
                  onChange={handleSaveToFile}
                />
              </label>

              {localLoading ? (
                <p className="text-xs text-gray-400 text-center py-2">Loading…</p>
              ) : localFiles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">
                  No local audio files saved yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {localFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-3 rounded-lg border border-[#ede7fa] bg-[#F6F3FF] px-3 py-2.5"
                    >
                      <Music size={14} className="shrink-0 text-[#A594F9]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#7C5CFC]">{file.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUploadLocal(file)}
                        disabled={!savedDemoId}
                        title={savedDemoId ? "Add to demo" : "Save demo first"}
                        className="shrink-0 rounded-md bg-[#8A76FC] p-1.5 text-white hover:bg-[#7C5CFC] transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLocal(file.id)}
                        className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-[#6B6B6B] mb-2">Your clips</h3>
            {clips.length === 0 ? (
              <p className="text-sm text-gray-400">
                <Music size={14} className="mb-0.5 inline text-[#A594F9]" /> No audio clips yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {clips.map((clip, index) => (
                  <AudioClipCard
                    key={clip.id}
                    clip={clip}
                    index={index}
                    total={clips.length}
                    onRename={renameClip}
                    onReorder={reorderClip}
                    onDelete={deleteClip}
                    onTrim={requestTrim}
                  />
                ))}
              </ul>
            )}
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
