import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { invokeGcpSubtitles } from "@/app/lib/gcpWorker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { normalizeCues, normalizeLanguage } from "@/app/lib/subtitles";

// Transcribing a 10-minute video (download + ffmpeg audio extract + Deepgram)
// runs well past the default serverless limit. The request itself returns in one
// tick now, but `after()` work is still billed against this route's budget — the
// same 300s ceiling app/api/jobs/create/route.ts uses for its export dispatch.
export const maxDuration = 300;

// Progress checkpoints written as the job advances, so the client's poll loop has
// something to draw. The worker call is one long opaque await, so 40 -> 80 is the
// only stretch we cannot subdivide from here.
const PROGRESS_QUEUED = 10;
const PROGRESS_TRANSCRIBING = 40;
const PROGRESS_PERSISTING = 80;
const PROGRESS_DONE = 100;

/**
 * Run the transcription and record the result. Invoked from `after()`, so it
 * runs *after* the response has been flushed: nothing it throws can reach the
 * client, and every exit path has to land in the job record instead.
 */
async function dispatchSubtitleJob(jobId: string, videoUrl: string, language: string) {
  try {
    await prisma.videoJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", progress: PROGRESS_TRANSCRIBING },
    });

    // invokeGcpSubtitles already retries 429/502/503/504 with backoff.
    const rawCues = await invokeGcpSubtitles({ videoUrl, language });

    // The worker's cue clustering is well behaved, but the export path assumes
    // sorted, non-overlapping cues and this is the last place that is cheap to
    // guarantee. No duration here — the job record does not carry one — so this
    // only sorts, de-overlaps and drops junk.
    const cues = normalizeCues(rawCues);

    const job = await prisma.videoJob.update({
      where: { id: jobId },
      data: { progress: PROGRESS_PERSISTING },
      select: { demoId: true },
    });

    if (job.demoId) {
      // Written as a BARE ARRAY, not the old `{ provider, language, cues }`
      // wrapper. app/hub/[domain]/page.tsx derives its subtitle search text from
      // this column and the object shape made `Array.isArray` false forever, so
      // hub subtitle search matched nothing. Readers go through `readCueList()`,
      // which still accepts the wrapper, so demos written by the old code keep
      // working — provider and language live on the job record and the track.
      await prisma.demo.update({
        where: { id: job.demoId },
        data: { subtitles: cues },
      });

      // Best-effort: park the cues in the per-language track table so PR 5 has a
      // primary track to translate from. Nothing reads this yet, and the table
      // may not exist on a database that has not run the migration, so a failure
      // here must never fail a job whose cues are already safely persisted above.
      await prisma.subtitleTrack
        .upsert({
          where: { demoId_language: { demoId: job.demoId, language } },
          create: {
            demoId: job.demoId,
            language,
            status: "READY",
            source: "stt",
            cues,
          },
          update: { status: "READY", source: "stt", cues },
        })
        .catch((e: unknown) => {
          console.warn("SubtitleTrack upsert skipped:", e instanceof Error ? e.message : e);
        });
    }

    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: PROGRESS_DONE,
        jobData: {
          kind: "SUBTITLES",
          provider: "deepgram",
          language,
          subtitles: cues,
        },
      },
    });
  } catch (err) {
    console.error("Subtitle Job Dispatch Error:", err);
    await prisma.videoJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : "Subtitle generation failed",
        },
      })
      .catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  let createdJobId: string | null = null;
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { videoUrl, demoId, language } = data;

    if (!videoUrl) {
      return NextResponse.json({ error: "Missing videoUrl" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          session.user.id ? { id: session.user.id as string } : undefined,
          session.user.email ? { email: session.user.email } : undefined,
        ].filter(Boolean) as Array<{ id?: string; email?: string }>,
      },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;

    if (demoId) {
      const demo = await prisma.demo.findUnique({
        where: { id: demoId },
        select: { id: true, userId: true },
      });
      if (!demo || demo.userId !== userId) {
        return NextResponse.json({ error: "Demo not found" }, { status: 404 });
      }
    }

    // Unknown or missing codes fall back to auto-detect ("multi"), which is what
    // the editor has always sent.
    const normalizedLanguage = normalizeLanguage(language);

    const jobRecord = await prisma.videoJob.create({
      data: {
        userId,
        demoId: demoId || null,
        videoUrl,
        status: "PROCESSING",
        progress: PROGRESS_QUEUED,
        jobData: {
          kind: "SUBTITLES",
          language: normalizedLanguage,
        },
      },
    });
    createdJobId = jobRecord.id;

    // Transcription runs after the response is flushed. The client gets its
    // jobId in the same tick and polls /api/jobs/{id} for progress — before this,
    // the POST awaited the entire transcription, so a long video blew the
    // serverless limit and stranded the job at PROCESSING with cues that had
    // been computed but never written.
    after(() => dispatchSubtitleJob(jobRecord.id, videoUrl, normalizedLanguage));

    return NextResponse.json({
      success: true,
      status: "processing",
      jobId: jobRecord.id,
      language: normalizedLanguage,
    });
  } catch (err) {
    console.error("Subtitle Job Creation Error:", err);
    if (createdJobId) {
      await prisma.videoJob
        .update({
          where: { id: createdJobId },
          data: {
            status: "FAILED",
            error: err instanceof Error ? err.message : "Subtitle generation failed",
          },
        })
        .catch(() => {});
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
