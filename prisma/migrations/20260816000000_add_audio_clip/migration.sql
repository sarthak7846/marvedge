-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'TRIM_PROCESSING', 'FAILED');

-- CreateTable
CREATE TABLE "AudioClip" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "trimmedKey" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "trimStartSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trimEndSec" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "AudioStatus" NOT NULL DEFAULT 'UPLOADING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudioClip_demoId_order_idx" ON "AudioClip"("demoId", "order");

-- AddForeignKey
ALTER TABLE "AudioClip" ADD CONSTRAINT "AudioClip_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

