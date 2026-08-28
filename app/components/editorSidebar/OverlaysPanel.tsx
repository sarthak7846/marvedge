"use client";

// The "Overlays" sidebar panel (#302).
//
// PR 3 filled it with the LEAD GATE section: enable, hard/soft, when it appears,
// which fields it asks for, whether a free-mail address is accepted, and every
// word of copy including the consent sentence. PR 5 adds the BRANCHING section
// below it; PR 6 adds a Scheduling one, which already exists in the config type
// and is round-tripped untouched by this panel, so it has to change nothing here
// beyond adding its own block.
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
import {
  defaultOverlayConfig,
  MAX_LEAD_SECONDS,
  MAX_TRIGGER_SEC,
  MIN_LEAD_SECONDS,
  sanitizeBranchTarget,
} from "@/app/lib/overlays/config";
import { COMPANY_SIZE_BUCKETS, renderConsentText } from "@/app/lib/overlays/leadGate";
import type {
  BranchCard,
  BranchTarget,
  BranchingConfig,
  LeadGateConfig,
  LeadGateTrigger,
  OverlayConfig,
} from "@/app/lib/overlays/types";

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

/**
 * The stored form of a typed URL, or "" — run through the SAME sanitiser the PUT
 * route enforces with, so what the panel accepts and what the server stores can
 * never disagree.
 */
