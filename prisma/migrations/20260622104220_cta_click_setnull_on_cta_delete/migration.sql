-- DropForeignKey
ALTER TABLE "CtaClick" DROP CONSTRAINT "CtaClick_ctaId_fkey";

-- AlterTable
ALTER TABLE "CtaClick" ALTER COLUMN "ctaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CtaClick" ADD CONSTRAINT "CtaClick_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "Cta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
