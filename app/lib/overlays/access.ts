// PRO-gate for the parts of OVL that are gated. Mirrors `app/lib/avs/access.ts`:
// available to PRO and ENTERPRISE users only.
//
// WHAT THIS GATES, precisely: the LEAD GATE and CRM DELIVERY. Those are the
// revenue features and the ones carrying the PII and egress cost.
//
// WHAT IT DOES NOT GATE: branching cards and the scheduling overlay, which are
// free on every plan. Branch cards are `Cta` rows, and CTAs are free today —
// gating them would REMOVE functionality FREE users already have, which is
// never an acceptable side effect of shipping a feature.
//
// Always re-resolve the plan server-side from `User.plan` before calling this.
// A plan sent by the client is a suggestion, not a fact.
//
// The User.plan column is a plain string defaulting to "FREE" (see
// prisma/schema.prisma), with paid tiers stored as "PRO" / "ENTERPRISE".

const OVERLAYS_ALLOWED_PLANS = ["PRO", "ENTERPRISE"] as const;

/**
 * Whether a user on the given plan may use the lead gate and CRM delivery.
 * Server routes should call this after resolving the user's plan and return 403
 * when it returns false.
 */
export function isOverlaysAllowed(plan: string | null | undefined): boolean {
  return typeof plan === "string" && (OVERLAYS_ALLOWED_PLANS as readonly string[]).includes(plan);
}
