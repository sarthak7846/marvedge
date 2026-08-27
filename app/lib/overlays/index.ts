// Public surface of the overlays library. Import from here rather than reaching
// into the individual modules, so the internal split can change without a rename
// sweep across the app.
//
// Everything re-exported here is isomorphic — no `next/server`, no node
// builtins, no DOM — so a client component, a route handler and the editor can
// all import from this one barrel. `process.env` is read in flags.ts and nowhere
// else; the NEXT_PUBLIC_ half of that is inlined at build time and safe on the
// client.
//
// ONE MODULE IS DELIBERATELY MISSING: ./beacon. It reaches for `navigator` and
// `fetch`, so re-exporting it here would quietly make this barrel non-isomorphic
// for everyone importing anything from it. Import it by path.

export {
  DEFAULT_CONSENT_TEXT,
  DEFAULT_LEAD_SECONDS,
  DEFAULT_OVERLAY_CONFIG,
  MAX_LEAD_SECONDS,
  MAX_TRIGGER_SEC,
  MIN_LEAD_SECONDS,
  SCHEDULING_HOSTS,
  clamp,
  defaultOverlayConfig,
  overlayConfigFromRow,
  overlayConfigToRow,
  sanitizeBranchTarget,
  sanitizeBranching,
  sanitizeLeadGate,
  sanitizeOverlayConfig,
  sanitizeScheduling,
  sanitizeSchedulingUrl,
  toHttpUrl,
  type OverlayConfigRow,
} from "./config";

export {
  MAX_EVENTS_PER_BATCH,
  MAX_META_BYTES,
  PLAYER_EVENT_NAMES,
  isPlayerEventName,
  parsePlayerEventBatch,
  playerEventBatchSchema,
  playerEventSchema,
  selectKnownEvents,
  type NormalizedPlayerEvent,
  type ParsedBatch,
  type PlayerEventBatch,
  type PlayerEventName,
  type SelectedEvents,
} from "./events";

export {
  COMPLETION_RATIO,
  SEEK_STEP_SECONDS,
  bufferedEndAt,
  clampSeek,
  completionThresholdSec,
  crossedThreshold,
  formatClock,
  isCompleted,
  progressFraction,
  trackFraction,
  type BufferedRange,
} from "./playback";

export {
  OVERLAY_PRIORITY,
  areControlsLocked,
  resolveActiveOverlay,
  shouldHoldPlayback,
  type OverlayKind,
  type OverlaySlot,
} from "./overlayHost";

export { classifySource, isHlsUrl, type PlayerSourceKind } from "./source";

export { isOverlaysCrmEnabled, isOverlaysEnabled, isOverlaysPanelEnabled } from "./flags";

export { isOverlaysAllowed } from "./access";

export {
  SID_COOKIE,
  SID_COOKIE_OPTIONS,
  SID_MAX_AGE,
  applySessionCookie,
  readOrMintSessionId,
  type SessionCookieRequest,
  type SessionCookieResponse,
  type ViewerSession,
} from "./session";

export type {
  BranchCard,
  BranchTarget,
  BranchingConfig,
  LeadGateConfig,
  LeadGateCopy,
  LeadGateFields,
  LeadGateMode,
  LeadGateTrigger,
  OverlayConfig,
  SchedulingConfig,
  SchedulingProvider,
} from "./types";
