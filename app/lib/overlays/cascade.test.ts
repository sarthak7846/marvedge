// The deletion-cascade test. It reads the REAL prisma/schema.prisma off disk.
//
// PR 7 item 6: verify the cascade with a test, not by reading the schema. This
// is the closest thing to that which this repo's test setup supports — `npm
// test` is vitest with no Postgres, no fixtures and no migrations applied, so a
// live `prisma.user.delete()` integration test has nothing to run against. See
// the header of ./cascade.ts for what that trade-off does and does not catch.
//
// The reading of the file happens HERE, not in the module under test:
// app/lib/overlays stays isomorphic and fs-free.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  cascadeReachable,
  defaultOnDelete,
  deletionBlockers,
  describeEdge,
  parseRelationEdges,
} from "./cascade";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const edges = parseRelationEdges(schema);

/** The two the account-deletion route removes by hand before user.delete(). */
const HANDLED_BY_DELETE_ROUTE = new Set(["Account.userId", "Session.userId"]);

function edgeKey(edge: { child: string; field: string }): string {
  // The FK column, which is the field name + "Id" in this schema's convention.
  return `${edge.child}.${edge.field}Id`;
}

describe("parseRelationEdges", () => {
  it("finds the FK-holding side of a relation and ignores the back-reference", () => {
    const leadToDemo = edges.filter((e) => e.child === "Lead" && e.parent === "Demo");
    expect(leadToDemo).toHaveLength(1);
    expect(leadToDemo[0].onDelete).toBe("Cascade");

    // `leads Lead[]` on Demo holds no constraint and must not appear as an edge.
    expect(edges.some((e) => e.child === "Demo" && e.parent === "Lead")).toBe(false);
  });

  it("applies Prisma's default when onDelete is omitted", () => {
    expect(defaultOnDelete(false)).toBe("Restrict");
    expect(defaultOnDelete(true)).toBe("SetNull");
  });

  it("parses a named relation", () => {
    // Tutorial.user is `@relation("UserTutorials", fields: [...], ...)`.
    const tutorial = edges.find((e) => e.child === "Tutorial" && e.parent === "User");
    expect(tutorial?.onDelete).toBe("Cascade");
  });
});

// ===========================================================================
// THE REQUIREMENT: deleting a User must take the viewer PII with it.
// ===========================================================================
describe("deleting a User", () => {
  const reachable = cascadeReachable(edges, "User");

  it.each(["Demo", "VideoOverlayConfig", "Lead", "LeadDelivery", "PlayerEvent", "CrmConnection"])(
    "cascades to %s",
    (model) => {
      expect(
        reachable.has(model),
        `Deleting a User does not cascade to ${model}. ` +
          "A Lead is a viewer's name, email and consent record — it must not outlive " +
          "the account it was collected under. Add onDelete: Cascade to the relation " +
          "that breaks the chain."
      ).toBe(true);
    }
  );

  it("is not blocked by a Restrict foreign key that the delete route does not handle", () => {
    const blockers = deletionBlockers(edges, "User");
    const unhandled = blockers.filter((edge) => !HANDLED_BY_DELETE_ROUTE.has(edgeKey(edge)));

    expect(
      unhandled.map(describeEdge),
      "app/api/user/delete/route.ts calls prisma.user.delete() and relies on cascade " +
        "for everything except Session and Account. A Restrict edge anywhere in the " +
        "deletion set makes that call raise a foreign-key violation, the route return " +
        "a 500, and NOTHING be deleted — including the leads."
    ).toEqual([]);
  });

  it("still relies on the route deleting Session and Account first", () => {
    // Not a cascade, by choice: NextAuth owns both tables. This pins the
    // assumption so that removing those deleteMany calls from the route fails
    // here instead of in production.
    const blockers = deletionBlockers(edges, "User").map(edgeKey);
    expect(new Set(blockers)).toEqual(HANDLED_BY_DELETE_ROUTE);
  });
});

// ===========================================================================
// Deleting a Demo must take its overlay config, leads and events with it.
// ===========================================================================
describe("deleting a Demo", () => {
  const reachable = cascadeReachable(edges, "Demo");

  it.each(["VideoOverlayConfig", "Lead", "LeadDelivery", "PlayerEvent", "Cta"])(
    "cascades to %s",
    (model) => {
      expect(reachable.has(model), `Deleting a Demo does not cascade to ${model}.`).toBe(true);
    }
  );

  it("is not blocked by any Restrict foreign key", () => {
    // Unlike User, there is no route that clears anything by hand first. A demo
    // delete either works on its own or it does not work at all.
    expect(deletionBlockers(edges, "Demo").map(describeEdge)).toEqual([]);
  });
});

// ===========================================================================
// Deleting a CrmConnection must not strand delivery records.
// ===========================================================================
describe("deleting a CrmConnection", () => {
  it("cascades to LeadDelivery", () => {
    expect(cascadeReachable(edges, "CrmConnection").has("LeadDelivery")).toBe(true);
  });
});

// ===========================================================================
// What deliberately does NOT cascade.
// ===========================================================================
describe("deliberate non-cascades", () => {
  it("leaves View orphaned rather than deleting it", () => {
    // A View is an anonymous counter with no PII. Orphaning preserves historical
    // totals; deleting would rewrite them. Same reasoning as PlayerEventDaily
    // having no foreign key at all.
    const viewEdges = edges.filter((e) => e.child === "View");
    expect(viewEdges.length).toBeGreaterThan(0);
    for (const edge of viewEdges) {
      expect(edge.onDelete, describeEdge(edge)).toBe("SetNull");
    }
  });

  it("has no foreign key on PlayerEventDaily at all", () => {
    // The rollup must survive its demo so historical dashboard totals do not
    // silently rewrite themselves. See prisma/schema.prisma.
    expect(edges.some((e) => e.child === "PlayerEventDaily")).toBe(false);
  });

  it("nulls CtaClick.ctaId rather than deleting the click", () => {
    const ctaClickToCta = edges.find((e) => e.child === "CtaClick" && e.parent === "Cta");
    expect(ctaClickToCta?.onDelete).toBe("SetNull");
  });
});
