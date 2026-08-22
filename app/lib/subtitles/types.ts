// Shared types for the AI Subtitle Generator (SUB).
//
// Everything downstream — the editor panel, the timeline track, the style panel,
// the translation route and the export serializers — imports its vocabulary from
// here so the same cue never gets described two slightly different ways.
//
// This module is isomorphic: no env, no fs, no DOM. It is imported by a React
// component, by a route handler, and (serialized) by the render worker alike.

import type { SubtitleCue } from "@/app/(signed)/editor/types";

/**
 * A single subtitle: `text` shown from `start` to `end` (both in seconds).
 *
 * Re-exported rather than redeclared. The editor, the autosave draft
 * (`editing.subtitles`), the export recipe and the worker all already speak this
 * exact shape; a second, subtly different declaration is how the two halves of a
 * feature drift apart.
 */
export type { SubtitleCue };

/**
 * Where a track's cues came from.
 *
 * `stt`         — transcribed from the video's audio (Deepgram, via the worker).
 * `translation` — machine-translated from another track (PR 5).
 * `manual`      — typed or edited by the user.
 */
export type SubtitleTrackSource = "stt" | "translation" | "manual";

/** Lifecycle of a track row. Mirrors the `status` column's string domain. */
export type SubtitleTrackStatus = "PENDING" | "READY" | "FAILED";

/**
 * One subtitle track: every cue for a single (demo, language) pair.
 *
 * This mirrors the `SubtitleTrack` Prisma model — one row per language, holding
 * the whole cue array as JSON, rather than the PRD's per-segment table. Cues are
 * always read and written as a whole array (the editor loads all of them, the
 * export ships all of them), so per-segment rows would mean thousands of inserts
 * and a join on every render for no query benefit. This is a deliberate,
 * signed-off deviation from PRD §10 — see Subtitle-Implementation-Plan.md §3
 * decision 5.
 */
export interface SubtitleTrack {
  id: string;
  demoId: string;
  /** BCP-47 code, or `"multi"` for an auto-detected track. See ./languages. */
  language: string;
  status: SubtitleTrackStatus;
  source: SubtitleTrackSource;
  cues: SubtitleCue[];
  createdAt?: string;
  updatedAt?: string;
}

/** A language the subtitle feature can generate, translate or display. */
export interface SubtitleLanguage {
  /** BCP-47 code sent to the STT provider and stored on the track. */
  code: string;
  /** English display name for the picker. */
  label: string;
  /** Name in the language itself, shown as the picker's secondary line. */
  nativeLabel: string;
  /** Right-to-left script — the preview and the burn-in both need to know. */
  isRtl: boolean;
  /** How far this language's speech-to-text coverage has been checked. */
  stt: SttCoverage;
}

/**
 * How confident we are that speech-to-text actually works for a language.
 *
 * `documented`  — listed as covered by the provider's model matrix, but not yet
 *                 round-tripped end to end on real audio.
 * `unverified`  — coverage is an open question. Do not offer it in a picker.
 *
 * There is deliberately no `verified` value yet: nothing in this PR runs audio
 * through the worker, so claiming verification here would be a claim nobody has
 * earned. PR 5 introduces it as it round-trips each language.
 */
export type SttCoverage = "documented" | "unverified";

/** Where a subtitle sits vertically in the frame. */
export type SubtitleAlignment = "top" | "middle" | "bottom";

/** On-screen entrance effect for a cue. */
export type SubtitleAnimation = "none" | "fade" | "pop" | "slide";

/**
 * User-controlled subtitle appearance, persisted to `editing.subtitleStyle`
 * (JSON — no migration, exactly like `editing.wtm` and `editing.avs`).
 *
 * **Sizes here are resolution-independent on purpose.** `fontSizePct` is a
 * percentage of the frame height, not pixels: "24px" means one thing on a 640px
 * preview and something else on a 1920px export, and the preview/burn-in pair
 * only stays honest if the stored value is the one that survives scaling. The
 * px value the PRD's 12–72 slider shows is derived at the edges — see
 * Subtitle-Implementation-Plan.md §2.3.
 *
 * Every field is optional and every consumer must fall back to today's hardcoded
 * appearance when it is absent, so a demo saved before this feature exports
 * byte-identically. PR 4 owns the defaults, the sanitizer, the CSS mapping and
 * the ASS mapping; this type is declared here so the shape is agreed on once.
 */
export interface SubtitleStyle {
  /** Font family key resolved by the worker (`arial | roboto | inter | poppins`). */
  fontFamily?: string;
  /** Font size as a percentage of frame height (see the note above). */
  fontSizePct?: number;
  /** Text fill, `#RRGGBB`. */
  color?: string;
  /** Box fill behind the text, `#RRGGBB`. Absent → no box. */
  backgroundColor?: string;
  /** Box opacity, 0–1. */
  backgroundOpacity?: number;
  /** Outline thickness as a fraction of the font size. */
  outlineWidth?: number;
  /** Outline colour, `#RRGGBB`. */
  outlineColor?: string;
  /** Drop-shadow depth as a fraction of the font size. */
  shadowDepth?: number;
  alignment?: SubtitleAlignment;
  animation?: SubtitleAnimation;
}
