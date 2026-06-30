import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";

// Anonymous identity cookie: a random session-id VALUE (not a presence flag).
const SID_COOKIE = "mv_sid";
const SID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(req: NextRequest) {
  try {
    const { ctaId, demoId, label, referrer } = await req.json();

    if (!ctaId || !demoId || !label) {
      return NextResponse.json({ error: "ctaId, demoId and label are required" }, { status: 400 });
    }

    // Read the anonymous session id; generate one if this browser doesn't have it yet.
    let sessionId = req.cookies.get(SID_COOKIE)?.value;
    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Logged-in viewers also get their userId stored alongside the anon session id.
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    await prisma.ctaClick.create({
      data: {
        ctaId,
        demoId,
        label,
        pageType: "demo",
        sessionId,
        userId,
        referrer: referrer || req.headers.get("referer") || null,
      },
    });

    const response = NextResponse.json({ success: true });

    // Only set the cookie when we generated a fresh id so repeated calls reuse mv_sid.
    if (isNewSession) {
      response.cookies.set(SID_COOKIE, sessionId, {
        maxAge: SID_MAX_AGE,
        path: "/",
        httpOnly: false,
      });
    }

    return response;
  } catch (error) {
    console.error("Error recording CTA click:", error);
    return NextResponse.json({ error: "Failed to record CTA click" }, { status: 500 });
  }
}
