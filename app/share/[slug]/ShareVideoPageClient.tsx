"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, type CSSProperties } from "react";

import ShareQrCode from "@/app/components/qr/ShareQrCode";
import { AUTO_DETECT_LANGUAGE, languageLabel } from "@/app/lib/subtitles";

import { useViewTracking } from "./hooks/useViewTracking";
import { getPreviewStage } from "./utils/previewStage";
import ShareHeader from "./components/ShareHeader";
import ShareSignupCTA from "./components/ShareSignupCTA";
import ShareCtaButtons, { type ShareCta } from "./components/ShareCtaButtons";

type ShareVideoPageClientProps = {
  title: string;
  description: string | null;
  videoUrl: string;
  backgroundStyle: CSSProperties;
  aspectRatio: string;
  demoId?: string;
  videoId?: string;
  ctas?: ShareCta[];
  /**
   * Absolute URL for this page's own "scan to keep watching" QR, or omitted for
   * no QR. Passed in rather than derived from `window.location` so the caller
   * decides the origin — which is the whole point on a customer hub, where the
   * QR must carry the customer's domain (see hubShareUrl in
   * app/lib/share/qrTarget.ts).
   *
   * Only the hub page passes it today. Whether the marvedge.com share page should
   * show one too is still open (QR-Implementation-Plan.md §5 Q3) — it is this one
   * prop away, deliberately not decided here.
   */
  shareQrUrl?: string;
  /**
   * WebVTT for a selectable caption track, or omitted for no captions. Built
   * server-side by the page, which is also where the decision to offer one at
   * all is made — see captionsForSource() in page.tsx. Passed as a document
   * rather than a URL because there is no route serving a public demo's cues,
   * and inlining it costs one round trip less than adding one.
   */
  captionsVtt?: string;
  /** Language of `captionsVtt`, for the track's `srclang` and menu label. */
  captionsLanguage?: string;
};

export default function ShareVideoPageClient({
  title,
  description,
  videoUrl,
  backgroundStyle,
  aspectRatio,
  demoId,
  videoId,
  ctas = [],
  shareQrUrl,
  captionsVtt,
  captionsLanguage,
}: ShareVideoPageClientProps) {
  const videoRef = useViewTracking(demoId, videoId);
  const captionsUrl = useObjectUrl(captionsVtt, "text/vtt");

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
              >
                {/* SUB PR 6: selectable captions, so a shared demo is watchable
                    with the sound off. `default` because the alternative this
                    replaces — burned-in subtitles — was always on. Rendered only
                    after the effect has minted the object URL.

                    No `crossOrigin` on the <video> above, deliberately: a track
                    is fetched relative to the DOCUMENT's origin, and a blob: URL
                    this page minted is already same-origin, so the attribute
                    would buy nothing while risking the video itself — a
                    cross-origin GCS response without CORS headers fails to load
                    at all once the element opts into CORS. */}
                {captionsUrl && (
                  <track
                    kind="captions"
                    src={captionsUrl}
                    srcLang={
                      captionsLanguage && captionsLanguage !== AUTO_DETECT_LANGUAGE
                        ? captionsLanguage
                        : undefined
                    }
                    label={
                      captionsLanguage && captionsLanguage !== AUTO_DETECT_LANGUAGE
                        ? languageLabel(captionsLanguage)
                        : "Captions"
                    }
                    default
                  />
                )}
              </video>
            </div>
          </div>
        </div>

        <ShareCtaButtons ctas={ctas} demoId={demoId} />

        {/* "Take this with you" — the visitor is on a desktop, the QR moves the
            demo to their phone. ShareQrCode returns null when the kill-switch is
            off, so no empty card is left behind. */}
        {shareQrUrl && (
          <div className="mx-auto mt-8 w-full max-w-md">
            <ShareQrCode
              url={shareQrUrl}
              title={title}
              className="rounded-2xl border-[#BEB0F8]/60 shadow-[0_16px_40px_rgba(76,57,162,0.18)]"
            />
          </div>
        )}

        {!isLoggedIn && <ShareSignupCTA />}
      </section>
    </main>
  );
}

/**
 * Hold `content` as a blob object URL for as long as it is unchanged, revoking
 * the previous one.
 *
 * A `data:` URI would need no effect at all, but browsers disagree about whether
 * a `data:` `<track>` src is CORS-same-origin with the document — a blob this
 * page minted unambiguously is. Returns null on the server and on the first
 * client render, so the markup React hydrates matches what the server sent.
 */
function useObjectUrl(content: string | undefined, type: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!content) {
      setUrl(null);
      return;
    }
    const href = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
    setUrl(href);
    return () => URL.revokeObjectURL(href);
  }, [content, type]);

  return url;
}
