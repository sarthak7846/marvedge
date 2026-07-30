-- AlterTable
ALTER TABLE "Demo" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "integrations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "userRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "HubSettings" (
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

-- CreateIndex
CREATE UNIQUE INDEX "HubSettings_userId_key" ON "HubSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HubSettings_subdomain_key" ON "HubSettings"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "HubSettings_customDomain_key" ON "HubSettings"("customDomain");

-- AddForeignKey
ALTER TABLE "HubSettings" ADD CONSTRAINT "HubSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
