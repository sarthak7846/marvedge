import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { readCueList } from "@/app/lib/subtitles";

/**
 * `GET /api/subtitles/{jobId}` — the PRD's subtitle status endpoint.
 *
 * A thin, PRD-shaped alias over the same job record `/api/jobs/[id]` serves:
 * `{ status, language, segments: [{ start, end, text }] }`. It exists so the
 * documented API contract is real; `/api/jobs/[id]` keeps working unchanged and
 * remains the route the editor actually polls (it carries export state the
 * subtitle view has no use for).
 *
 * Ownership is checked exactly as `/api/jobs/[id]` checks it — the session user
 * must own the job — rather than with a looser rule of its own.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In Next 15, params must be awaited
    const { jobId } = await context.params;

    const job = await prisma.videoJob.findUnique({
      where: { id: jobId },
      select: {
        status: true,
        progress: true,
        error: true,
        userId: true,
        jobData: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const jobData = (job.jobData ?? {}) as Record<string, unknown>;
    const language = typeof jobData.language === "string" ? jobData.language : null;
    const segments = readCueList(jobData.subtitles);

    return NextResponse.json({
      success: true,
      // PENDING -> "pending", PROCESSING -> "processing", and so on: the PRD's
      // POST answers "processing", so this side speaks the same lowercase.
      status: job.status.toLowerCase(),
      progress: job.progress,
      language,
      segments,
      error: job.error,
    });
  } catch (err) {
    console.error("Fetch Subtitle Job Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
