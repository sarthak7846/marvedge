// The languages the subtitle feature offers, per PRD §6.6.
//
// Pure data + lookups. No env, no network — the picker, the generation route and
// the translation route all read the same table so a code can never mean one
// thing in the UI and another on the wire.

import type { SubtitleLanguage } from "./types";

/**
 * Sentinel the client sends when it wants the provider to detect the language
 * itself. The worker turns this into Deepgram's `detect_language=true` rather
 * than an explicit `language=` parameter.
 *
 * This is what `useSubtitles.ts` has always sent and what existing tracks are
 * stored under, so it stays valid alongside the real BCP-47 codes below. It is
 * NOT a member of `SUBTITLE_LANGUAGES` — you cannot translate *into* "detect".
 */
export const AUTO_DETECT_LANGUAGE = "multi";

/**
 * The seven PRD languages, in picker order (English first, then the rest by
 * PRD §6.6's own ordering).
 *
 * ABOUT `stt`
 * -----------
 * `documented` means the provider's model matrix lists the language for the
 * model the worker uses (`nova-2`) — see Subtitle-Implementation-Plan.md §2.4.
 * It does **not** mean anyone has pushed real audio through the pipeline and
 * read the cues back. There is intentionally no `verified` value in this PR:
 * nothing here touches the worker, so verification is not ours to claim. PR 5
 * owns round-tripping each language and promoting these markers.
 *
 * A picker entry that silently returns empty cues is worse than an absent one,
 * so gate the UI on `isSttOffered()` rather than on this list directly.
 */
export const SUBTITLE_LANGUAGES: readonly SubtitleLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", isRtl: false, stt: "documented" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", isRtl: false, stt: "documented" },
  { code: "es", label: "Spanish", nativeLabel: "Español", isRtl: false, stt: "documented" },
  { code: "fr", label: "French", nativeLabel: "Français", isRtl: false, stt: "documented" },
  { code: "de", label: "German", nativeLabel: "Deutsch", isRtl: false, stt: "documented" },
  // TODO(PR 5): Arabic's speech-to-text coverage is UNRESOLVED. Deepgram's
  // nova-2 matrix has not been checked for `ar`, and §2.4 of the implementation
  // plan flags it as the one real risk in the set. PR 5 must either confirm it
  // end to end, route Arabic to a model that does cover it, or fall back to
  // OpenAI Whisper — and only then promote this marker. Until it does,
  // `isSttOffered("ar")` is false and Arabic stays out of the generation picker.
  // Translation *into* Arabic is unaffected: that path never touches STT.
  { code: "ar", label: "Arabic", nativeLabel: "العربية", isRtl: true, stt: "unverified" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", isRtl: false, stt: "documented" },
];

/** Look up a language by BCP-47 code. Case-insensitive; `undefined` if unknown. */
export function findLanguage(code: string): SubtitleLanguage | undefined {
  const needle = code.trim().toLowerCase();
  return SUBTITLE_LANGUAGES.find((lang) => lang.code === needle);
}

/** Whether `code` is one of the seven supported languages. */
export function isSupportedLanguage(code: string): boolean {
  return findLanguage(code) !== undefined;
}

/** Whether `code` asks the provider to detect the language itself. */
export function isAutoDetect(code: string): boolean {
  return code.trim().toLowerCase() === AUTO_DETECT_LANGUAGE;
}

/**
 * Whether this language may be offered for *generation*. Auto-detect always
 * qualifies (it is what ships today); a real language qualifies once its STT
 * coverage is better than `unverified`.
 */
export function isSttOffered(code: string): boolean {
  if (isAutoDetect(code)) {
    return true;
  }
  return findLanguage(code)?.stt === "documented";
}

/** Whether a language's script runs right to left (Arabic, of the seven). */
export function isRtlLanguage(code: string): boolean {
  return findLanguage(code)?.isRtl ?? false;
}

/**
 * Coerce a client-supplied language to something safe to send to the worker.
 * Anything unrecognised falls back to auto-detect — which is exactly today's
 * behaviour, so an old client that sends nothing keeps working.
 */
export function normalizeLanguage(raw: unknown): string {
  if (typeof raw !== "string") {
    return AUTO_DETECT_LANGUAGE;
  }
  const code = raw.trim().toLowerCase();
  if (!code || isAutoDetect(code)) {
    return AUTO_DETECT_LANGUAGE;
  }
  return isSupportedLanguage(code) ? code : AUTO_DETECT_LANGUAGE;
}

/** Display name for a code, falling back to the code itself. */
export function languageLabel(code: string): string {
  if (isAutoDetect(code)) {
    return "Auto-detect";
  }
  return findLanguage(code)?.label ?? code;
}
