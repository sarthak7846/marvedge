"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ExportQualityFrameRate from "./ExportQualityFrameRate";
import ExportCompression from "./ExportCompression";

export interface ExportSettings {
  quality: "720p" | "1080p";
  fps: "24 FPS" | "30 FPS" | "60 FPS";
  compression: "Web" | "Medium" | "High" | "Ultra";
  // Speed is controlled from the main editor (not this modal).
  speed: "Default" | "0.75" | "1.25" | "1.5" | "1.75" | "2";
  // SUB PR 6: burn the subtitles into the picture (PRD §6.8 — "Or Burn into
  // Video"). Before this, burn-in simply happened whenever a demo had cues, with
  // no way to say no. DEFAULTS TO TRUE, and every reader treats an absent value
  // as true, so an export that does not touch this switch is the export that
  // shipped before it existed.
  burnSubtitles: boolean;
}

interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (settings: ExportSettings) => void;
  durationInSeconds: number; // to estimate file size
  /**
   * Whether the demo has subtitles at all. The burn-in switch is hidden without
   * them — a toggle for something that does not exist is noise, and hiding it
   * keeps this modal identical to today for every demo with no cues.
   */
  hasSubtitles?: boolean;
}

const EXEMPT_EMAILS = [
  "aryaanandpathak30@gmail.com",
  "sarthakbehera10@gmail.com",
  "ashishmishra19122000@gmail.com",
  "sandipsubham.32@gmail.com",
  "kanupriya2052017@gmail.com",
  "rathourrahul21@gmail.com",
  "ajitkumarshankhwar25@gmail.com",
  "somyanayak281@gmail.com",
  "manushichillar412@gmail.com",
];

// Basic heuristic for file size estimation based on duration and settings
function estimateFileSize(settings: ExportSettings, durationInSeconds: number) {
  let baseMultiplier = 1.0;
  if (settings.quality === "1080p") {
    baseMultiplier *= 1.5;
  }
  if (settings.fps === "24 FPS") {
    baseMultiplier *= 0.9;
  }
  if (settings.fps === "60 FPS") {
    baseMultiplier *= 1.2;
  }

  if (settings.compression === "Ultra") {
    baseMultiplier *= 2.5;
  } else if (settings.compression === "High") {
    baseMultiplier *= 1.8;
  } else if (settings.compression === "Medium") {
    baseMultiplier *= 1.3;
  }

  // Roughly 0.5MB per second at 720p 30fps Web compression as a total guess baseline
  let sizeInMb = durationInSeconds * 0.25 * baseMultiplier;

  if (sizeInMb < 1) {
    sizeInMb = 1;
  } // minimum

  return `${Math.round(sizeInMb)}MB`;
}

export default function ExportSettingsModal({
  isOpen,
  onClose,
  onConfirm,
  durationInSeconds,
  hasSubtitles = false,
}: ExportSettingsModalProps) {
  const defaultSettings: ExportSettings = useMemo(
    () => ({
      quality: "720p",
      fps: "24 FPS",
      compression: "Web",
      speed: "Default",
      burnSubtitles: true,
    }),
    []
  );

  const [settings, setSettings] = useState<ExportSettings>({
    ...defaultSettings,
  });

  const [estimatedSize, setEstimatedSize] = useState("1MB");

  const { data: session } = useSession();
  const router = useRouter();
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<string>("FREE");

  useEffect(() => {
    if (isOpen) {
      setSettings(defaultSettings);
      axios
        .get("/api/user/export-count")
        .then((res) => {
          if (res.data && typeof res.data.count === "number") {
            setExportCount(res.data.count);
          }
          if (res.data && res.data.plan) {
            setUserPlan(res.data.plan);
          }
        })
        .catch((err) => console.error("Could not fetch export count", err));
    }
  }, [isOpen, defaultSettings]);

  const isExempt =
    (session?.user?.email && EXEMPT_EMAILS.includes(session.user.email)) ||
    userPlan === "PRO" ||
    userPlan === "ENTERPRISE";
  const limitReached = !isExempt && exportCount !== null && exportCount >= 3;

  useEffect(() => {
    setEstimatedSize(estimateFileSize(settings, durationInSeconds));
  }, [settings, durationInSeconds]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 backdrop-blur-md bg-white/30" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-[440px] bg-[#F8F8FC] rounded-2xl p-6 shadow-[0_8px_32px_rgba(124,92,252,0.15)] border border-white">
        <h2 className="text-center text-2xl font-semibold text-[#8A76FC] mb-4">Export Settings</h2>

        <div className="flex items-center justify-center gap-2 mb-6 text-[#8A76FC]">
          <span className="text-[15px]">Estimated output file size-</span>
          <span className="bg-[#EAE5FB] px-3 py-1 rounded-lg text-sm font-medium">
            {estimatedSize}
          </span>
        </div>

        {/* Quality & Frame Rate */}
        <ExportQualityFrameRate settings={settings} setSettings={setSettings} />

        {/* Compression */}
        <ExportCompression settings={settings} setSettings={setSettings} />

        {/* Subtitles — burn in, or keep the picture clean and take the .srt.
            Only for demos that actually have cues. */}
        {hasSubtitles && (
          <div className="mb-6">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-[15px] text-[#8A76FC]">Burn subtitles into video</span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={settings.burnSubtitles}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, burnSubtitles: e.target.checked }))
                  }
                  className="peer sr-only"
                />
                <span className="h-5 w-9 rounded-full bg-[#EAE5FB] transition peer-checked:bg-[#8A76FC] peer-focus-visible:ring-2 peer-focus-visible:ring-[#A594F9]" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
            <p className="mt-1 text-[13px] text-[#8A76FC] opacity-80">
              {settings.burnSubtitles
                ? "Subtitles are drawn into the picture and cannot be turned off by the viewer."
                : "The video exports with no subtitles — download them as .srt or .vtt instead."}
            </p>
          </div>
        )}

        {/* License Info Box */}
        {limitReached ? (
          <div className="bg-[#FFEAEA] rounded-xl p-4 mb-6">
            <h3 className="text-red-500 text-[15px] font-bold leading-snug">
              Your free trial of 3 exports has expired please subscribe to our premium plan
            </h3>
          </div>
        ) : !isExempt ? (
          <div className="bg-[#EAE5FB] rounded-xl p-4 mb-6">
            <h3 className="text-[#8A76FC] text-[15px] font-medium">
              You have {Math.max(0, 3 - (exportCount || 0))}/3 free exports left.
            </h3>
            <p className="text-[#8A76FC] text-[13px] opacity-80">
              Free trial exports include a watermark on videos
            </p>
          </div>
        ) : null}

        {/* Confirm Action */}
        {limitReached ? (
          <button
            onClick={() =>
              router.push("/pricing?returnUrl=" + encodeURIComponent(window.location.href))
            }
            className="w-full bg-red-500 text-white py-[14px] rounded-xl font-medium text-[16px] hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            View Plans
          </button>
        ) : (
          <button
            onClick={() => onConfirm(settings)}
            disabled={exportCount === null}
            className="w-full bg-[#8A76FC] text-white py-[14px] rounded-xl font-medium text-[16px] hover:bg-[#7C5CFC] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {exportCount === null ? "Loading..." : "Confirm and export"} <span>→</span>
          </button>
        )}
      </div>
    </div>
  );
}
