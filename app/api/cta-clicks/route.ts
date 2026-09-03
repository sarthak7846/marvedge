import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { applySessionCookie, readOrMintSessionId } from "@/app/lib/overlays/session";

// The mv_sid anonymous identity cookie this route introduced now lives in
// app/lib/overlays/session.ts, so /api/v3/events mints the SAME id with the same
// options rather than a second one that would split the funnel. Behaviour here is
// unchanged: read it, mint one only when absent, set the cookie only when minted.

export async function POST(req: NextRequest) {
  try {
    const { ctaId, demoId, label, referrer } = await req.json();

    if (!ctaId || !demoId || !label) {
      return NextResponse.json({ error: "ctaId, demoId and label are required" }, { status: 400 });
    }

    // Read the anonymous session id; generate one if this browser doesn't have it yet.
    const viewer = readOrMintSessionId(req);

    // Logged-in viewers also get their userId stored alongside the anon session id.
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    await prisma.ctaClick.create({
      data: {
        ctaId,
        demoId,
        label,
        pageType: "demo",
        sessionId: viewer.sessionId,
        userId,
        referrer: referrer || req.headers.get("referer") || null,
      },
    });

    const response = NextResponse.json({ success: true });

    // Only sets the cookie when we generated a fresh id, so repeated calls reuse mv_sid.
    applySessionCookie(response, viewer);

    return response;
  } catch (error) {
    console.error("Error recording CTA click:", error);
    return NextResponse.json({ error: "Failed to record CTA click" }, { status: 500 });
  }
}
