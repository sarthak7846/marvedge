-- CreateTable
CREATE TABLE "VideoOverlayConfig" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "leadGate" JSONB,
    "branching" JSONB,
    "scheduling" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoOverlayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companySize" TEXT,
    "sessionId" TEXT,
    "referrer" TEXT,
    "consentText" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerEvent" (
    "id" TEXT NOT NULL,
    "demoId" TEXT,
    "exportedVideoId" TEXT,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionSec" DOUBLE PRECISION,
    "meta" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerEventDaily" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerEventDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoOverlayConfig_demoId_key" ON "VideoOverlayConfig"("demoId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_demoId_email_key" ON "Lead"("demoId", "email");

-- CreateIndex
CREATE INDEX "Lead_demoId_createdAt_idx" ON "Lead"("demoId", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerEvent_demoId_name_timestamp_idx" ON "PlayerEvent"("demoId", "name", "timestamp");

-- CreateIndex
CREATE INDEX "PlayerEvent_sessionId_idx" ON "PlayerEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerEventDaily_demoId_name_date_key" ON "PlayerEventDaily"("demoId", "name", "date");

-- CreateIndex
CREATE INDEX "PlayerEventDaily_demoId_date_idx" ON "PlayerEventDaily"("demoId", "date");

-- AddForeignKey
ALTER TABLE "VideoOverlayConfig" ADD CONSTRAINT "VideoOverlayConfig_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerEvent" ADD CONSTRAINT "PlayerEvent_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
