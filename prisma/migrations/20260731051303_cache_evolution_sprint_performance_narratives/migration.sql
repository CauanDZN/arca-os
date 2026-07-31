-- AlterTable
ALTER TABLE "Company" ADD COLUMN "performanceInsight" TEXT;
ALTER TABLE "Company" ADD COLUMN "performanceInsightUpdatedAt" DATETIME;

-- AlterTable
ALTER TABLE "Diagnostic" ADD COLUMN "evolutionNarrative" TEXT;
ALTER TABLE "Diagnostic" ADD COLUMN "sprintReportContent" TEXT;
ALTER TABLE "Diagnostic" ADD COLUMN "sprintReportUpdatedAt" DATETIME;
