"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

import BranchingCardsOverlay from "@/app/components/player/BranchingCardsOverlay";
import LeadGateOverlay from "@/app/components/player/LeadGateOverlay";
import MarvedgePlayer from "@/app/components/player/MarvedgePlayer";
import SchedulingOverlay from "@/app/components/player/SchedulingOverlay";
import type { SchedulingPrefill } from "@/app/lib/overlays/schedulingHosts";
import ShareQrCode from "@/app/components/qr/ShareQrCode";
import type { ResolvedBranchCard } from "@/app/lib/overlays/branch";
import { isOverlaysPanelEnabled } from "@/app/lib/overlays/flags";
import type { OverlayConfig } from "@/app/lib/overlays/types";
import { AUTO_DETECT_LANGUAGE, languageLabel } from "@/app/lib/subtitles";

import { useViewTracking } from "./hooks/useViewTracking";
import { getPreviewStage } from "./utils/previewStage";
import ShareHeader from "./components/ShareHeader";
import ShareSignupCTA from "./components/ShareSignupCTA";
import ShareCtaButtons, { type ShareCta } from "./components/ShareCtaButtons";

/** Share of the viewport height the video stage may occupy. */
const MAX_STAGE_VH = 74;

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
   * Brand accent for the player's controls. The customer-hub route passes its
   * own HubSettings.brandColor: a player on someone else's domain must not be
   * Marvedge purple just because we are. Unset elsewhere, where purple is right.
   *
   * Only read on the overlay path — the flag-off page has native controls, whose
   * colour the browser owns.
   */
  accentColor?: string;
  /**
   * The demo's sanitised overlay config, resolved server-side by
   * resolveShareOverlays(). Absent whenever OVERLAYS_ENABLED is off, so the
   * overlay layer costs nothing when the feature is not deployed.
   */
  overlays?: OverlayConfig;
  /** Substituted for `{owner}` in the consent sentence. */
  ownerName?: string | null;
  /** This browser has already given this demo a lead; do not gate it again. */
  leadCaptured?: boolean;
  /**
   * The branching pair, hrefs already resolved against the request host by
   * resolveShareOverlays(). Empty or absent means no cards — including when one
   * of the two targets no longer resolves, since half a choice is not one.
   */
  branchCards?: ResolvedBranchCard[];
  /**
   * `videoUrl` was deliberately withheld: this demo has a HARD gate and
   * OVERLAYS_SIGNED_MEDIA_ENABLED is on, so the media URL is not in the page
   * source at all and the player asks GET /api/v3/media/[demoId] for a
   * short-TTL signed one — which that endpoint refuses with 403 until a Lead
   * row exists for this browser's mv_sid.
   *
   * FALSE ON EVERY PATH THAT EXISTS TODAY, including every soft gate and every
   * demo with the sub-flag off; `videoUrl` then carries the media as it always
   * has and none of the code below runs.
   */
  mediaGated?: boolean;
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

/**
 * Size the stage frame to the demo's own aspect ratio.
 *
 * Width drives and height follows from `aspect-ratio`. The three-way min() is
 * what makes it fit both budgets at once: a preferred maximum, the space
 * actually available, and `74vh * ratio` — the width at which the derived
 * height would exactly fill the height budget. Constraining width and height
 * independently instead would let the browser satisfy both by breaking the
 * ratio, which is the letterboxing this replaces.
 *
 * The preferred widths are chosen for THIS frame rather than reused from
 * getPreviewStage's stageWidth/stageMaxWidth. Those are tuned for an inner box
 * nested inside a 16/9 outer frame (52vw and a 46% max-width for portrait), and
 * they only make sense while that outer frame exists — on a phone they would
 * render a 9:16 demo about 200px wide.
 */
