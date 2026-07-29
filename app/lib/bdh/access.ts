// PRO-gate for BDH custom domains, mirroring the split WTM uses.
//
// The hub itself is free for everyone: any user gets a branded showcase at their
// Marvedge subdomain (`acme.marvedge.com`), with logo, colours, search and
// collections. That is the growth surface and gating it would defeat the point.
//
// Mapping your OWN domain (`demos.mycompany.com`) is the paid, white-label half.
// It is also the only part with a marginal cost to us — Cloudflare SSL for SaaS
// bills per custom hostname — so an unbounded free tier would let anyone spend
// our money. PRO and ENTERPRISE only, exactly like the customizable watermark.
//
// The User.plan column is a plain string defaulting to "FREE" (see
// prisma/schema.prisma), with paid tiers stored as "PRO" / "ENTERPRISE".

const CUSTOM_DOMAIN_ALLOWED_PLANS = ["PRO", "ENTERPRISE"] as const;

/**
 * Whether a user on the given plan may map a custom domain to their hub. Server
 * routes should call this after resolving the user's plan and reject when it
 * returns false; the hub and its Marvedge subdomain stay available regardless.
 */
export function isCustomDomainAllowed(plan: string | null | undefined): boolean {
  return (
    typeof plan === "string" && (CUSTOM_DOMAIN_ALLOWED_PLANS as readonly string[]).includes(plan)
  );
}
