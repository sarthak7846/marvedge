-- SubtitleTrack: one row per (demo, language), holding that language's whole cue
-- array as JSON.
--
-- Additive only. Nothing existing reads or writes this table yet; the generation
-- route upserts the primary track best-effort (a failure there is swallowed), and
-- the authoritative cue copies remain Demo.subtitles and Demo.editing.subtitles.
-- It exists so multi-language tracks have somewhere to live.
--
-- Deliberately NOT the PRD's per-segment SubtitleSegment table — see
-- Subtitle-Implementation-Plan.md section 3, decision 5.
--
-- Written idempotently (IF NOT EXISTS / drop-then-add), following the precedent
-- set by 20260703000000_reconcile_schema_drift: some databases in this project
-- are maintained with `prisma db push`, so this must apply cleanly whether the
-- target was built from migrations, synced with db push, or already has the table.

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubtitleTrack" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "source" TEXT NOT NULL DEFAULT 'stt',
    "cues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubtitleTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubtitleTrack_demoId_idx" ON "SubtitleTrack"("demoId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubtitleTrack_demoId_language_key" ON "SubtitleTrack"("demoId", "language");

-- AddForeignKey
ALTER TABLE "SubtitleTrack" DROP CONSTRAINT IF EXISTS "SubtitleTrack_demoId_fkey";
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
