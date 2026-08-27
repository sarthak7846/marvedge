"use client";

// The "Overlays" sidebar panel (#302).
//
// PR 3 fills it with the LEAD GATE section: enable, hard/soft, when it appears,
// which fields it asks for, whether a free-mail address is accepted, and every
// word of copy including the consent sentence. PR 5 adds a Branching section
// below it and PR 6 a Scheduling one — both already exist in the config type and
// are round-tripped untouched by this panel, so neither has to change anything
// here beyond adding its own block.
//
// IT SAVES THE WHOLE CONFIG, NOT A PATCH. PUT /api/demos/[id]/overlays runs
// sanitizeOverlayConfig() over the body and writes all three sections, so
// sending only `leadGate` would silently reset branching and scheduling to their
// defaults. Holding the entire object in state and putting it back is what makes
// that impossible rather than merely unlikely.
//
// The panel previews with the SAME sanitiser the server enforces with, but the
// server re-runs it on write — this copy is a convenience and never the
// enforcement point. Same for the PRO gate: `leadGateAllowed` comes back from
// the GET (resolved from User.plan server-side) and only decides what the UI
// offers; the PUT refuses a gate on a free plan regardless.
//
// Gated behind NEXT_PUBLIC_OVERLAYS_ENABLED by its parents (EditorSidebar /
// SidebarHeader), like AvsPanel, AudioPanel and BrandingPanel.

import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { useEditorStore } from "@/app/store/editor/editorStore";
import { defaultOverlayConfig, MAX_TRIGGER_SEC } from "@/app/lib/overlays/config";
import { COMPANY_SIZE_BUCKETS, renderConsentText } from "@/app/lib/overlays/leadGate";
import type { LeadGateConfig, LeadGateTrigger, OverlayConfig } from "@/app/lib/overlays/types";

const inputClass =
  "w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#7C5CFC] placeholder:text-[#B0A5D3] focus:outline-none focus:ring-2 focus:ring-[#A594F9]";

const labelClass = "block text-xs font-semibold text-[#6B6B6B] mb-1";

/** The three trigger choices, flattened for a <select>. */
type TriggerChoice = "start" | "mid" | "custom";

function triggerChoice(trigger: LeadGateTrigger): TriggerChoice {
  return trigger === "start" || trigger === "mid" ? trigger : "custom";
}

function triggerSeconds(trigger: LeadGateTrigger): number {
  return typeof trigger === "object" ? trigger.sec : 0;
}

