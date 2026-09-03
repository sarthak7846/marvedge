// GET /api/demos/[id]/overlays/branch-targets — the demo picker's list.
//
// A NEW ROUTE RATHER THAN A REUSE, AND HERE IS THE CHECK THAT WAS DONE.
// GET /api/demo is the only existing list of a user's demos, and it returns FULL
// demo rows — `editing`, `subtitles` and all — for every demo the user owns.
// `editing` is the editor's autosaved working draft and routinely runs to
// hundreds of kilobytes, so a sidebar picker built on it would pull megabytes to
// render two dropdowns. This returns three columns for the demos that can
// actually be a branch target, which is a different question anyway.
//
// Owner-scoped through the demo in the path, exactly like the config route next
// to it: not-found and not-owned collapse into one 404.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";

export const runtime = "nodejs";

/**
 * Enough to fill a picker without turning it into a scroll. An owner with more
 * public demos than this can still point a card anywhere by pasting the share
 * URL as a `url` target.
 */
const MAX_TARGETS = 100;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isOverlaysEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  const owned = await prisma.demo.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) {
    return NextResponse.json({ error: "Demo not found" }, { status: 404 });
  }

  // PUBLIC ONLY, AND NOT THIS DEMO. The same two conditions the server-side
  // resolver applies at render time — a picker that offers a private demo offers
  // a card that resolves to nothing — plus the obvious one: a card pointing at
  // the video the viewer is already watching is a loop, not a branch.
  const demos = await prisma.demo.findMany({
    where: { userId, isPublic: true, id: { not: id } },
    select: { id: true, title: true, publicLink: true },
    orderBy: { createdAt: "desc" },
    take: MAX_TARGETS,
  });

  return NextResponse.json({ success: true, demos });
}
