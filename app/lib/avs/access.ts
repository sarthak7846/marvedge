// PRO-gate for AVS. Access mirrors the plan check used by the export path
// (`isExportAllowed` in app/api/jobs/create/route.ts): AVS is available to
// PRO and ENTERPRISE users only. The free 3-export limit is unaffected.
//
// The User.plan column is a plain string defaulting to "FREE" (see
// prisma/schema.prisma), with paid tiers stored as "PRO" / "ENTERPRISE".

const AVS_ALLOWED_PLANS = ["PRO", "ENTERPRISE"] as const;

/**
 * Whether a user on the given plan may use AVS. Server routes should call this
 * after resolving the user's plan and return 403 when it returns false.
 */
export function isAvsAllowed(plan: string | null | undefined): boolean {
  return typeof plan === "string" && (AVS_ALLOWED_PLANS as readonly string[]).includes(plan);
}
