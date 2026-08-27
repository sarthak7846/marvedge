"use client";

import React, { useRef, useState } from "react";
import { Loader2, Music, Upload, X } from "lucide-react";
import { useAudioClipStore } from "@/app/store/audioClipStore";

const ACCEPTED = ".mp3,.wav,.m4a,.ogg";

interface AudioUploaderProps {
  demoId: string;
}

const AudioUploader: React.FC<AudioUploaderProps> = ({ demoId }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const uploads = useAudioClipStore((s) => s.uploads);
  const uploadFile = useAudioClipStore((s) => s.uploadFile);
  const cancelUpload = useAudioClipStore((s) => s.cancelUpload);

  const handleFiles = (files: FileList | null) => {
    if (!files) {
      return;
    }
    for (const file of Array.from(files)) {
      void uploadFile(demoId, file);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const activeCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "confirming"
  ).length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
          dragging
            ? "border-[#A594F9] bg-[#F6F3FF]"
            : "border-[#E5DFF7] bg-white hover:border-[#A594F9]"
        }`}
      >
        <Upload size={20} className="text-[#A594F9]" />
        <p className="text-sm font-medium text-[#7C5CFC]">Drop audio files here</p>
        <p className="text-xs text-gray-400">
          or click to browse — MP3, WAV, M4A or OGG (max 50MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className="rounded-lg border border-[#ede7fa] bg-[#F6F3FF] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Music size={14} className="shrink-0 text-[#A594F9]" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#7C5CFC]">
                  {upload.fileName}
                </span>
                {upload.status === "uploading" || upload.status === "confirming" ? (
                  <button
                    type="button"
                    aria-label={`Cancel upload of ${upload.fileName}`}
                    onClick={() => cancelUpload(upload.id)}
                    className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-[#EDE7FA] hover:text-red-600 transition"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              {upload.status === "error" ? (
                <p className="mt-1 text-xs text-red-600">{upload.error ?? "Upload failed"}</p>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E5DFF7]">
                    <div
                      className="h-full rounded-full bg-[#8A76FC] transition-all"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-500">
                    {upload.status === "confirming" ? (
                      <Loader2 size={12} className="animate-spin text-[#8A76FC]" />
                    ) : (
                      `${upload.progress}%`
                    )}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {activeCount > 0 ? (
        <p className="text-xs text-gray-400">
          {activeCount} upload{activeCount === 1 ? "" : "s"} in progress…
        </p>
      ) : null}
    </div>
  );
};

export default AudioUploader;
