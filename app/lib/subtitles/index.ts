// Public surface of the subtitle library. Import from here rather than reaching
// into the individual modules, so the internal split can change without a rename
// sweep across the app.
//
// Everything behind this barrel is isomorphic and pure: no fs, no env beyond the
// flags module, no DOM, no node-only API. One code path has to serve a React
// component, a route handler and (serialized) the render worker.

export {
  MIN_CUE_SECONDS,
  cuesToSearchText,
  deleteCue,
  findActiveCue,
  insertCue,
  mergeCues,
  normalizeCues,
  readCueList,
  splitCueAt,
  type NormalizeCuesOptions,
} from "./cues";

export {
  cuesToSrt,
  cuesToTxt,
  cuesToVtt,
  formatSrtTimestamp,
  formatVttTimestamp,
  parseSrt,
  parseSubtitleFile,
  parseVtt,
} from "./formats";

export { isSubtitleEditorEnabled, isSubtitleTranslateEnabled } from "./flags";

export {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_ALIGNMENTS,
  SUBTITLE_ANIMATIONS,
  SUBTITLE_ANIMATION_KEYFRAMES,
  SUBTITLE_FONTS,
  SUBTITLE_FONT_LABELS,
  SUBTITLE_FONT_NAMES,
  SUBTITLE_FONT_PCT_MAX,
  SUBTITLE_FONT_PCT_MIN,
  SUBTITLE_FONT_PX_MAX,
  SUBTITLE_FONT_PX_MIN,
  SUBTITLE_SIZE_REFERENCE_HEIGHT,
  assColourToHex,
  exportFrameHeight,
  fontPctToSliderPx,
  hexToAssColour,
  hexToRgba,
  isSubtitleAlignment,
  isSubtitleAnimation,
  isSubtitleFont,
  sanitizeSubtitleStyle,
  sliderPxToFontPct,
  subtitleMetrics,
  toAssOverrideTags,
  toAssStyleLine,
  toCssAnimation,
  toCssStyle,
  type DefaultSubtitleStyle,
  type SubtitleCssStyle,
  type SubtitleFont,
  type SubtitleMetrics,
} from "./style";

export {
  AUTO_DETECT_LANGUAGE,
  SUBTITLE_LANGUAGES,
  findLanguage,
  isAutoDetect,
  isRtlLanguage,
  isSttOffered,
  isSupportedLanguage,
  languageLabel,
  normalizeLanguage,
} from "./languages";

export type {
  SttCoverage,
  SubtitleAlignment,
  SubtitleAnimation,
  SubtitleCue,
  SubtitleLanguage,
  SubtitleStyle,
  SubtitleTrack,
  SubtitleTrackSource,
  SubtitleTrackStatus,
} from "./types";
