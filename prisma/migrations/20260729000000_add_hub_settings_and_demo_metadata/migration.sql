-- Branded Demo Hub (BDH): HubSettings table + Demo taxonomy columns.
--
-- These models were added to prisma/schema.prisma in the Branded Demo Hub PR but
-- no migration was generated, so a database built with `prisma migrate deploy`
-- has neither the "HubSettings" table nor the Demo metadata columns. Every hub
-- route (/hub/[domain], /api/hub, /api/hub/verify) and the demo save/patch paths
-- fail at runtime against such a database.
--
-- Written idempotently (IF [NOT] EXISTS / drop-then-add) so it applies cleanly
-- whether the target DB was built from prior migrations, synced with `db push`
-- while the feature was in development, or is already fully in sync.

-- Demo taxonomy / curation metadata (BDH-4.3, BDH-4.4)
ALTER TABLE "Demo" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Demo" ADD COLUMN IF NOT EXISTS "integrations" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Demo" ADD COLUMN IF NOT EXISTS "userRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Demo" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

-- HubSettings (BDH-4.1 branding, BDH-4.2 subdomain / custom domain hosting)
CREATE TABLE IF NOT EXISTS "HubSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subdomain" TEXT,
    "customDomain" TEXT,
    "sslStatus" TEXT NOT NULL DEFAULT 'pending',
    "dnsVerification" JSONB,
    "logoUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#7C5CFC',
    "textColor" TEXT NOT NULL DEFAULT '#111827',
    "accentColor" TEXT NOT NULL DEFAULT '#F3F0FC',
    "hubTitle" TEXT,
    "hubDescription" TEXT,
    "cloudflareId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HubSettings_userId_key" ON "HubSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "HubSettings_subdomain_key" ON "HubSettings"("subdomain");
CREATE UNIQUE INDEX IF NOT EXISTS "HubSettings_customDomain_key" ON "HubSettings"("customDomain");

ALTER TABLE "HubSettings" DROP CONSTRAINT IF EXISTS "HubSettings_userId_fkey";
ALTER TABLE "HubSettings" ADD CONSTRAINT "HubSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
