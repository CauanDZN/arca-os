-- DropIndex
DROP INDEX "Decision_companyId_idx";

-- DropIndex
DROP INDEX "Message_companyId_idx";

-- DropIndex
DROP INDEX "MonthlyReport_companyId_idx";

-- DropIndex
DROP INDEX "User_companyId_idx";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "onboardingResponsible" TEXT NOT NULL DEFAULT '';
