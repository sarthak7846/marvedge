// DELETE /api/leads/[id] — erase one lead, for a subject-access request.
//
// SOMEONE WHO IS NOT OUR USER can ask the demo's owner to delete what they
// submitted, and the owner needs a button that actually does it. That is the
// whole reason this route exists, so it deletes rather than soft-deletes: a
// `deletedAt` column would leave the name and email address in the table, which
// is not what "delete my data" means to the person asking.
//
// The LeadDelivery rows go with it, by schema cascade (Lead -> LeadDelivery is
// onDelete: Cascade). A delivery record naming a lead that no longer exists is a
// dangling reference to deleted PII.
//
// WHAT THIS CANNOT UNDO: a lead already forwarded to the owner's HubSpot or
// Salesforce is in the owner's CRM, not ours. Deleting it here does not reach
// into a third-party system we do not control, and the UI says so rather than
// implying a completeness this route cannot deliver.
//
// Owner-scoped with the deleteMany-with-a-where template from
// app/api/demos/[id]/ctas/route.ts: not-found and not-owned collapse into one
// 404, so this cannot be used to probe which lead ids exist.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // deleteMany, not delete: the ownership predicate rides in the same
    // statement, so there is no window between "check it is theirs" and "delete
    // it", and a miss returns a count of 0 rather than throwing.
    const { count } = await prisma.lead.deleteMany({
      where: { id, demo: { userId: session.user.id } },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // The id is ours, not the viewer's. No name, no email, no company size.
    console.log(`[ovl-leads] deleted lead id=${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[ovl-leads] delete failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
