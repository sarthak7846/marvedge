import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import {
  AUTO_DETECT_LANGUAGE,
  SUBTITLE_FORMAT_MIME,
  isSubtitleFormat,
  normalizeCues,
  normalizeLanguage,
  readCueList,
  serializeCues,
  subtitleFileName,
} from "@/app/lib/subtitles";

/**
 * POST /api/subtitles/export — download one of a demo's subtitle tracks as a
 * .srt, .vtt or .txt file (PRD §6.8 / US-5).
 *
 * NOT plan-gated, and deliberately so: file export is free on every plan,
 * including FREE. Translation is the only paid surface in this feature — see
 * app/lib/subtitles/access.ts. Ownership is still checked, with the same lookup
 * /api/subtitles/tracks uses.
 *
 * The route resolves cues and calls a serializer; it formats nothing itself.
 * Timestamps, the MIME type and the filename all come from
 * app/lib/subtitles/formats.ts, which the browser panel calls too — so the file
 * a user downloads from the sidebar and the file they curl from here are byte
 * for byte the same document.
 *
 * WHICH CUES WIN. A demo carries the same track in up to three places, written
 * at different moments:
 *
 *   1. `Demo.editing.subtitles` — the editor's working copy. Autosave writes it
 *      on every edit, so it is the ONLY one that reflects a fixed typo or a
 *      re-timed cue. It holds whichever track is active, named by
 *      `editing.subtitleLanguage`.
 *   2. `SubtitleTrack.cues` — one row per language, written by generation and by
 *      translation. Authoritative for a language that is not the active one, and
 *      stale for one that is being edited.
 *   3. `Demo.subtitles` — what the generation route wrote. The pre-track-table
 *      fallback, kept so a demo made before PR 1 still exports.
 *
 * So: prefer (1) when the requested language IS the active one, then (2), then
 * (3). Getting this order wrong is not a crash — it silently hands the user a
 * file with the typo they just fixed still in it.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const demoId = typeof body.demoId === "string" ? body.demoId : "";
    const format = body.format;
    if (!demoId) {
      return NextResponse.json({ error: "Missing demoId" }, { status: 400 });
    }
    if (!isSubtitleFormat(format)) {
      return NextResponse.json(
        { error: "Unsupported format. Use srt, vtt or txt." },
        { status: 400 }
      );
    }

    // An unknown or absent code normalizes to auto-detect, which is what every
    // demo predating the language picker is implicitly in.
    const language = normalizeLanguage(typeof body.language === "string" ? body.language : "");

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

    const demo = await prisma.demo.findUnique({
      where: { id: demoId },
      select: { id: true, userId: true, title: true, subtitles: true, editing: true },
    });
    if (!demo || demo.userId !== user.id) {
      return NextResponse.json({ error: "Demo not found" }, { status: 404 });
    }

    const cues = normalizeCues(await resolveCues(demo, language));
    if (cues.length === 0) {
      return NextResponse.json(
        { error: "There are no subtitles to export yet. Generate them first." },
        { status: 404 }
      );
    }

    const filename = subtitleFileName(demo.title, language, format);

    // charset is explicit: a Hindi or Japanese track is not decodable by a
    // receiver that falls back to latin-1. `Content-Disposition` gets a plain
    // ASCII filename by construction (see subtitleFileName), so there is nothing
    // here to escape.
    return new NextResponse(serializeCues(cues, format), {
      status: 200,
      headers: {
        "Content-Type": `${SUBTITLE_FORMAT_MIME[format]}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${filename}"`,
        // A subtitle file changes every time the user edits a cue; a cached copy
        // would hand them the previous version of their own track.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Subtitle Export Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** The demo columns this route reads. Narrower than the Prisma row on purpose. */
interface DemoForExport {
  id: string;
  subtitles: unknown;
  editing: unknown;
}

/** Resolve the freshest cue list for `language`. See the header comment. */
async function resolveCues(demo: DemoForExport, language: string): Promise<unknown[]> {
  const editing =
    demo.editing && typeof demo.editing === "object"
      ? (demo.editing as Record<string, unknown>)
      : {};

  // The active track's language, as the editor last saved it. Absent on demos
  // saved before the language picker, which auto-detect describes exactly.
  const activeLanguage = normalizeLanguage(
    typeof editing.subtitleLanguage === "string" ? editing.subtitleLanguage : AUTO_DETECT_LANGUAGE
  );

  if (language === activeLanguage) {
    const working = readCueList(editing.subtitles);
    if (working.length > 0) {
      return working;
    }
  }

  // The table may not exist on a database that has not run PR 1's migration —
  // the same tolerance /api/subtitles/tracks applies, so an un-migrated
  // environment falls through to Demo.subtitles instead of 500ing.
  const track = await prisma.subtitleTrack
    .findUnique({
      where: { demoId_language: { demoId: demo.id, language } },
      select: { cues: true },
    })
    .catch((e: unknown) => {
      console.warn("SubtitleTrack lookup skipped:", e instanceof Error ? e.message : e);
      return null;
    });

  const fromTrack = readCueList(track?.cues);
  return fromTrack.length > 0 ? fromTrack : readCueList(demo.subtitles);
}