function sanitizeUrlTarget(raw: string): string {
  const target = sanitizeBranchTarget({ kind: "url", href: raw });
  return target && target.kind === "url" ? target.href : "";
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

/** What the demo picker needs from GET .../overlays/branch-targets. */
type BranchTargetOption = { id: string; title: string; publicLink: string | null };

/**
 * One card's editor: label, supporting line, artwork, and where it goes.
 *
 * IT VALIDATES THROUGH sanitizeBranchTarget() — THE SAME FUNCTION THE PUT ROUTE
 * ENFORCES WITH. A URL that would be dropped on save is refused here, in front
 * of the owner, rather than quietly disabling their cards the next time a viewer
 * loads the page. The two choices offered are exactly the two variants in the
 * type: another demo of their own, or an https link. There is no third.
 */
const BranchCardEditor: React.FC<{
  title: string;
  card: BranchCard;
  options: BranchTargetOption[];
  onChange: (patch: Partial<BranchCard>) => void;
}> = ({ title, card, options, onChange }) => {
  const kind = card.target.kind;
  const [urlDraft, setUrlDraft] = useState(kind === "url" ? card.target.href : "");

  const setKind = (next: BranchTarget["kind"]) => {
    onChange({
      target:
        next === "demo"
          ? { kind: "demo", demoId: "" }
          : { kind: "url", href: sanitizeUrlTarget(urlDraft) },
    });
  };

  const commitUrl = (raw: string) => {
    setUrlDraft(raw);
    // The unusable value is kept OUT of the config rather than stored and
    // dropped later: sanitizeBranching() forces the whole section off when a
    // target does not survive, so a half-typed URL would otherwise switch the
    // cards off under the owner while they were still typing the rest of it.
    onChange({ target: { kind: "url", href: sanitizeUrlTarget(raw) } });
  };

  const urlRejected = kind === "url" && urlDraft.trim().length > 0 && !sanitizeUrlTarget(urlDraft);

  return (
    <div className="space-y-2 rounded-md border border-[#ede7fa] bg-white p-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#A594F9]">{title}</span>

      <input
        type="text"
        value={card.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Card title"
        className={inputClass}
      />
      <input
        type="text"
        value={card.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Supporting line (optional)"
        className={inputClass}
      />
      <input
        type="url"
        value={card.thumbnailUrl}
        onChange={(e) => onChange({ thumbnailUrl: e.target.value })}
        placeholder="https://…/thumbnail.png (optional)"
        className={inputClass}
      />

      <select
        value={kind}
        onChange={(e) => setKind(e.target.value === "demo" ? "demo" : "url")}
        className={inputClass}
      >
        <option value="demo">Send them to another demo</option>
        <option value="url">Send them to a link</option>
      </select>

      {kind === "demo" ? (
        options.length > 0 ? (
          <select
            value={card.target.kind === "demo" ? card.target.demoId : ""}
            onChange={(e) => onChange({ target: { kind: "demo", demoId: e.target.value } })}
            className={inputClass}
          >
            <option value="">Choose a demo…</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title || "Untitled demo"}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[11px] text-gray-400">
            You have no other public demos yet. Share a second demo publicly and it will show up
            here.
          </p>
        )
      ) : (
        <>
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => commitUrl(e.target.value)}
            placeholder="https://yoursite.com/pricing"
            className={inputClass}
          />
          {urlRejected && (
            <p className="text-[11px] text-red-600">
              That has to be an https link, with no username or password in it.
            </p>
          )}
        </>
      )}
    </div>
  );
};

const OverlaysPanel: React.FC = () => {
  const savedDemoId = useEditorStore((s) => s.savedDemoId);

  const [config, setConfig] = useState<OverlayConfig | null>(null);
  const [leadGateAllowed, setLeadGateAllowed] = useState(true);
  const [branchTargets, setBranchTargets] = useState<BranchTargetOption[]>([]);
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

  // The picker's options, fetched separately so a failure here leaves the rest of
  // the panel working — an owner with no list can still set a URL target.
  useEffect(() => {
    if (!savedDemoId) {
      setBranchTargets([]);
      return;
    }
    let cancelled = false;
    axios
      .get(`/api/demos/${savedDemoId}/overlays/branch-targets`)
      .then((res) => {
        if (!cancelled) {
          setBranchTargets(res.data?.demos ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranchTargets([]);
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

  const patchBranching = useCallback((patch: Partial<BranchingConfig>) => {
    setSavedAt(null);
    setConfig((prev) => (prev ? { ...prev, branching: { ...prev.branching, ...patch } } : prev));
  }, []);

  const patchBranchCard = useCallback((slot: "a" | "b", patch: Partial<BranchCard>) => {
    setSavedAt(null);
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            branching: { ...prev.branching, [slot]: { ...prev.branching[slot], ...patch } },
          }
        : prev
    );
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
  const branching = config.branching;
  // Mirrors sanitizeBranching()'s all-or-nothing rule, so the reason the section
  // refuses to switch itself on is visible here rather than only after a save.
  const bothTargetsSet =
    sanitizeBranchTarget(branching.a.target) !== undefined &&
    sanitizeBranchTarget(branching.b.target) !== undefined;

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

      <div className="space-y-3 rounded-lg border border-[#ede7fa] bg-[#F6F3FF] p-3">
        <h3 className="text-sm font-semibold text-[#7C5CFC]">Branching cards</h3>
        <p className="text-[11px] text-gray-500">
          Two choices in the final seconds, staying up after the video ends. Free on every plan.
          Clicks count as CTA clicks on your analytics page.
        </p>

        <Toggle
          checked={branching.enabled}
          onChange={(enabled) => patchBranching({ enabled })}
          label="Offer two choices near the end"
        />

        {branching.enabled && (
          <div className="space-y-3 border-t border-[#ede7fa] pt-3">
            <div>
              <label className={labelClass} htmlFor="ovl-lead-seconds">
                Seconds before the end
              </label>
              <input
                id="ovl-lead-seconds"
                type="number"
                min={MIN_LEAD_SECONDS}
                max={MAX_LEAD_SECONDS}
                value={branching.leadSeconds}
                onChange={(e) =>
                  patchBranching({ leadSeconds: Number(e.target.value) || MIN_LEAD_SECONDS })
                }
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                On a video shorter than this, the cards wait until it ends rather than covering it
                from the first frame.
              </p>
            </div>

            <BranchCardEditor
              title="Card A"
              card={branching.a}
              options={branchTargets}
              onChange={(patch) => patchBranchCard("a", patch)}
            />
            <BranchCardEditor
              title="Card B"
              card={branching.b}
              options={branchTargets}
              onChange={(patch) => patchBranchCard("b", patch)}
            />

            {!bothTargetsSet && (
              <p className="text-[11px] text-amber-700">
                Both cards need a destination before either will show. One choice is not a choice.
              </p>
            )}
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
