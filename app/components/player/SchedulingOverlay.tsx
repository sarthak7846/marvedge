"use client";

// The scheduling overlay (#302 §2.3): a Calendly / HubSpot booking surface
// inside the video canvas.
//
// IT REGISTERS INTO THE HOST'S SLOT AND OWNS NO POSITIONING OF ITS OWN. Backdrop,
// stacking, the phone/desktop switch, the dialog role and the initial focus move
// all belong to <PlayerOverlay>; the standing button belongs to
// <PlayerOverlayTrigger>. There is no z-index in this file and there must not be
// one. Read the contract in PlayerOverlayHost.tsx first. Like every other
// overlay, this one NEVER CALLS pause() — opening it is what pauses the video,
// and closing it is what gives the video back.
//
// ============================================================================
// THIS IS THE ONLY PLACE MARVEDGE FRAMES SOMEONE ELSE'S DOCUMENT
// ============================================================================
// The share page loads ZERO third-party scripts and this PR does not change
// that: both providers are embedded as a BARE IFRAME URL, never their widget
// script, so there is no provider entry in the CSP's script-src and no
// third-party JavaScript running in the page's own origin.
//
// The src is NEVER config.scheduling.url. It is always the output of
// buildSchedulingEmbedUrl(), which re-runs the host allow-list at render — see
// app/lib/overlays/schedulingHosts.ts for why that matters even though the PUT
// route checks it too. If that function returns undefined, this component
// renders nothing at all rather than an empty frame.
//
// ============================================================================
// WHY THE PANEL IS `wide`
// ============================================================================
// A Calendly inline widget lays out a month grid beside a time column. It does
// not fit the 28rem card the other two overlays use, and it REALLY does not fit
// a 9:16 phone canvas — so on a phone it is a full-height sheet, which is the
// most room there is, and the widget scrolls inside it. Shrinking it instead
// produces an embed that loads correctly and cannot be booked from, which is the
// worst of the available outcomes.
//
// ============================================================================
// meeting_booked IS BEST-EFFORT, AND HONESTLY SO
// ============================================================================
// Calendly posts a documented `calendly.event_scheduled` message, checked
// against the embed's exact origin below. HubSpot has no supported equivalent
// for the bare meetings iframe; isSchedulingBookedMessage() matches an observed
// shape, and a HubSpot booking may simply never produce an event. The gap is
// written down in the README. NOTHING MAY READ "no meeting_booked" AS "no
// meeting".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";

import {
  buildSchedulingEmbedUrl,
  isSchedulingBookedMessage,
  schedulingEmbedOrigin,
  type SchedulingPrefill,
} from "@/app/lib/overlays/schedulingHosts";
import type { SchedulingConfig } from "@/app/lib/overlays/types";

import { PlayerOverlay, PlayerOverlayTrigger, usePlayerOverlays } from "./PlayerOverlayHost";

/** Marvedge purple. The hub route passes HubSettings.brandColor instead. */
const DEFAULT_ACCENT = "#8A76FC";

/**
 * What the iframe is allowed to do.
 *
 * `allow-same-origin` looks alarming and is not: it grants the framed document
 * ITS OWN origin, not ours, so Calendly gets its cookies and storage back while
 * remaining unable to touch this page. Dropping it breaks both providers
 * outright. What is deliberately NOT here is `allow-top-navigation` — an embed
 * that can navigate the top window can walk the viewer off the customer's page,
 * and no booking flow needs to.
 */
const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

export interface SchedulingOverlayProps {
  config: SchedulingConfig;
  /**
   * The lead THIS PAGE SESSION captured, for the prefill. Absent means no
   * prefill, which is the correct outcome for a returning viewer we recognise by
   * cookie but who has typed nothing today — see SchedulingPrefill.
   */
  prefill?: SchedulingPrefill | null;
  /**
   * Bumped by another overlay to ask for the booking surface: the lead gate on a
   * successful submit, the branch cards on their extra action. A COUNTER, not a
   * boolean, so a second request after the viewer closed the panel re-opens it
   * instead of being swallowed by an unchanged prop.
   */
  openSignal?: number;
  accentColor?: string;
}