const Toggle: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, hint, disabled }) => (
  <label
    className={`flex items-start gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 accent-[#8A76FC]"
    />
    <span className="min-w-0">
      <span className="block text-sm font-medium text-[#4B4B4B]">{label}</span>
      {hint ? <span className="block text-[11px] text-gray-400">{hint}</span> : null}
    </span>
  </label>
);

const OverlaysPanel: React.FC = () => {
  const savedDemoId = useEditorStore((s) => s.savedDemoId);

  const [config, setConfig] = useState<OverlayConfig | null>(null);
  const [leadGateAllowed, setLeadGateAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!savedDemoId) {
      setConfig(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get(`/api/demos/${savedDemoId}/overlays`)
      .then((res) => {
        if (cancelled) {
          return;
        }
        setConfig(res.data?.config ?? defaultOverlayConfig());
        setLeadGateAllowed(res.data?.leadGateAllowed !== false);
      })
      .catch(() => {
        if (!cancelled) {
          // A demo that has never been configured still reads as the defaults
          // from the route, so a failure here is a real one — but it must leave
          // the panel usable rather than blank.
          setConfig(defaultOverlayConfig());
          setError("Could not load overlay settings.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [savedDemoId]);

  /** Patch the lead gate without disturbing the other two sections. */
  const patchGate = useCallback((patch: Partial<LeadGateConfig>) => {
    setSavedAt(null);
    setConfig((prev) => (prev ? { ...prev, leadGate: { ...prev.leadGate, ...patch } } : prev));
  }, []);

  const patchCopy = useCallback((patch: Partial<LeadGateConfig["copy"]>) => {
    setConfig((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, leadGate: { ...prev.leadGate, copy: { ...prev.leadGate.copy, ...patch } } };
    });
    setSavedAt(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!savedDemoId || !config || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The whole object, so branching and scheduling survive a save made from
      // a panel that does not yet render them.
      const res = await axios.put(`/api/demos/${savedDemoId}/overlays`, config);
      // Echo back what was actually stored rather than what was sent: the server
      // sanitiser may have dropped an unusable URL or clamped a number, and the
      // owner should see that immediately instead of on the next page load.
      setConfig(res.data?.config ?? config);
      setSavedAt(Date.now());
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setError(
        status === 403
          ? "The lead capture gate is available on the Pro and Enterprise plans."
          : "Could not save overlay settings."
      );
    } finally {
      setSaving(false);
    }
  }, [config, savedDemoId, saving]);

  if (!savedDemoId) {
    return (
      <div className="space-y-6">
        <h2 className="control-block-label text-lg font-bold text-[#A594F9]">Overlays</h2>
        <p className="text-sm text-gray-400">Save the demo first to configure overlays.</p>
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="space-y-6">
        <h2 className="control-block-label text-lg font-bold text-[#A594F9]">Overlays</h2>
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const gate = config.leadGate;
  const choice = triggerChoice(gate.triggerAt);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-1">Overlays</h2>
        <p className="text-xs text-[#6B6B6B] mb-4">
          Turn your share link into a conversion asset: ask for a lead inside the player, and branch
          viewers to what comes next.
        </p>

        <Toggle
          checked={config.enabled}
          onChange={(enabled) => {
            setConfig({ ...config, enabled });
            setSavedAt(null);
          }}
          label="Enable overlays on this demo"
          hint="Master switch. With this off, nothing below appears to viewers."
        />
      </div>

      <div className="space-y-3 rounded-lg border border-[#ede7fa] bg-[#F6F3FF] p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#7C5CFC]">Lead capture gate</h3>
          {!leadGateAllowed && (
            <span className="rounded-full bg-[#8A76FC] px-2 py-0.5 text-[10px] font-bold text-white">
              PRO
            </span>
          )}
        </div>

        {!leadGateAllowed && (
          <p className="text-[11px] text-gray-500">
            The lead capture gate is available on the Pro and Enterprise plans. Branching cards and
            scheduling stay free on every plan.
          </p>
        )}

        <Toggle
          checked={gate.enabled}
          disabled={!leadGateAllowed}
          onChange={(enabled) => patchGate({ enabled })}
          label="Ask viewers for their details"
        />

        {gate.enabled && (
          <div className="space-y-3 border-t border-[#ede7fa] pt-3">
            <div>
              <label className={labelClass} htmlFor="ovl-mode">
                Mode
              </label>
              <select
                id="ovl-mode"
                value={gate.mode}
                onChange={(e) => patchGate({ mode: e.target.value === "hard" ? "hard" : "soft" })}
                className={inputClass}
              >
                <option value="soft">Soft — viewers can skip</option>
                <option value="hard">Hard — the video stops until they submit</option>
              </select>
              {gate.mode === "hard" && (
                // Said here rather than only in the PR description, because the
                // person who turns this on is the person who will be asked
                // whether it can be got around.
                <p className="mt-1 text-[11px] text-gray-400">
                  A hard gate stops the player, but the video file itself stays publicly reachable —
                  a determined viewer can still find it in the page source.
                </p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="ovl-trigger">
                When it appears
              </label>
              <select
                id="ovl-trigger"
                value={choice}
                onChange={(e) => {
                  const next = e.target.value as TriggerChoice;
                  patchGate({
                    triggerAt:
                      next === "custom" ? { sec: triggerSeconds(gate.triggerAt) || 30 } : next,
                  });
                }}
                className={inputClass}
              >
                <option value="start">Before the video starts</option>
                <option value="mid">Halfway through</option>
                <option value="custom">At a specific time</option>
              </select>
            </div>

            {choice === "custom" && (
              <div>
                <label className={labelClass} htmlFor="ovl-trigger-sec">
                  Seconds from the start
                </label>
                <input
                  id="ovl-trigger-sec"
                  type="number"
                  min={0}
                  max={MAX_TRIGGER_SEC}
                  value={triggerSeconds(gate.triggerAt)}
                  onChange={(e) => patchGate({ triggerAt: { sec: Number(e.target.value) || 0 } })}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  A time past the end of the video is pulled back to the last second of it, so the
                  gate still appears.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <span className={labelClass}>Fields</span>
              <Toggle
                checked={gate.fields.name}
                onChange={(name) => patchGate({ fields: { ...gate.fields, name } })}
                label="Name"
              />
              <Toggle
                checked
                disabled
                onChange={() => {}}
                label="Email"
                hint="Always asked — the email address is the lead."
              />
              <Toggle
                checked={gate.fields.companySize}
                onChange={(companySize) => patchGate({ fields: { ...gate.fields, companySize } })}
                label="Company size"
                hint={`A picker: ${COMPANY_SIZE_BUCKETS.join(", ")}.`}
              />
            </div>

            <Toggle
              checked={gate.requireWorkEmail}
              onChange={(requireWorkEmail) => patchGate({ requireWorkEmail })}
              label="Require a work email"
              hint="Rejects gmail, outlook, proton and other free providers."
            />

            <div className="space-y-2 border-t border-[#ede7fa] pt-3">
              <span className={labelClass}>Wording</span>
              <input
                type="text"
                value={gate.copy.heading}
                onChange={(e) => patchCopy({ heading: e.target.value })}
                placeholder="Heading"
                className={inputClass}
              />
              <textarea
                value={gate.copy.subheading}
                onChange={(e) => patchCopy({ subheading: e.target.value })}
                placeholder="Supporting line"
                rows={2}
                className={inputClass}
              />
              <input
                type="text"
                value={gate.copy.submitLabel}
                onChange={(e) => patchCopy({ submitLabel: e.target.value })}
                placeholder="Submit button"
                className={inputClass}
              />
              {gate.mode === "soft" && (
                <input
                  type="text"
                  value={gate.copy.skipLabel}
                  onChange={(e) => patchCopy({ skipLabel: e.target.value })}
                  placeholder="Skip button"
                  className={inputClass}
                />
              )}
            </div>

            <div className="space-y-2 border-t border-[#ede7fa] pt-3">
              <label className={labelClass} htmlFor="ovl-consent">
                Consent sentence
              </label>
              <textarea
                id="ovl-consent"
                value={gate.consentText}
                onChange={(e) => patchGate({ consentText: e.target.value })}
                rows={3}
                className={inputClass}
              />
              <p className="text-[11px] text-gray-400">
                {"{owner}"} is replaced with your name. Each lead stores the exact sentence that was
                on their screen, so changing this never alters what someone already agreed to.
              </p>
              <p className="rounded-md bg-white px-2 py-1.5 text-[11px] italic text-[#6B5F94]">
                {renderConsentText(gate.consentText)}
              </p>
              <input
                type="url"
                value={gate.privacyPolicyUrl}
                onChange={(e) => patchGate({ privacyPolicyUrl: e.target.value })}
                placeholder="https://yoursite.com/privacy"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-[#8A76FC] py-2 text-sm font-semibold text-white transition hover:bg-[#7C5CFC] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : savedAt ? "Saved" : "Save overlays"}
      </button>
    </div>
  );
};

export default OverlaysPanel;
