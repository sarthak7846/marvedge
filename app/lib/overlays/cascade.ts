// Does deleting a User actually delete their leads?
//
// ===========================================================================
// WHY THIS IS A MODULE AND NOT A CODE REVIEW
// ===========================================================================
// PR 7 item 6 says: verify the deletion cascade WITH A TEST, not by reading the
// schema. Reading it is how this shipped broken in the first place — every
// overlay model does carry `onDelete: Cascade`, so the chain LOOKS complete
// until you notice that `Demo.user` does not, which makes `prisma.user.delete()`
// throw a foreign-key error before any of those cascades ever fire.
//
// A live-database integration test would be the ideal check, and this repo has
// no harness for one: `npm test` is vitest against pure functions with no
// Postgres, no fixtures and no migrations applied (see the test files beside
// this one). Standing one up is a bigger change than this PR, and shipping the
// requirement as "verified by reading the schema" is exactly what was asked
// against. So: this module is a PURE analysis of the schema text, and
// cascade.test.ts feeds it the REAL prisma/schema.prisma off disk and asserts
// the chain. It fails on the actual file, not on a copy — if someone drops an
// `onDelete` in a future PR, `npm test` goes red with the edge named.
//
// WHAT IT CANNOT CATCH, stated plainly: drift between schema.prisma and the
// deployed database. This repo has known drift (see
// prisma/migrations/20260703000000_reconcile_schema_drift). The migration added
// in this PR writes the constraints explicitly with DROP/ADD so the database
// ends up matching regardless of what it held before.
//
// PURE: takes schema TEXT, no fs. The test does the reading.

/** Prisma's referential actions, as they appear in `onDelete:`. */
export type ReferentialAction = "Cascade" | "Restrict" | "NoAction" | "SetNull" | "SetDefault";

/** One FK-holding relation field: `child.field` points at `targetModel`. */
export interface RelationEdge {
  /** The model that HOLDS the foreign key — the one that gets deleted. */
  child: string;
  /** The model being pointed AT — the one whose deletion triggers the action. */
  parent: string;
  /** The field name on `child`. */
  field: string;
  /** True when the relation is `Parent?` rather than `Parent`. */
  optional: boolean;
  /** The declared action, or Prisma's default when `onDelete:` is absent. */
  onDelete: ReferentialAction;
  /** Whether `onDelete:` was written out or inferred. */
  explicit: boolean;
}

/**
 * Prisma's default `onDelete` when the attribute is omitted.
 *
 * Required relation -> Restrict. Optional relation -> SetNull. This default is
 * the whole bug: an omitted `onDelete` on a required relation is not "inherit
 * the obvious thing", it is a hard block on deleting the parent.
 */
export function defaultOnDelete(optional: boolean): ReferentialAction {
  return optional ? "SetNull" : "Restrict";
}

const MODEL_RE = /^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm;
const RELATION_FIELD_RE = /^\s*(\w+)\s+(\w+)(\?|\[\])?\s+@relation\(([^)]*)\)/;
const ON_DELETE_RE = /onDelete:\s*(\w+)/;

/**
 * Extract every FK-holding relation from a Prisma schema.
 *
 * Only fields whose `@relation(...)` carries `fields:` are edges — the other
 * side of the relation is the back-reference (`leads Lead[]`), which holds no
 * constraint and would double-count every edge if it were included.
 */
export function parseRelationEdges(schemaText: string): RelationEdge[] {
  const edges: RelationEdge[] = [];

  for (const modelMatch of schemaText.matchAll(MODEL_RE)) {
    const child = modelMatch[1];
    const body = modelMatch[2];

    for (const line of body.split("\n")) {
      const fieldMatch = RELATION_FIELD_RE.exec(line);
      if (!fieldMatch) {
        continue;
      }
      const [, field, parent, modifier, args] = fieldMatch;
      // `Model[]` is the back-reference side; it never holds the constraint.
      if (modifier === "[]" || !args.includes("fields:")) {
        continue;
      }
      const onDeleteMatch = ON_DELETE_RE.exec(args);
      const optional = modifier === "?";
      edges.push({
        child,
        parent,
        field,
        optional,
        onDelete:
          (onDeleteMatch?.[1] as ReferentialAction | undefined) ?? defaultOnDelete(optional),
        explicit: onDeleteMatch !== null,
      });
    }
  }

  return edges;
}

/**
 * Every model whose rows are deleted by deleting one row of `root`, following
 * Cascade edges only.
 *
 * Excludes `root` itself. A SetNull edge is not traversed: the child row
 * survives with a null column, which is the correct behaviour for `View` and
 * emphatically not what "the lead is gone" means.
 */
export function cascadeReachable(edges: readonly RelationEdge[], root: string): Set<string> {
  const reached = new Set<string>();
  const queue: string[] = [root];
  const seen = new Set<string>([root]);

  while (queue.length > 0) {
    const parent = queue.shift() as string;
    for (const edge of edges) {
      if (edge.parent !== parent || edge.onDelete !== "Cascade") {
        continue;
      }
      reached.add(edge.child);
      if (!seen.has(edge.child)) {
        seen.add(edge.child);
        queue.push(edge.child);
      }
    }
  }

  return reached;
}

/**
 * Edges that would make `DELETE FROM root` fail outright.
 *
 * A Restrict or NoAction edge hanging off `root` — or off anything `root`
 * cascades into — raises a foreign-key violation instead of deleting. THIS IS
 * THE CHECK THAT MATTERS: a blocked delete does not partially succeed and does
 * not warn. `app/api/user/delete/route.ts` catches the error and returns a 500,
 * and every row it was supposed to remove, including the leads, is still there.
 */
export function deletionBlockers(edges: readonly RelationEdge[], root: string): RelationEdge[] {
  const scope = cascadeReachable(edges, root);
  scope.add(root);

  // Conservative on purpose: ANY Restrict/NoAction edge off a row in the
  // deletion set counts, even where some other cascade path would have removed
  // the child anyway. Postgres checks RESTRICT immediately and non-deferrably,
  // so whether such an edge actually fires depends on the order the engine
  // walks the graph — and "probably fine, depending on ordering" is not a
  // property to assert an account deletion on.
  return edges.filter(
    (edge) =>
      scope.has(edge.parent) && (edge.onDelete === "Restrict" || edge.onDelete === "NoAction")
  );
}

/** `Child.field -> Parent` — the form the cascade test reports a failure in. */
export function describeEdge(edge: RelationEdge): string {
  return `${edge.child}.${edge.field} -> ${edge.parent} (onDelete: ${edge.onDelete}${
    edge.explicit ? "" : ", defaulted"
  })`;
}
