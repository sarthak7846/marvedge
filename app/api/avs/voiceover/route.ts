import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { isAvsEnabled } from "@/app/lib/avs/flags";
import { isAvsAllowed } from "@/app/lib/avs/access";
import { invokeGcpVoiceover } from "@/app/lib/gcpWorker";
import { DEFAULT_AVS_VOICE, isAvsVoiceId } from "@/app/lib/avs/voices";
import type { PronunciationRule } from "@/app/types/avs";

// Aura TTS + ffmpeg concat runs in the worker; give the round-trip headroom.
export const maxDuration = 120;

interface LineInput {
  stepId: string;
  text: string;
}

/** Read + sanitize the `lines` body field into non-empty {stepId,text} entries. */
function parseLines(value: unknown): LineInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const lines: LineInput[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const stepId = typeof rec.stepId === "string" ? rec.stepId : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (stepId && text) {
      lines.push({ stepId, text });
    }
  }
  return lines;
}

/** Read + sanitize the optional `pronunciation` dictionary. */
function parsePronunciation(value: unknown): PronunciationRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rules: PronunciationRule[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const term = typeof rec.term === "string" ? rec.term.trim() : "";
    const phonetic = typeof rec.phonetic === "string" ? rec.phonetic.trim() : "";
    if (term && phonetic) {
      rules.push({ term, phonetic });
    }
  }
  return rules;
}

export async function POST(req: NextRequest) {
  // Flag off → the feature is invisible; behave as if the route doesn't exist.
  if (!isAvsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        session.user.id ? { id: session.user.id as string } : undefined,
        session.user.email ? { email: session.user.email } : undefined,
      ].filter(Boolean) as Array<{ id?: string; email?: string }>,
    },
    select: { plan: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // PRO/ENTERPRISE only — mirrors the export path's plan gate.
  if (!isAvsAllowed(user.plan)) {
    return NextResponse.json(
      { error: "AVS is available on PRO and ENTERPRISE plans." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const lines = parseLines(body.lines);
  if (lines.length === 0) {
    return NextResponse.json({ error: "No script text to synthesize" }, { status: 400 });
  }

  // Clamp to an allowed Aura voice (worker also validates + defaults).
  const voiceId = isAvsVoiceId(body.voiceId) ? body.voiceId : DEFAULT_AVS_VOICE;
  const pronunciation = parsePronunciation(body.pronunciation);

  try {
    const result = await invokeGcpVoiceover({ lines, voiceId, pronunciation });
    // Return a full VoiceoverTrack so the client can persist it directly.
    return NextResponse.json({
      audioUrl: result.audioUrl,
      duration: result.duration,
      voiceId,
      stepTimings: result.stepTimings,
    });
  } catch (err) {
    console.error("AVS voiceover generation failed:", err);
    return NextResponse.json({ error: "Failed to generate voiceover" }, { status: 502 });
  }
}
