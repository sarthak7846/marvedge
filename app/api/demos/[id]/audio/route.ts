import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { isAudioUploadEnabled } from "@/app/lib/audio/flags";
import { asAudioClipDb } from "@/app/lib/audio/db";
import { ApiError, listAudioClips } from "@/app/lib/audio/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAudioUploadEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const demo = await prisma.demo.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!demo) {
    return NextResponse.json({ error: "Demo not found" }, { status: 404 });
  }

  try {
    const clips = await listAudioClips({ db: asAudioClipDb(prisma), demoId: demo.id });
    return NextResponse.json({ success: true, clips });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Audio list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
