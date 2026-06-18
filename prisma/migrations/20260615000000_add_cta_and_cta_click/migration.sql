-- CreateTable
CREATE TABLE "Cta" (
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

-- CreateTable
CREATE TABLE "CtaClick" (
    "id" TEXT NOT NULL,
    "ctaId" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'demo',
    "sessionId" TEXT,
    "userId" TEXT,
    "referrer" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtaClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cta_demoId_idx" ON "Cta"("demoId");

-- CreateIndex
CREATE INDEX "CtaClick_demoId_timestamp_idx" ON "CtaClick"("demoId", "timestamp");

-- CreateIndex
CREATE INDEX "CtaClick_ctaId_idx" ON "CtaClick"("ctaId");

-- AddForeignKey
ALTER TABLE "Cta" ADD CONSTRAINT "Cta_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaClick" ADD CONSTRAINT "CtaClick_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "Cta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaClick" ADD CONSTRAINT "CtaClick_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
