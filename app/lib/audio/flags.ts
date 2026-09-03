// Feature flags for the Audio Upload & Trim feature (GitHub #285).
//
// UNLIKE the AVS/WTM flags, the audio feature DEFAULTS TO ON when blank or
// unset — the feature was shipped and needs to be visible on deployment. The
// flag exists to disable it during an incident rather than to roll it out.
//   - AUDIO_UPLOAD_ENABLED             — server-only master switch.
//   - NEXT_PUBLIC_AUDIO_UPLOAD_ENABLED — client-safe switch that gates the panel.
//
// Explicit "true" / "1" = on, explicit "false" / "0" = off, unset/blank = on.

const truthy = (value: string | undefined): boolean => value !== "false" && value !== "0";

/**
 * Server-side master switch. Reads the server-only `AUDIO_UPLOAD_ENABLED` env
 * var, so this must only be called from server code (API routes, server
 * components, workers). Defaults to ON when unset.
 */
export function isAudioUploadEnabled(): boolean {
  return truthy(process.env.AUDIO_UPLOAD_ENABLED);
}

/**
 * Client-safe flag that gates the "Audio" sidebar panel. Reads
 * `NEXT_PUBLIC_AUDIO_UPLOAD_ENABLED`, which Next inlines at build time so it is
 * safe to call from client components. Never exposes a real secret.
 * Defaults to ON when unset.
 */
export function isAudioPanelEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_AUDIO_UPLOAD_ENABLED);
}
