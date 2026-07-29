// Normalization for the demo taxonomy that powers the hub's search and filters
// (BDH-4.3 Meta Taxonomy Search, BDH-4.4 Category Collections).
//
// These values are supplied by the client, stored as Postgres TEXT[], and then
// rendered on a public hub page and shipped to every visitor as filter options.
// So they are normalized on the way in rather than trusted:
//
//   - non-strings are dropped, because Prisma rejects them with a 500 rather
//     than a useful validation error;
//   - entries are trimmed and de-duplicated, so "Slack" and " slack " don't
//     become two filter pills;
//   - both the entry count and each entry's length are bounded, so one demo
//     cannot bloat the payload every hub visitor downloads.

export const MAX_TAXONOMY_ENTRIES = 25;
export const MAX_TAXONOMY_LENGTH = 60;

/**
 * Normalize one taxonomy array (tags / integrations / userRoles).
 *
 * Returns `undefined` when the input is not an array at all, which callers use
 * to distinguish "field omitted, leave it alone" from "field set to empty".
 */
export function normalizeTaxonomy(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim().slice(0, MAX_TAXONOMY_LENGTH);
    if (trimmed) {
      seen.add(trimmed);
    }
    if (seen.size >= MAX_TAXONOMY_ENTRIES) {
      break;
    }
  }

  return Array.from(seen);
}
