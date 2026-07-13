// Feature flags for AVS (AI Script, Voiceover & Audio Synchronization).
//
// AVS ships behind a flag and must be a no-op when the flag is off. There are
// two flags so that server work (AI/TTS routes) and the client UI panel can be
// toggled independently:
//   - AVS_ENABLED            — server-only master switch (never sent to browser).
//   - NEXT_PUBLIC_AVS_ENABLED — client-safe switch that gates the sidebar panel.

const truthy = (value: string | undefined): boolean => value === "true" || value === "1";

/**
 * Server-side AVS master switch. Reads the server-only `AVS_ENABLED` env var, so
 * this must only be called from server code (API routes, server components).
 */
export function isAvsEnabled(): boolean {
  return truthy(process.env.AVS_ENABLED);
}

/**
 * Client-safe flag that gates the "AI Voice & Script" sidebar panel. Reads
 * `NEXT_PUBLIC_AVS_ENABLED`, which Next inlines at build time so it is safe to
 * call from client components. Never exposes a real secret.
 */
export function isAvsPanelEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_AVS_ENABLED);
}
