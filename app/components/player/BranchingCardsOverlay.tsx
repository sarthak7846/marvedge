"use client";

// The branching cards (#302 §2.2): two choices in the final seconds of the video.
//
// IT REGISTERS INTO THE HOST'S SLOT AND OWNS NO POSITIONING OF ITS OWN. Backdrop,
// stacking, the bottom-sheet-on-mobile treatment, the dialog role and the initial
// focus move all belong to <PlayerOverlay>; there is no z-index in this file and
// there must not be one. Read the contract in PlayerOverlayHost.tsx first. In
// particular this component NEVER CALLS pause() — opening the overlay is what
// pauses the video.
//
// ============================================================================
// WHY THE CARDS NEVER FIGHT THE GATE
// ============================================================================
// They register as `branching`, the lowest priority in the slot. If the lead
// gate or the scheduler is up when the crossing happens, this slot stays
// registered and open, renders nothing, and takes the layer by itself the moment
// the winner closes. There is nothing to queue and nothing to re-request, which
// is why this file contains no "is a gate open" check.
//
// ============================================================================
// THE VIDEO PAUSES WHEN THEY OPEN, AND THAT IS THE HOST'S RULE, NOT OURS
// ============================================================================
// shouldHoldPlayback() holds playback for ANY active overlay, dismissible ones
// included, so the cards appearing at `duration - leadSeconds` stops the video
// there. The hold is a single pause(), not a lock: the control bar stays live
// underneath (this overlay is dismissible), so a viewer who wants the last few
// seconds presses play and gets them with the cards still up. Dismiss (✕) puts
// the video back in their hands entirely.
//
// ============================================================================
// A CLICK WRITES BOTH, ALWAYS
// ============================================================================
// A `CtaClick` row through the existing POST /api/cta-clicks — which is what
// keeps the CTA numbers on app/(signed)/analytics/page.tsx counting — AND a
// `cta_click` PlayerEvent. Telemetry here is additive, never a replacement.
// Both go out through postBeacon()/flush() BEFORE the navigation, with
// keepalive, so neither is lost to the page going away.

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { postBeacon } from "@/app/lib/overlays/beacon";
import { branchCardsShouldOpen, type ResolvedBranchCard } from "@/app/lib/overlays/branch";

import { PlayerOverlay, usePlayerOverlays } from "./PlayerOverlayHost";

/**
 * Relative, like every other endpoint the player posts to: middleware.ts skips
 * /api, so a player on demos.acme.com reaches the same handler same-origin and
 * the mv_sid cookie goes with it.
 */
const CTA_CLICKS_ENDPOINT = "/api/cta-clicks";

/** Marvedge purple. The hub route passes HubSettings.brandColor instead. */
const DEFAULT_ACCENT = "#8A76FC";

export interface BranchingCardsOverlayProps {
  /** Exactly two, resolved server-side. Fewer means nothing renders. */
  cards: ResolvedBranchCard[];
  leadSeconds: number;
  /** Absent on the bare exported-video route; the CtaClick is skipped there. */
  demoId?: string;
  accentColor?: string;
  /** Heading above the pair. Owner copy is not configurable for v1. */
  heading?: string;
  /**
   * PR 6's scheduling overlay, offered as a THIRD ACTION BESIDE the two cards
   * when the owner enabled it there. Absent means the row is not rendered.
   *
   * Deliberately not a card: BranchTarget has exactly two variants and a card
   * that opened an overlay instead of navigating would be a third kind of
   * destination in everything but name. This is a separate affordance under the
   * pair, and the pair is untouched by it.
   */
  onSchedule?: () => void;
  scheduleLabel?: string;
}

