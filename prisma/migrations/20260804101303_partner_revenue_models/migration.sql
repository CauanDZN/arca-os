-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "curationFeeValue" DOUBLE PRECISION,
ADD COLUMN     "npsScore" INTEGER,
ADD COLUMN     "revenueModel" TEXT NOT NULL DEFAULT 'comissionamento',
ADD COLUMN     "revenueSharePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PartnerReferral" ADD COLUMN     "clientSatisfaction" INTEGER,
ADD COLUMN     "respondedAt" TIMESTAMP(3);
