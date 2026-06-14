import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { deleteCloudinaryVideoByUrl } from "@/app/lib/cloudinary-utils";

type SessionUser = {
  id?: string;
  email?: string | null;
};

async function getCurrentUserId(user: SessionUser): Promise<string | null> {
  if (user.id) {
    return user.id;
  }
  if (!user.email) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  return dbUser?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = await getCurrentUserId(session.user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const exportedUrl = typeof body?.exportedUrl === "string" ? body.exportedUrl : "";
    const sourceVideoUrl = typeof body?.sourceVideoUrl === "string" ? body.sourceVideoUrl : "";
    const demoId = typeof body?.demoId === "string" && body.demoId.length > 0 ? body.demoId : null;

    if (!exportedUrl) {
      return NextResponse.json({ error: "exportedUrl is required" }, { status: 400 });
    }

    // Ownership gate: the exportedUrl must belong to the caller. The only server-side
    // record that ties a freshly-exported (unsaved) Cloudinary URL to a user is the
    // VideoJob created at /api/jobs/create, so verify against the caller's jobs.
    const ownedJob = await prisma.videoJob.findFirst({
      where: { userId, exportedUrl },
      select: { id: true },
    });

    if (!ownedJob) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (demoId) {
      const demo = await prisma.demo.findUnique({
        where: { id: demoId },
        select: { id: true, userId: true, exportedUrl: true },
      });

      if (!demo || demo.userId !== userId) {
        return NextResponse.json({ error: "Demo not found" }, { status: 404 });
      }

      if (demo.exportedUrl === exportedUrl) {
        await prisma.demo.update({
          where: { id: demoId },
          data: { exportedUrl: null },
        });
      }
    }

    // Never destroy an asset that a persisted (saved) ExportedVideo still references.
    const savedReferencingExport = await prisma.exportedVideo.findFirst({
      where: { exportedUrl },
      select: { id: true },
    });

    if (!savedReferencingExport) {
      await deleteCloudinaryVideoByUrl(exportedUrl);
    }

    // Only delete the source video if it is also owned by the caller (i.e. it was the
    // input to one of their jobs) and is not still referenced by a saved export.
    if (sourceVideoUrl) {
      const ownsSource = await prisma.videoJob.findFirst({
        where: { userId, videoUrl: sourceVideoUrl },
        select: { id: true },
      });
      const sourceStillReferenced = await prisma.exportedVideo.findFirst({
        where: { sourceVideoUrl },
        select: { id: true },
      });

      if (ownsSource && !sourceStillReferenced) {
        await deleteCloudinaryVideoByUrl(sourceVideoUrl);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cleanup exported video:", error);
    return NextResponse.json({ error: "Failed to cleanup exported video" }, { status: 500 });
  }
}