export default function BranchingCardsOverlay({
  cards,
  leadSeconds,
  demoId,
  accentColor = DEFAULT_ACCENT,
  heading = "What would you like to see next?",
  onSchedule,
  scheduleLabel = "Book a meeting",
}: BranchingCardsOverlayProps) {
  const { playback, telemetry } = usePlayerOverlays();
  const { currentTime, duration, ended } = playback.state;

  /**
   * Latched. Once the cards are up they stay up — through `ended`, and through a
   * seek back into the middle of the video — because "shown in the final seconds
   * and persisting through the end" is the whole behaviour. branchCardsShouldOpen
   * answers "should they be up right now"; the latch answers "have they been".
   */
  const [open, setOpen] = useState(false);
  /** The viewer said no. Final for this view — re-offering would be nagging. */
  const [dismissed, setDismissed] = useState(false);

  // Previous observed playhead, for the crossing test. A ref because it must not
  // itself cause a render; state.currentTime already does that.
  const prevTimeRef = useRef(currentTime);

  useEffect(() => {
    const prevTime = prevTimeRef.current;
    prevTimeRef.current = currentTime;

    if (open || dismissed) {
      return;
    }
    if (branchCardsShouldOpen({ duration, leadSeconds, prevTime, currentTime, ended })) {
      setOpen(true);
    }
  }, [currentTime, dismissed, duration, ended, leadSeconds, open]);

  const hasCards = cards.length > 0;

  const onCardClick = useCallback(
    (card: ResolvedBranchCard) => {
      // BOTH, ALWAYS — and in this order, so the row that feeds the existing
      // dashboard is queued first if the browser is going to drop anything.
      //
      // The row needs a ctaId (the endpoint has always required one). A card
      // whose mirrored Cta row has gone missing still emits its event rather
      // than losing the click entirely.
      if (demoId && card.ctaId) {
        postBeacon(
          CTA_CLICKS_ENDPOINT,
          JSON.stringify({
            ctaId: card.ctaId,
            demoId,
            label: card.label,
            referrer: document.referrer,
          })
        );
      }
      telemetry.emit("cta_click", currentTime, {
        placement: card.placement,
        target: card.kind,
      });
      // The batch is normally flushed on a timer or on pagehide. A same-tab
      // navigation is neither in time, so push it out now — postBeacon() hands
      // the request to the browser, which owns it from there.
      telemetry.flush();
    },
    [currentTime, demoId, telemetry]
  );

  const onDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!hasCards) {
    return null;
  }

  return (
    <PlayerOverlay kind="branching" blocking={false} open={open && !dismissed} label={heading}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-[#2D1F61]">{heading}</h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss suggestions"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-[#6B5F94] transition hover:bg-[#F6F3FF] focus-visible:outline-none focus-visible:ring-2"
            style={{ ["--tw-ring-color" as string]: accentColor }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Stacked on a phone, side by side from 640px. Anchors rather than
            buttons: this is a navigation, so middle-click, "open in new tab" and
            the status-bar preview all keep working. */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {cards.map((card) => (
            <a
              key={card.placement}
              href={card.href}
              // An internal demo is the next step of the same funnel and belongs
              // in the same tab. An external destination opens in a new one, as
              // ShareCtaButtons already does, so the demo is not lost behind it.
              {...(card.kind === "url"
                ? { target: "_blank", rel: "noopener noreferrer" }
                : { rel: "noopener" })}
              onClick={() => onCardClick(card)}
              data-branch-placement={card.placement}
              className={[
                "group flex flex-col overflow-hidden rounded-2xl border border-[#DCD3F7] bg-white text-left",
                "transition hover:border-transparent hover:shadow-[0_10px_28px_rgba(76,57,162,0.22)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              ].join(" ")}
              style={{ ["--tw-ring-color" as string]: accentColor }}
            >
              {card.thumbnailUrl ? (
                // A plain <img>: the URL is owner-supplied and arbitrary, so
                // next/image would need every one of those hosts in
                // next.config.ts's remotePatterns and would 400 on the first one
                // that is not there.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-24 w-full bg-[#F6F3FF] object-cover"
                />
              ) : null}
              <span className="flex flex-col gap-0.5 p-3">
                <span className="text-sm font-semibold text-[#2D1F61]">{card.label}</span>
                {card.description ? (
                  <span className="text-[12px] leading-snug text-[#6B5F94]">
                    {card.description}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className="mx-3 mb-3 mt-auto rounded-lg px-3 py-1.5 text-center text-[12px] font-semibold text-white"
                style={{ backgroundColor: accentColor }}
              >
                {card.kind === "demo" ? "Watch next" : "Open"}
              </span>
            </a>
          ))}
        </div>

        {onSchedule ? (
          <button
            type="button"
            onClick={onSchedule}
            className={[
              "mt-2.5 w-full rounded-2xl border border-dashed border-[#DCD3F7] px-3 py-2",
              "text-[12px] font-semibold transition hover:bg-[#F6F3FF]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            ].join(" ")}
            style={{ color: accentColor, ["--tw-ring-color" as string]: accentColor }}
          >
            {scheduleLabel}
          </button>
        ) : null}
      </div>
    </PlayerOverlay>
  );
}
