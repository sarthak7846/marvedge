"use client";

import { useSession } from "next-auth/react";
import type { CSSProperties } from "react";

import { useViewTracking } from "./hooks/useViewTracking";
import { getPreviewStage } from "./utils/previewStage";
import ShareHeader from "./components/ShareHeader";
import ShareSignupCTA from "./components/ShareSignupCTA";

type ShareVideoPageClientProps = {
  title: string;
  description: string | null;
  videoUrl: string;
  backgroundStyle: CSSProperties;
  aspectRatio: string;
  demoId?: string;
  videoId?: string;
};

export default function ShareVideoPageClient({
  title,
  description,
  videoUrl,
  backgroundStyle,
  aspectRatio,
  demoId,
  videoId,
}: ShareVideoPageClientProps) {
  const videoRef = useViewTracking(demoId, videoId);

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const { previewFrameAspectRatio, stageWidth, stageHeight, stageMaxWidth } =
    getPreviewStage(aspectRatio);

  return (
    <main className="min-h-screen bg-[#F2EDFF]">
      <ShareHeader isLoggedIn={isLoggedIn} />

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-[#2A1D5C]">{title || "Untitled Demo"}</h1>
          {description ? <p className="mt-2 text-sm text-[#7A6FA8]">{description}</p> : null}
        </div>

        <div
          className="relative overflow-hidden rounded-[34px] border border-[#BEB0F8]/60 p-8 shadow-[0_28px_85px_rgba(76,57,162,0.22)]"
          style={backgroundStyle}
        >
          <div
            className="mx-auto flex w-full items-center justify-center overflow-hidden rounded-[22px] border border-white/30 bg-[#1A1338]/20 p-3 shadow-[0_16px_40px_rgba(22,16,54,0.35)] backdrop-blur-sm"
            style={{
              aspectRatio: "16 / 9",
              minHeight: "240px",
            }}
          >
            <div
              className="overflow-hidden rounded-[16px] bg-black/55"
              style={{
                width: stageWidth,
                maxWidth: stageMaxWidth,
                height: stageHeight,
                maxHeight: "74vh",
                aspectRatio: previewFrameAspectRatio,
              }}
            >
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                src={videoUrl}
                controls
                preload="metadata"
                playsInline
                controlsList="nodownload"
              />
            </div>
          </div>
        </div>

        {!isLoggedIn && <ShareSignupCTA />}
      </section>
    </main>
  );
}
