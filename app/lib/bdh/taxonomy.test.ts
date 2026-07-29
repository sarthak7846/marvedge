import { describe, expect, it } from "vitest";
import { MAX_TAXONOMY_ENTRIES, MAX_TAXONOMY_LENGTH, normalizeTaxonomy } from "./taxonomy";

describe("normalizeTaxonomy", () => {
  it("returns undefined for anything that is not an array", () => {
    // Callers rely on this to tell "field omitted" from "field cleared", which
    // is what stops a PATCH without tags from wiping the demo's tags.
    expect(normalizeTaxonomy(undefined)).toBeUndefined();
    expect(normalizeTaxonomy(null)).toBeUndefined();
    expect(normalizeTaxonomy("slack,hubspot")).toBeUndefined();
    expect(normalizeTaxonomy({ 0: "slack" })).toBeUndefined();
  });

  it("distinguishes an explicitly emptied list from an omitted one", () => {
    expect(normalizeTaxonomy([])).toEqual([]);
  });

  it("trims entries and drops blanks", () => {
    expect(normalizeTaxonomy(["  Slack  ", "", "   ", "HubSpot"])).toEqual(["Slack", "HubSpot"]);
  });

  it("de-duplicates so one filter pill is not rendered twice", () => {
    expect(normalizeTaxonomy(["Slack", " Slack ", "Slack"])).toEqual(["Slack"]);
  });

  it("drops non-string entries rather than letting Prisma 500", () => {
    expect(normalizeTaxonomy([1, "Slack", null, { a: 1 }, ["x"], true, "Zoom"])).toEqual([
      "Slack",
      "Zoom",
    ]);
  });

  it("caps the number of entries", () => {
    const many = Array.from({ length: MAX_TAXONOMY_ENTRIES + 20 }, (_, i) => `tag-${i}`);
    expect(normalizeTaxonomy(many)).toHaveLength(MAX_TAXONOMY_ENTRIES);
  });

  it("caps the length of each entry", () => {
    const long = "x".repeat(MAX_TAXONOMY_LENGTH + 50);
    expect(normalizeTaxonomy([long])).toEqual(["x".repeat(MAX_TAXONOMY_LENGTH)]);
  });

  it("preserves the author's ordering", () => {
    expect(normalizeTaxonomy(["Zoom", "Ada", "Manager"])).toEqual(["Zoom", "Ada", "Manager"]);
  });
});
