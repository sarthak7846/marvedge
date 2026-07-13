// Shared types for AVS (AI Script, Voiceover & Audio Synchronization).
//
// All AVS state is persisted inside the existing Demo.editing JSON under an
// `avs` key (Demo.editing.avs) — there is no dedicated table or migration.
// Downstream stages degrade gracefully when parts are absent (no steps → treat
// the whole video as one step; no script → use the raw transcript; no voiceover
// → skip that stage), so most fields on AvsState are optional.

/** A slice of the demo video, derived from click-capture timestamps and editable in the timeline. */
export interface Step {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  label?: string;
}

/** Narration text for a single step. */
export interface ScriptLine {
  stepId: string;
  text: string;
}

/** The full per-step narration script, optionally rewritten into a tone. */
export interface ScriptDoc {
  tone?: "sales" | "onboarding" | "support" | "marketing";
  lines: ScriptLine[];
  raw?: string;
}

/** Where a step's audio begins and ends within the continuous voiceover track. */
export interface StepTiming {
  stepId: string;
  start: number;
  end: number;
}

/** A generated voiceover: one continuous MP3 plus per-step timing markers. */
export interface VoiceoverTrack {
  audioUrl: string;
  duration: number;
  voiceId: string;
  stepTimings: StepTiming[];
}

/** A phonetic override applied before TTS so a term is pronounced correctly. */
export interface PronunciationRule {
  term: string;
  phonetic: string;
}

/** The complete AVS state stored under Demo.editing.avs. */
export interface AvsState {
  steps: Step[];
  script?: ScriptDoc;
  voiceover?: VoiceoverTrack;
  pronunciation?: PronunciationRule[];
}
