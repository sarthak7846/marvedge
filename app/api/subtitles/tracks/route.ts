import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import {
  isAutoDetect,
  isSubtitleTranslateEnabled,
  isSupportedLanguage,
  readCueList,
} from "@/app/lib/subtitles";

/**
 * GET /api/subtitles/tracks?demoId=…  — the demo's subtitle tracks, for the
 * panel's track switcher (PRD §6.6 / US-4).
 *
 * NOT plan-gated. Listing and switching tracks is part of editing, which is free
 * for every plan; only creating a translated track costs anything. Ownership is
 * still checked, with the same lookup the generation route uses.
 *
 * The response also carries `translateEnabled`. SUBTITLE_TRANSLATE_ENABLED is
 * server-only (deliberately — it is not NEXT_PUBLIC), so the browser cannot read
 * it; this is how the panel learns whether to offer translation at all instead
 * of showing a button that 404s.
 *
 * `?language=` returns that one track WITH its cues, which is what switching the
 * active track needs. Without it the response is summaries only — cue arrays for
 * every language of a long demo would be megabytes for a list the panel renders
 * as a handful of rows.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoId = req.nextUrl.searchParams.get("demoId") ?? "";
    const language = req.nextUrl.searchParams.get("language") ?? "";
    if (!demoId) {
      return NextResponse.json({ error: "Missing demoId" }, { status: 400 });
    }
    // An unknown code is refused rather than quietly looked up and missed: a
    // track lookup for a language that cannot exist returns the same "no track"
    // as a typo, and the caller has no way to tell which happened. Auto-detect
    // is a legitimate track language here — it is what every demo predating the
    // picker is stored under.
    if (language && !isAutoDetect(language) && !isSupportedLanguage(language)) {
      return NextResponse.json(
        { error: `"${language}" is not a supported subtitle language.` },
        { status: 400 }
      );
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

    const demo = await prisma.demo.findUnique({
      where: { id: demoId },
      select: { id: true, userId: true },
    });
    if (!demo || demo.userId !== user.id) {
      return NextResponse.json({ error: "Demo not found" }, { status: 404 });
    }

    // The table may not exist on a database that has not run PR 1's migration.
    // A demo with no tracks is a normal, empty answer — not an error — so the
    // panel degrades to "no tracks yet" instead of showing a failure.
    const rows = await prisma.subtitleTrack
      .findMany({
        where: { demoId },
        orderBy: { updatedAt: "desc" },
      })
      .catch((e: unknown) => {
        console.warn("SubtitleTrack list skipped:", e instanceof Error ? e.message : e);
        return [];
      });

    if (language) {
      const row = rows.find((r) => r.language === language);
      if (!row) {
        return NextResponse.json({ error: "Track not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        track: {
          language: row.language,
          source: row.source,
          status: row.status,
          cues: readCueList(row.cues),
          updatedAt: row.updatedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      translateEnabled: isSubtitleTranslateEnabled(),
      tracks: rows.map((row) => ({
        language: row.language,
        source: row.source,
        status: row.status,
        cueCount: readCueList(row.cues).length,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Subtitle Tracks Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
