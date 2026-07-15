// Script tones for the AVS AI rewrite (AVS-2.1).
//
// Shared by the client (the tone selector in AvsPanel) and the server
// (`/api/avs/script` validation + prompt building), so the list stays in sync.
// No secrets here — safe to import from client code.

import type { ScriptDoc } from "@/app/types/avs";

/** The tone id used on `ScriptDoc.tone`. */
export type ScriptTone = NonNullable<ScriptDoc["tone"]>;

/** A selectable tone: its id, the label shown in the panel, and a rewrite hint. */
export interface ToneOption {
  id: ScriptTone;
  label: string;
  /** Short guidance handed to the model to shape the rewrite. */
  guidance: string;
}

export const SCRIPT_TONES: ToneOption[] = [
  {
    id: "sales",
    label: "Sales",
    guidance:
      "Persuasive and benefit-driven. Lead with value, build desire, and nudge toward action — confident but not pushy.",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    guidance:
      "Friendly and guiding, as if walking a brand-new user through the product step by step. Warm, clear, and reassuring.",
  },
  {
    id: "support",
    label: "Support",
    guidance:
      "Calm, clear, and helpful, like a patient support agent. Reduce confusion and reassure the viewer at each step.",
  },
  {
    id: "marketing",
    label: "Marketing",
    guidance:
      "Punchy and energetic, brand-forward and memorable. Emphasize the wow moments while staying honest.",
  },
];

const TONE_IDS = SCRIPT_TONES.map((t) => t.id);

/** Type guard: whether an unknown value is a supported tone id. */
export function isScriptTone(value: unknown): value is ScriptTone {
  return typeof value === "string" && (TONE_IDS as string[]).includes(value);
}

/** Look up a tone's guidance for prompt building; falls back to the first tone. */
export function toneGuidance(tone: ScriptTone): string {
  return (SCRIPT_TONES.find((t) => t.id === tone) ?? SCRIPT_TONES[0]).guidance;
}
