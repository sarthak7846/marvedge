"use client";

import React, { useEffect, useRef } from "react";
import { Loader2, Music } from "lucide-react";
import { useAudioClipStore } from "@/app/store/audioClipStore";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { isProcessingStatus } from "@/app/lib/audio/status";
import AudioUploader from "./AudioUploader";
import AudioClipCard from "./AudioClipCard";

const POLL_INTERVAL_MS = 2500;

const AudioPanel: React.FC = () => {
  const savedDemoId = useEditorStore((s) => s.savedDemoId);
  const clips = useAudioClipStore((s) => s.clips);
  const loading = useAudioClipStore((s) => s.loading);
  const error = useAudioClipStore((s) => s.error);
  const fetchClips = useAudioClipStore((s) => s.fetchClips);
  const renameClip = useAudioClipStore((s) => s.renameClip);
  const reorderClip = useAudioClipStore((s) => s.reorderClip);
  const deleteClip = useAudioClipStore((s) => s.deleteClip);
  const requestTrim = useAudioClipStore((s) => s.requestTrim);

  const demoIdRef = useRef<string | null>(savedDemoId);
  demoIdRef.current = savedDemoId;

  useEffect(() => {
    if (!savedDemoId) {
      return;
    }
    void fetchClips(savedDemoId);
  }, [savedDemoId, fetchClips]);

  // Poll while any clip is still being processed in the background.
  useEffect(() => {
    if (!savedDemoId) {
      return;
    }
    const hasProcessing = () => clips.some((c) => isProcessingStatus(c.status));
    const interval = setInterval(() => {
      if (hasProcessing() && demoIdRef.current) {
        void fetchClips(demoIdRef.current);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clips, fetchClips, savedDemoId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">Audio clips</h2>
        {savedDemoId ? (
          <AudioUploader demoId={savedDemoId} />
        ) : (
          <p className="text-sm text-gray-400">Save the demo first to upload audio.</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#6B6B6B] mb-2">Your clips</h3>
        {loading && clips.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            Loading clips…
          </div>
        ) : clips.length === 0 ? (
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
  );
};

export default AudioPanel;
