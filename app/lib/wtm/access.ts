// PRO-gate for WTM. Access mirrors the plan check used by the export path
// (`isExportAllowed` in app/api/jobs/create/route.ts): the customizable
// watermark controls — uploading a custom logo, changing opacity, and REMOVING
// the watermark — are available to PRO and ENTERPRISE users only.
//
// The forced free-tier Marvedge watermark is the monetization path and is
// decided server-side in jobs/create for everyone on FREE; this gate only
// governs the paid customization/removal, not that forced default.
//
// The User.plan column is a plain string defaulting to "FREE" (see
// prisma/schema.prisma), with paid tiers stored as "PRO" / "ENTERPRISE".

const WTM_ALLOWED_PLANS = ["PRO", "ENTERPRISE"] as const;

/**
 * Whether a user on the given plan may customize or remove the watermark. Server
 * routes should call this after resolving the user's plan and reject (or fall
 * back to the forced default) when it returns false.
 */
export function isWtmAllowed(plan: string | null | undefined): boolean {
  return typeof plan === "string" && (WTM_ALLOWED_PLANS as readonly string[]).includes(plan);
}