function stageFrameStyle(previewFrameAspectRatio: string, ratio: number): CSSProperties {
  const isPortrait = ratio < 1;
  const isSquare = Math.abs(ratio - 1) < 0.05;
  const preferred = isPortrait ? "440px" : isSquare ? "700px" : "1120px";
  return {
    aspectRatio: previewFrameAspectRatio,
    width: `min(${preferred}, 100%, calc(${MAX_STAGE_VH}vh * ${ratio}))`,
  };
}

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
  accentColor,
  overlays,
  ownerName,
  leadCaptured = false,
  branchCards = [],
  mediaGated = false,
  captionsVtt,
  captionsLanguage,
}: ShareVideoPageClientProps) {
  // Keeps POSTing /api/views on mount and heartbeating duration every 5s, and
  // still owns the ref the <video> uses — on BOTH paths below. It is what feeds
  // every number on the analytics page, so if this ever stops pointing at a real
  // element the dashboard silently reads zero.
  const videoRef = useViewTracking(demoId, videoId);
  const captionsUrl = useObjectUrl(captionsVtt, "text/vtt");

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const { previewFrameAspectRatio, stageWidth, stageHeight, stageMaxWidth, previewRatioValue } =
    getPreviewStage(aspectRatio);

  // NEXT_PUBLIC_OVERLAYS_ENABLED. Inlined by Next at build time, so the server
  // and the client agree and there is no hydration mismatch to worry about.
  const overlaysEnabled = isOverlaysPanelEnabled();

  // BOTH flags have to be on for a gate to mount: the server one for `overlays`
  // to have been resolved at all, the client one for the player that hosts it to
  // be rendered. And it needs a demoId — a Lead hangs off a Demo, so there is
  // nowhere to put a lead captured on a bare exported-video page.
  const leadGate =
    overlaysEnabled && demoId && overlays?.enabled && overlays.leadGate.enabled
      ? overlays.leadGate
      : null;

  // Same two flags. No demoId requirement: the cards' hrefs were resolved on the
  // server, so they work anywhere the pair was resolved — and the pair is only
  // ever resolved for a demo. A missing ctaId costs the CtaClick row, not the card.
  const branching =
    overlaysEnabled && overlays?.enabled && overlays.branching.enabled && branchCards.length > 0
      ? overlays.branching
      : null;

  // Same two flags again. No demoId requirement and no plan check: scheduling is
  // free on every plan (decision 14), and the overlay renders nothing by itself
  // if the stored URL does not survive the host allow-list at render.
  const scheduling =
    overlaysEnabled && overlays?.enabled && overlays.scheduling.enabled
      ? overlays.scheduling
      : null;

  /**
   * THE COMPOSITION ROOT FOR "one overlay asks for another".
   *
   * The three overlays are siblings inside the player and none of them may reach
   * into another, so the two facts they share are held here: what the gate
   * captured (for the booking prefill) and how many times something has asked for
   * the booking surface. A counter rather than a boolean, so a second request
   * after the viewer closed the panel re-opens it.
   *
   * THE LEAD NEVER LEAVES THIS COMPONENT'S MEMORY. It is not written to
   * localStorage, not put in a query string except the consented provider
   * prefill, and gone on reload — see SchedulingPrefill for why that is the
   * intended lifetime rather than a shortcoming.
   */
  const [prefill, setPrefill] = useState<SchedulingPrefill | null>(null);
  const [scheduleSignal, setScheduleSignal] = useState(0);
  const requestScheduling = useCallback(() => setScheduleSignal((count) => count + 1), []);

  /**
   * SIGNED MEDIA (PR 8). Empty until the endpoint hands us a URL.
   *
   * `signedUrl` is only ever consulted on the gated path, so a demo that is not
   * gated — every demo today — renders `videoUrl` exactly as before and this
   * state is never read.
   */
  const [signedUrl, setSignedUrl] = useState("");
  /** Bumped after a capture, to ask again for a URL we were previously refused. */
  const [mediaAttempt, setMediaAttempt] = useState(0);

  /**
   * Fetch a short-TTL signed media URL for a gated demo.
   *
   * RUNS ON MOUNT TOO, not only after a capture: a returning viewer who already
   * submitted the form has a Lead row and should get their video without filling
   * anything in twice. The endpoint answers 403 when they have not, which is the
   * expected answer and not an error to show — the gate is already on screen
   * saying what to do about it.
   */
  useEffect(() => {
    if (!mediaGated || !demoId) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/v3/media/${encodeURIComponent(demoId)}`, {
      signal: controller.signal,
      // Same-origin on all three share routes, including a customer domain:
      // middleware.ts skips /api, so the player posts to its own origin and
      // reaches this deployment with the same mv_sid cookie scope.
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { url?: string } | null) => {
        if (typeof body?.url === "string" && body.url.length > 0) {
          setSignedUrl(body.url);
        }
      })
      .catch(() => {
        // Including the AbortError from the cleanup below. There is nothing
        // useful to say to a viewer here: either the gate is up and explains
        // itself, or the player shows its own "could not be played" state.
      });
    return () => controller.abort();
  }, [demoId, mediaGated, mediaAttempt]);

  /**
   * What the player is actually pointed at.
   *
   * On the ungated path this IS `videoUrl` and nothing changes. On the gated
   * path `videoUrl` arrived empty by design, and "" is what resolvePlayerSource()
   * treats as "attach nothing" — so the element sits with no source until the
   * signed URL lands, rather than trying to load the page's own HTML as media.
   */
  const playerSrc = mediaGated ? signedUrl : videoUrl;

  const onLeadCaptured = useCallback(
    (lead: { name?: string; email: string }) => {
      // consented: true is a statement of fact, not a default — POST /api/v3/leads
      // takes z.literal(true) for consent, so a lead that reaches this callback
      // cannot have been submitted without the box ticked.
      setPrefill({ name: lead.name, email: lead.email, consented: true });
      if (scheduling?.openFrom.gate) {
        requestScheduling();
      }
      // The 403 from before the submission is now a 200. Asking again is the
      // whole mechanism: this is the moment the media becomes available.
      if (mediaGated) {
        setMediaAttempt((attempt) => attempt + 1);
      }
    },
    [mediaGated, requestScheduling, scheduling?.openFrom.gate]
  );

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
          {overlaysEnabled ? (
            /* THE OVERLAY PATH. The outer frame follows the demo's own aspect
               ratio instead of a hardcoded 16/9 one, so a 9:16 demo fills the
               card rather than sitting letterboxed in the middle of it. The
               extra nesting the old layout needed to centre that letterbox is
               gone with it — the frame IS the stage now. */
            <div
              className="mx-auto overflow-hidden rounded-[22px] border border-white/30 bg-black shadow-[0_16px_40px_rgba(22,16,54,0.35)]"
              style={stageFrameStyle(previewFrameAspectRatio, previewRatioValue)}
            >
              <MarvedgePlayer
                src={playerSrc}
                title={title}
                videoRef={videoRef}
                demoId={demoId}
                exportedVideoId={videoId}
                accentColor={accentColor}
              >
                {leadGate && demoId ? (
                  <LeadGateOverlay
                    demoId={demoId}
                    config={leadGate}
                    ownerName={ownerName}
                    accentColor={accentColor}
                    alreadyCaptured={leadCaptured}
                    onCaptured={onLeadCaptured}
                  />
                ) : null}
                {branching ? (
                  <BranchingCardsOverlay
                    cards={branchCards}
                    leadSeconds={branching.leadSeconds}
                    demoId={demoId}
                    accentColor={accentColor}
                    onSchedule={scheduling?.openFrom.branch ? requestScheduling : undefined}
                    scheduleLabel={scheduling?.buttonLabel}
                  />
                ) : null}
                {scheduling ? (
                  <SchedulingOverlay
                    config={scheduling}
                    prefill={prefill}
                    openSignal={scheduleSignal}
                    accentColor={accentColor}
                  />
                ) : null}
              </MarvedgePlayer>
            </div>
          ) : (
            /* TODAY'S MARKUP, UNCHANGED. Backward compatibility is the
               acceptance criterion for this feature: with the flag unset every
               share route must render byte-for-byte what it renders on master —
               the same wrappers, the same native <video controls>. Do not
               "tidy" anything in here; it is a reference copy. */
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
          )}
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
