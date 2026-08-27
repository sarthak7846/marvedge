// Feature flags for the Audio Upload & Trim feature (GitHub #285).
//
// Follows the exact pattern used by AVS (`app/lib/avs/flags.ts`) and WTM
// (`app/lib/wtm/flags.ts`): the feature ships behind a flag and must be a
// complete no-op when the flag is off. Two flags so server work (API routes +
// job enqueueing) and the client UI (the "Audio" sidebar panel) can be toggled
// independently:
//   - AUDIO_UPLOAD_ENABLED             — server-only master switch.
//   - NEXT_PUBLIC_AUDIO_UPLOAD_ENABLED — client-safe switch that gates the panel.

const truthy = (value: string | undefined): boolean => value === "true" || value === "1";

/**
 * Server-side master switch. Reads the server-only `AUDIO_UPLOAD_ENABLED` env
 * var, so this must only be called from server code (API routes, server
 * components, workers).
 */
export function isAudioUploadEnabled(): boolean {
  return truthy(process.env.AUDIO_UPLOAD_ENABLED);
}

/**
 * Client-safe flag that gates the "Audio" sidebar panel. Reads
 * `NEXT_PUBLIC_AUDIO_UPLOAD_ENABLED`, which Next inlines at build time so it is
 * safe to call from client components. Never exposes a real secret.
 */
export function isAudioPanelEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_AUDIO_UPLOAD_ENABLED);
}
