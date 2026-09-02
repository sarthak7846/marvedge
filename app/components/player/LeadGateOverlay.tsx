"use client";

// The lead capture gate (#302 §2.1).
//
// IT REGISTERS INTO THE HOST'S SLOT AND OWNS NO POSITIONING OF ITS OWN. Backdrop,
// stacking, the bottom-sheet-on-mobile treatment, the dialog role and the
// initial focus move all belong to <PlayerOverlay>; read the contract in
// PlayerOverlayHost.tsx before changing anything here. In particular this
// component NEVER CALLS pause(): opening the overlay is what pauses the video,
// and a second caller of pause() is how a video ends up resuming underneath a
// half-filled form.
//
// ============================================================================
// HARD MODE IS CLIENT-SIDE AND BYPASSABLE. SAY SO.
// ============================================================================
// The media URL is in the page source and the file is publicly readable, so a
// viewer who opens devtools can watch the whole video without ever seeing this
// form. Every control the gate disables is disabled in OUR UI, not at the
// origin. That is a deliberate v1 trade — the alternative is signed media URLs
// and a token-checking delivery path, which is PR 8 behind its own sub-flag —
// and it must be described honestly to anyone who asks, because the first thing
// a customer evaluating a "hard" gate does is test it.
//
// What hard mode DOES do, and does properly: the video is held paused, the
// control bar is inert (disabled attributes AND handlers that refuse — see
// areControlsLocked() and the guards in MarvedgePlayer), keyboard shortcuts do
// nothing, and Tab is trapped inside the form so a keyboard user cannot fall
// through to controls that would not work anyway.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  COMPANY_SIZE_BUCKETS,
  gateShouldOpen,
  renderConsentText,
  resolveGateTriggerSec,
  type CompanySize,
} from "@/app/lib/overlays/leadGate";
import { isValidEmail, isWorkEmail } from "@/app/lib/overlays/email";
import { HONEYPOT_FIELD } from "@/app/lib/overlays/lead";
import type { LeadGateConfig } from "@/app/lib/overlays/types";

import { PlayerOverlay, usePlayerOverlays } from "./PlayerOverlayHost";

/**
 * Relative, like the telemetry endpoint and for the same reason: on a customer's
 * own domain this must stay same-origin so the mv_sid cookie goes with it. An
 * absolute NEXT_PUBLIC_APP_URL here would make every submission a cross-origin
 * request carrying a third-party cookie.
 */
const LEADS_ENDPOINT = "/api/v3/leads";

/** Marvedge purple. The hub route passes HubSettings.brandColor instead. */
const DEFAULT_ACCENT = "#8A76FC";

/**
 * Remembers that this browser has already converted on this demo, so the gate
 * does not flash before the server-rendered answer is applied — and still works
 * when the server answer is missing. Per demo, matching the server-side rule in
 * overlayContext.ts.
 *
 * IT IS NOT MERELY A CACHE OF THE SERVER ANSWER. A first-time viewer arrives
 * with no mv_sid, and BOTH this form and the telemetry flush will mint one if
 * they race — last Set-Cookie wins, so the id stored on the Lead can end up not
 * being the id the browser keeps. The server-side lookup then misses on the next
 * visit and this is the only thing that stops the viewer being re-gated.
 */
function localStorageKey(demoId: string): string {
  return `ovl:lead:${demoId}`;
}

function readCaptured(demoId: string): boolean {
  try {
    return (
      typeof localStorage !== "undefined" && localStorage.getItem(localStorageKey(demoId)) !== null
    );
  } catch {
    // Private mode, a sandboxed frame, or a browser set to reject site data.
    // Falling back to "not captured" re-asks, which the server-side lookup and
    // the upsert both make harmless.
    return false;
  }
}

function writeCaptured(demoId: string): void {
  try {
    localStorage.setItem(localStorageKey(demoId), "1");
  } catch {
    // Nothing to do and nothing worth telling the viewer. The server-side
    // lookup by mv_sid is the durable half of this.
  }
}

/** Codes /api/v3/leads answers with, turned into something a person can act on. */
const ERROR_MESSAGES: Record<string, string> = {
  email: "That email address does not look right. Please check it and try again.",
  work_email: "Please use your work email address.",
  missing_fields: "Please fill in every field before continuing.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  invalid: "Something went wrong. Please try again.",
  not_found: "This form is no longer accepting submissions.",
};

export interface LeadGateOverlayProps {
  demoId: string;
  config: LeadGateConfig;
  /** Resolved server-side; substituted for `{owner}` in the consent sentence. */
  ownerName?: string | null;
  /** HubSettings.brandColor on a customer domain, Marvedge purple elsewhere. */
  accentColor?: string;
  /** Server-side mv_sid lookup said this browser has already converted. */
  alreadyCaptured?: boolean;
  /**
   * Called once, with WHAT THE VIEWER ACTUALLY TYPED, after a successful submit.
   *
   * It exists for PR 6's scheduling prefill and is deliberately narrow: fields
   * this gate did not ask for are not included, and nothing is remembered across
   * a page load. A returning viewer recognised by cookie alone reaches the
   * booking widget with an empty form, which is the correct outcome — consent was
   * given for us to contact them, and handing their details to a third party is a
   * fresh disclosure that only this session's own submit authorises.
   *
   * The caller must treat the argument as PII: it may not be logged, stored in
   * localStorage, or put in a URL other than the consented provider prefill.
   */
  onCaptured?: (lead: { name?: string; email: string }) => void;
}

