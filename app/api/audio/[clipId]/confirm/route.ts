import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { isAudioUploadEnabled } from "@/app/lib/audio/flags";
import { asAudioClipDb } from "@/app/lib/audio/db";
import { ApiError, confirmAudioUpload } from "@/app/lib/audio/service";
import { isAudioRateLimited } from "@/app/lib/audio/rateLimit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  if (!isAudioUploadEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isAudioRateLimited(session.user.id, "confirm")) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { clipId } = await params;
  const body = (await _request.json().catch(() => ({}))) as {
    durationSec?: number | string | null;
  };
  const durationSec =
    typeof body.durationSec === "number"
      ? body.durationSec
      : typeof body.durationSec === "string" && body.durationSec.trim() !== ""
        ? Number(body.durationSec)
        : null;

  try {
    const clip = await confirmAudioUpload({
      db: asAudioClipDb(prisma),
      clipId,
      userId: session.user.id,
      durationSec,
    });
    return NextResponse.json({ success: true, clip });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Audio confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
