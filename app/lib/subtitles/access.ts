// Plan gate for subtitle translation.
//
// TRANSLATION IS THE ONLY GATED SURFACE IN THIS FEATURE. Generation, editing,
// timeline retiming, styling and (PR 6) file export are free for every plan
// including FREE and anonymous — see Subtitle-Implementation-Plan.md §3
// decision 2. Do not add a plan check to any other subtitle path.
//
// Translation is gated because it is the one part that spends money per use at
// an external vendor on the user's behalf, in proportion to how long their
// video is.
//
// Mirrors app/lib/avs/access.ts. The User.plan column is a plain string
// defaulting to "FREE" (see prisma/schema.prisma), with paid tiers stored as
// "PRO" / "ENTERPRISE".

const TRANSLATE_ALLOWED_PLANS = ["PRO", "ENTERPRISE"] as const;

/**
 * Whether a user on the given plan may translate subtitles. The route must call
 * this with a plan it re-read from the database — never one the client sent —
 * and return 403 when it is false.
 */
export function isSubtitleTranslateAllowed(plan: string | null | undefined): boolean {
  return typeof plan === "string" && (TRANSLATE_ALLOWED_PLANS as readonly string[]).includes(plan);
}