export default function LeadGateOverlay({
  demoId,
  config,
  ownerName,
  accentColor = DEFAULT_ACCENT,
  alreadyCaptured = false,
  onCaptured,
}: LeadGateOverlayProps) {
  const { playback, telemetry } = usePlayerOverlays();
  const { currentTime, duration, paused } = playback.state;

  const fieldId = useId();
  const blocking = config.mode === "hard";

  // --- Should it be up? ----------------------------------------------------

  const [captured, setCaptured] = useState(alreadyCaptured);
  /** Latched once the viewer submits or skips; the gate is done for this view. */
  const [resolved, setResolved] = useState(false);
  const [open, setOpen] = useState(false);

  // The localStorage fast path runs in an effect rather than in a lazy state
  // initializer: reading storage during render would produce different markup on
  // the server and the client and fail hydration. It lands long before any gate
  // could open, since opening needs a play or a seek.
  useEffect(() => {
    if (readCaptured(demoId)) {
      setCaptured(true);
    }
  }, [demoId]);

  // Previous observed playhead, for the crossing test. A ref because it must not
  // itself cause a render — state.currentTime already does that.
  const prevTimeRef = useRef(currentTime);

  useEffect(() => {
    const prevTime = prevTimeRef.current;
    prevTimeRef.current = currentTime;

    if (captured || resolved || open) {
      return;
    }
    const triggerSec = resolveGateTriggerSec(config.triggerAt, duration);
    if (gateShouldOpen({ triggerSec, prevTime, currentTime, paused })) {
      setOpen(true);
    }
  }, [captured, config.triggerAt, currentTime, duration, open, paused, resolved]);

  // gate_shown is emitted from the transition, not from the render, so a
  // re-render of an already-open gate cannot fire it twice. `mode` rides along
  // because "how many hard gates converted vs soft ones" is the first question
  // PR 7's funnel will be asked.
  const shownRef = useRef(false);
  useEffect(() => {
    if (open && !shownRef.current) {
      shownRef.current = true;
      telemetry.emit("gate_shown", currentTime, { mode: config.mode });
    }
    // currentTime is read, not depended on: the position at the moment it opened
    // is the one worth recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.mode, open, telemetry]);

  // --- Form state ----------------------------------------------------------

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the form was first rendered, for the minimum-time-on-form check. Set
  // once at mount rather than when the gate opens, which is both simpler and
  // more generous to a slow reader.
  const openedAtRef = useRef(Date.now());

  const consentSentence = useMemo(
    () => renderConsentText(config.consentText, ownerName),
    [config.consentText, ownerName]
  );

  /** Client-side mirror of the route's rules, so errors are inline and instant. */
  const validate = useCallback((): string | null => {
    if (config.fields.name && name.trim().length === 0) {
      return "Please enter your name.";
    }
    if (!isValidEmail(email)) {
      return ERROR_MESSAGES.email;
    }
    if (config.requireWorkEmail && !isWorkEmail(email)) {
      return ERROR_MESSAGES.work_email;
    }
    if (config.fields.companySize && companySize === "") {
      return "Please choose a company size.";
    }
    if (!consent) {
      return "Please tick the box to continue.";
    }
    return null;
  }, [
    companySize,
    config.fields.companySize,
    config.fields.name,
    config.requireWorkEmail,
    consent,
    email,
    name,
  ]);

  const finish = useCallback(() => {
    setCaptured(true);
    writeCaptured(demoId);
    // Only the fields the gate actually rendered, so a config with no name input
    // cannot hand a stale one to whoever is listening.
    onCaptured?.({
      ...(config.fields.name && name.trim() ? { name: name.trim() } : {}),
      email: email.trim(),
    });
    // Closing the slot is all it takes: the host re-resolves the layer on the
    // same pass and releases the video, unless the viewer had paused it
    // themselves or something else is waiting to take the layer.
    setResolved(true);
  }, [config.fields.name, demoId, email, name, onCaptured]);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) {
        return;
      }
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      setSubmitting(true);

      try {
        const response = await fetch(LEADS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demoId,
            ...(config.fields.name ? { name: name.trim() } : {}),
            email: email.trim(),
            ...(config.fields.companySize && companySize ? { companySize } : {}),
            consent: true,
            // THE EXACT SENTENCE THAT WAS ON SCREEN, not the template it came
            // from. A later reword must never change what this viewer is
            // recorded as having agreed to.
            consentText: consentSentence,
            referrer: document.referrer || undefined,
            ...(Number.isFinite(currentTime) && currentTime >= 0
              ? { positionSec: currentTime }
              : {}),
            formOpenedAt: openedAtRef.current,
            [HONEYPOT_FIELD]: honeypot,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(ERROR_MESSAGES[body?.error ?? "invalid"] ?? ERROR_MESSAGES.invalid);
          return;
        }
        // lead_submitted is written by the route, not emitted here: it must
        // survive the tab closing on the most valuable step in the funnel, and
        // two writers would double-count every conversion.
        finish();
      } catch {
        // Offline, or the request was cut off. Never surface anything derived
        // from what they typed.
        setError(ERROR_MESSAGES.invalid);
      } finally {
        setSubmitting(false);
      }
    },
    [
      companySize,
      config.fields.companySize,
      config.fields.name,
      consentSentence,
      currentTime,
      demoId,
      email,
      finish,
      honeypot,
      name,
      submitting,
      validate,
    ]
  );

  const onSkip = useCallback(() => {
    telemetry.emit("gate_skipped", currentTime, { mode: config.mode });
    // Skipping does NOT mark the viewer as captured — they gave us nothing, and
    // a gate they dismissed once should still be there on their next visit.
    setResolved(true);
  }, [config.mode, currentTime, telemetry]);

  // --- Focus trap ----------------------------------------------------------
  //
  // <PlayerOverlay> moves focus into the panel once. Keeping it there is this
  // component's job, and only for a hard gate: a soft gate leaves the controls
  // live underneath, so trapping Tab would take away the Skip-by-keyboard escape
  // route the mode is defined by.

  const formRef = useRef<HTMLFormElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // The player treats Space/k/arrows as shortcuts. It already ignores events
      // from an INPUT/SELECT and from a focused button, but stopping propagation
      // here means no future shortcut can reach past an open modal either.
      event.stopPropagation();

      if (event.key !== "Tab" || !blocking) {
        return;
      }
      const focusable = formRef.current?.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !formRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [blocking]
  );

  // --- Render --------------------------------------------------------------

  const labelClass = "block text-[13px] font-semibold text-[#2D1F61]";
  const inputClass =
    "mt-1 w-full rounded-lg border border-[#DCD3F7] bg-white px-3 py-2 text-sm text-[#2D1F61] placeholder:text-[#A79CC7] focus:outline-none focus:ring-2";

  return (
    <PlayerOverlay
      kind="gate"
      blocking={blocking}
      open={open && !captured && !resolved}
      label={config.copy.heading || "Continue watching"}
    >
      <div className="p-5 sm:p-6" onKeyDown={onKeyDown}>
        <h2 className="text-lg font-bold text-[#2D1F61]">{config.copy.heading}</h2>
        {config.copy.subheading ? (
          <p className="mt-1 text-sm text-[#6B5F94]">{config.copy.subheading}</p>
        ) : null}

        <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          {config.fields.name && (
            <div>
              <label className={labelClass} htmlFor={`${fieldId}-name`}>
                Name
              </label>
              <input
                id={`${fieldId}-name`}
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                style={{ ["--tw-ring-color" as string]: accentColor }}
                placeholder="Ada Lovelace"
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor={`${fieldId}-email`}>
              {config.requireWorkEmail ? "Work email" : "Email"}
            </label>
            <input
              id={`${fieldId}-email`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              style={{ ["--tw-ring-color" as string]: accentColor }}
              placeholder="you@company.com"
            />
          </div>

          {config.fields.companySize && (
            <div>
              <label className={labelClass} htmlFor={`${fieldId}-size`}>
                Company size
              </label>
              <select
                id={`${fieldId}-size`}
                name="companySize"
                autoComplete="organization"
                required
                value={companySize}
                onChange={(event) => setCompanySize(event.target.value as CompanySize | "")}
                className={inputClass}
                style={{ ["--tw-ring-color" as string]: accentColor }}
              >
                <option value="">Select…</option>
                {COMPANY_SIZE_BUCKETS.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket} employees
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* The honeypot. Off-screen rather than display:none (which some
              fillers skip), hidden from assistive tech and out of the tab order,
              so no person is ever offered it and a script fills it in. */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
          >
            <label htmlFor={`${fieldId}-hp`}>Company website</label>
            <input
              id={`${fieldId}-hp`}
              name={HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-[12px] leading-snug text-[#6B5F94]">
            <input
              type="checkbox"
              name="consent"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#DCD3F7]"
              style={{ accentColor }}
            />
            <span>
              {consentSentence}
              {config.privacyPolicyUrl ? (
                <>
                  {" "}
                  <a
                    href={config.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                    style={{ color: accentColor }}
                  >
                    Privacy policy
                  </a>
                </>
              ) : null}
            </span>
          </label>

          {/* role="alert" so a screen reader hears the problem rather than a
              button that silently refuses to do anything. */}
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-[#FDECEC] px-3 py-2 text-[12px] text-[#B3261E]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? "Sending…" : config.copy.submitLabel}
          </button>

          {!blocking && (
            <button
              type="button"
              onClick={onSkip}
              className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-[#6B5F94] underline-offset-2 transition hover:underline"
            >
              {config.copy.skipLabel || "Maybe later"}
            </button>
          )}
        </form>
      </div>
    </PlayerOverlay>
  );
}
