// Feature flags for BDH (Branded Demo Hub & Hosting Infrastructure).
//
// Unlike AVS and WTM, BDH is opt-OUT rather than opt-in: it already shipped to
// master and is serving traffic, so an unset env var must keep it working. Only
// an explicit "false"/"0" disables it. The flag exists as an ops lever — hub
// routing lives in middleware and affects every request, so being able to switch
// it off without a revert is worth the indirection.
//
//   - BDH_ENABLED             — server-only master switch (never sent to browser).
//   - NEXT_PUBLIC_BDH_ENABLED — client-safe switch; also read by middleware,
//                               which needs a build-inlined value at the edge.

const disabled = (value: string | undefined): boolean => value === "false" || value === "0";

/**
 * Server-side BDH master switch, gating the hub settings and domain APIs. Reads
 * the server-only `BDH_ENABLED` env var, so this must only be called from server
 * code (API routes, server components).
 */
export function isBdhEnabled(): boolean {
  return !disabled(process.env.BDH_ENABLED);
}

/**
 * Client-safe switch gating hub host routing and the Branding settings tab.
 * Reads `NEXT_PUBLIC_BDH_ENABLED`, which Next inlines at build time so it is
 * safe to call from client components and from middleware at the edge.
 */
export function isBdhRoutingEnabled(): boolean {
  return !disabled(process.env.NEXT_PUBLIC_BDH_ENABLED);
}
