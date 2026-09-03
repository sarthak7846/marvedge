// The owner guard shared by every /api/crm/* route.
//
// It lives here rather than in a route file because Next validates the exports
// of a `route.ts` — anything that is not a handler or a recognised segment
// config is a build error — and four routes need the identical check.
//
// Three things, in order, and the order matters:
//   1. FLAG. With OVERLAYS_ENABLED off the whole surface answers 404, not 403.
//      An endpoint that does not exist in this deployment should not describe
//      itself to a caller.
//   2. SESSION. 401.
//   3. PLAN, re-resolved from the database. Decision 14 puts CRM delivery on
//      PRO/ENTERPRISE, and reading `User.plan` on every request rather than from
//      the session token means a downgrade takes effect immediately instead of
//      at the caller's next sign-in.

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "../auth/options";
import { prisma } from "../prisma";
import { isOverlaysAllowed } from "../overlays/access";
import { isOverlaysEnabled } from "../overlays/flags";

export interface OwnerContext {
  userId: string;
  plan: string | null;
}

export type OwnerResult = { error: NextResponse } | { owner: OwnerContext };

export async function resolveCrmOwner(): Promise<OwnerResult> {
  if (!isOverlaysEnabled()) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, plan: true },
  });
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isOverlaysAllowed(user.plan)) {
    return {
      error: NextResponse.json(
        { error: "CRM delivery is available on the Pro and Enterprise plans." },
        { status: 403 }
      ),
    };
  }

  return { owner: { userId: user.id, plan: user.plan } };
}
