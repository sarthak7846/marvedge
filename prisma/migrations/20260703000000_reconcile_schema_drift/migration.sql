-- Reconcile the migration history with prisma/schema.prisma.
--
-- Several schema changes (User.plan, Demo.duration, ExportedVideo.shareCount,
-- View.exportedVideoId / nullable View.demoId, the Review table) were applied to
-- live databases via `prisma db push` but never captured as migration files, so a
-- database provisioned purely from `prisma migrate deploy` was missing them. The
-- analytics page reads `View.exportedVideoId` and `ExportedVideo.shareCount`, so it
-- crashed server-side on any migrations-built database.
--
-- Every statement below is written idempotently (IF [NOT] EXISTS / drop-then-add)
-- so this migration applies cleanly whether the target DB was built from prior
-- migrations, synced with `db push`, or is already fully in sync.

-- User.plan
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'FREE';

-- Demo.duration
ALTER TABLE "Demo" ADD COLUMN IF NOT EXISTS "duration" DOUBLE PRECISION;

-- ExportedVideo.shareCount
ALTER TABLE "ExportedVideo" ADD COLUMN IF NOT EXISTS "shareCount" INTEGER NOT NULL DEFAULT 1;

-- View.exportedVideoId + nullable demoId + realigned foreign keys (ON DELETE SET NULL)
ALTER TABLE "View" ADD COLUMN IF NOT EXISTS "exportedVideoId" TEXT;
ALTER TABLE "View" ALTER COLUMN "demoId" DROP NOT NULL;
ALTER TABLE "View" DROP CONSTRAINT IF EXISTS "View_demoId_fkey";
ALTER TABLE "View" DROP CONSTRAINT IF EXISTS "View_exportedVideoId_fkey";
ALTER TABLE "View" ADD CONSTRAINT "View_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "View" ADD CONSTRAINT "View_exportedVideoId_fkey" FOREIGN KEY ("exportedVideoId") REFERENCES "ExportedVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Review table
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_userId_fkey";
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CTA tables. These are already created by 20260615000000_add_cta_and_cta_click /
-- 20260622104220_cta_click_setnull_on_cta_delete, but are (re)declared here with
-- IF NOT EXISTS so the analytics CTA metrics work even on a database that was
-- synced with `db push` before those migration files existed.
CREATE TABLE IF NOT EXISTS "Cta" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "placement" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CtaClick" (
    "id" TEXT NOT NULL,
    "ctaId" TEXT,
    "demoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'demo',
    "sessionId" TEXT,
    "userId" TEXT,
    "referrer" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtaClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Cta_demoId_idx" ON "Cta"("demoId");
CREATE INDEX IF NOT EXISTS "CtaClick_demoId_timestamp_idx" ON "CtaClick"("demoId", "timestamp");
CREATE INDEX IF NOT EXISTS "CtaClick_ctaId_idx" ON "CtaClick"("ctaId");

ALTER TABLE "Cta" DROP CONSTRAINT IF EXISTS "Cta_demoId_fkey";
ALTER TABLE "Cta" ADD CONSTRAINT "Cta_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtaClick" DROP CONSTRAINT IF EXISTS "CtaClick_ctaId_fkey";
ALTER TABLE "CtaClick" ADD CONSTRAINT "CtaClick_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "Cta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CtaClick" DROP CONSTRAINT IF EXISTS "CtaClick_demoId_fkey";
ALTER TABLE "CtaClick" ADD CONSTRAINT "CtaClick_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