export default function SchedulingOverlay({
  config,
  prefill,
  openSignal = 0,
  accentColor = DEFAULT_ACCENT,
}: SchedulingOverlayProps) {
  const { playback, telemetry } = usePlayerOverlays();
  const { currentTime } = playback.state;

  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /**
   * The hostname to hand Calendly as `embed_domain`. Read after mount rather
   * than during render: there is no `location` on the server, and a value that
   * differs between the two renders is a hydration mismatch. Nothing needs it
   * before the viewer opens the panel.
   */
  const [embedDomain, setEmbedDomain] = useState<string | null>(null);
  useEffect(() => {
    setEmbedDomain(window.location.hostname);
  }, []);

  // THE ALLOW-LIST, AT RENDER. Recomputed rather than memoised across a config
  // change so a stored URL can never outlive the check that approved it.
  const embedUrl = useMemo(
    () =>
      buildSchedulingEmbedUrl(config.url, config.provider, {
        prefill: config.prefill ? prefill : null,
        embedDomain,
      }),
    [config.prefill, config.provider, config.url, embedDomain, prefill]
  );

  const expectedOrigin = useMemo(
    () => schedulingEmbedOrigin(config.url, config.provider),
    [config.provider, config.url]
  );

  // --- Opening -------------------------------------------------------------

  const openPanel = useCallback(() => {
    setLoaded(false);
    setOpen(true);
  }, []);

  // Another overlay asked for it. Skips the initial 0 so a mount is not an open.
  const lastSignalRef = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== lastSignalRef.current) {
      lastSignalRef.current = openSignal;
      if (openSignal > 0) {
        openPanel();
      }
    }
  }, [openPanel, openSignal]);

  const onClose = useCallback(() => {
    // Closing the slot is all it takes. The host re-resolves the layer on the
    // same pass and releases the video — unless the viewer had paused it
    // themselves, in which case their pause wins. That is the host's rule and
    // there is deliberately no play() call here to second-guess it.
    setOpen(false);
  }, []);

  // --- meeting_booked ------------------------------------------------------

  /**
   * Once per mount. A provider that posts the message twice (a retry, a
   * re-render inside the widget) must not double-count a booking in the funnel.
   */
  const bookedRef = useRef(false);

  useEffect(() => {
    if (!open || !expectedOrigin) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      // ORIGIN FIRST, ALWAYS. Any page on the internet can postMessage at this
      // window, and the payload check below proves nothing on its own.
      if (event.origin !== expectedOrigin || bookedRef.current) {
        return;
      }
      if (!isSchedulingBookedMessage(config.provider, event.data)) {
        return;
      }
      bookedRef.current = true;
      // The provider is the only thing recorded. NOTHING FROM THE MESSAGE BODY
      // GOES INTO META — a Calendly payload carries the invitee's name and email,
      // and PlayerEvent is not a place for someone else's personal data.
      telemetry.emit("meeting_booked", currentTime, { provider: config.provider });
      telemetry.flush();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // currentTime is read at fire time, not depended on: re-subscribing on every
    // timeupdate would churn a listener several times a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.provider, expectedOrigin, open, telemetry]);

  // A config whose URL does not survive the allow-list renders nothing — no
  // button, no panel, no empty frame.
  if (!embedUrl) {
    return null;
  }

  const label = config.buttonLabel || "Book a meeting";

  return (
    <>
      {config.openFrom.button ? (
        <PlayerOverlayTrigger>
          <button
            type="button"
            onClick={openPanel}
            className={[
              "pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5",
              "text-[12px] font-semibold text-white shadow-[0_6px_18px_rgba(22,16,54,0.35)]",
              "motion-safe:transition-transform hover:scale-[1.03]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            ].join(" ")}
            style={{ backgroundColor: accentColor }}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        </PlayerOverlayTrigger>
      ) : null}

      <PlayerOverlay kind="scheduler" blocking={false} open={open} label={label} size="wide">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EDE7FA] px-4 py-3">
            <h2 className="text-sm font-bold text-[#2D1F61]">{label}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close scheduling"
              className="-mr-1 shrink-0 rounded-full p-1.5 text-[#6B5F94] transition hover:bg-[#F6F3FF] focus-visible:outline-none focus-visible:ring-2"
              style={{ ["--tw-ring-color" as string]: accentColor }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            {/* A VISIBLE LOADING STATE. A blank rectangle inside a video is
                indistinguishable from a bug, and a booking widget on a slow
                connection is blank for a while. Left mounted underneath rather
                than swapped out, so the iframe is never remounted by the state
                change that hides it. */}
            {!loaded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4DCFB] motion-reduce:animate-none"
                  style={{ borderTopColor: accentColor }}
                  role="status"
                  aria-label="Loading the booking calendar"
                />
                <p className="text-[12px] text-[#6B5F94]">Loading available times…</p>
              </div>
            ) : null}

            <iframe
              src={embedUrl}
              title={label}
              onLoad={() => setLoaded(true)}
              loading="lazy"
              sandbox={IFRAME_SANDBOX}
              // Only the origin, never the path: the share URL carries the demo
              // slug and the provider has no use for it.
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </PlayerOverlay>
    </>
  );
}
