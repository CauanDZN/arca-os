-- CreateTable
CREATE TABLE "ErpConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpConnection_companyId_provider_key" ON "ErpConnection"("companyId", "provider");

-- AddForeignKey
ALTER TABLE "ErpConnection" ADD CONSTRAINT "ErpConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Company.omieAppKey/omieAppSecret vira uma linha em ErpConnection
-- (provider = 'omie') antes das colunas antigas serem derrubadas — sem isso,
-- toda empresa já conectada à Omie perderia a credencial nesta migration.
INSERT INTO "ErpConnection" ("id", "companyId", "provider", "appKey", "appSecret", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'omie', "omieAppKey", "omieAppSecret", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company"
WHERE "omieAppKey" IS NOT NULL AND "omieAppSecret" IS NOT NULL;

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "omieAppKey",
DROP COLUMN "omieAppSecret";
