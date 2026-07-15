// Deepgram Aura voice catalog for the AVS voiceover (AVS-2.2).
//
// Shared by the client (the voice picker in AvsPanel) and the server
// (`/api/avs/voiceover` validation), so the exposed list stays in sync. The
// same ids are allow-listed in the Cloud Run worker (cloudrun-worker/server.js),
// which is where the actual Deepgram Aura `/v1/speak` call happens. No secrets
// here — safe to import from client code.

/** A selectable Deepgram Aura voice: the model id plus display metadata. */
export interface VoiceOption {
  /** Deepgram Aura model id, e.g. `aura-2-thalia-en`. */
  id: string;
  /** Friendly name shown in the picker. */
  label: string;
  /** Short description (accent / character) shown under the name. */
  description: string;
}

export const AVS_VOICES: VoiceOption[] = [
  {
    id: "aura-2-thalia-en",
    label: "Thalia",
    description: "Clear, confident — American female",
  },
  {
    id: "aura-2-andromeda-en",
    label: "Andromeda",
    description: "Casual, expressive — American female",
  },
  {
    id: "aura-2-helena-en",
    label: "Helena",
    description: "Warm, caring — American female",
  },
  {
    id: "aura-2-apollo-en",
    label: "Apollo",
    description: "Confident, grounded — American male",
  },
  {
    id: "aura-2-arcas-en",
    label: "Arcas",
    description: "Natural, smooth — American male",
  },
];

/** Default voice used when none is selected or the given id is unknown. */
export const DEFAULT_AVS_VOICE = AVS_VOICES[0].id;

const VOICE_IDS = new Set(AVS_VOICES.map((v) => v.id));

/** Type guard: whether an unknown value is a supported Aura voice id. */
export function isAvsVoiceId(value: unknown): value is string {
  return typeof value === "string" && VOICE_IDS.has(value);
}
