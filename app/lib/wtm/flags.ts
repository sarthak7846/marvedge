// Feature flags for WTM (Automated Video Watermarking & Compositing).
//
// WTM ships behind a flag and must be a no-op when the flag is off — including
// the free-tier watermark, which only applies once enabled. There are two flags
// so that server work (the render/plan logic) and the client UI panel can be
// toggled independently:
//   - WTM_ENABLED            — server-only master switch (never sent to browser).
//   - NEXT_PUBLIC_WTM_ENABLED — client-safe switch that gates the sidebar panel.

const truthy = (value: string | undefined): boolean => value === "true" || value === "1";

/**
 * Server-side WTM master switch. Reads the server-only `WTM_ENABLED` env var, so
 * this must only be called from server code (API routes, server components).
 */
export function isWtmEnabled(): boolean {
  return truthy(process.env.WTM_ENABLED);
}

/**
 * Client-safe flag that gates the "Branding" sidebar panel. Reads
 * `NEXT_PUBLIC_WTM_ENABLED`, which Next inlines at build time so it is safe to
 * call from client components. Never exposes a real secret.
 */
export function isWtmPanelEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_WTM_ENABLED);
}
