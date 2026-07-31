-- AddPortalAndMonthlyReport
-- Gestão contínua: Portal do Cliente (pendências, histórico de decisões e
-- comunicação com a Arca) + Relatório Mensal automático do Comitê de Gestão.

CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "decidedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "overallAverage" DOUBLE PRECISION NOT NULL,
    "maturityLevel" INTEGER NOT NULL,
    "maturityLabel" TEXT NOT NULL,
    "areaAverages" TEXT NOT NULL,
    "taskStats" TEXT NOT NULL,
    "pendingCount" INTEGER NOT NULL,
    "decisionsCount" INTEGER NOT NULL,
    "kpiCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Decision_companyId_idx" ON "Decision"("companyId");
CREATE INDEX "Message_companyId_idx" ON "Message"("companyId");
CREATE INDEX "MonthlyReport_companyId_idx" ON "MonthlyReport"("companyId");

CREATE UNIQUE INDEX "MonthlyReport_companyId_period_key" ON "MonthlyReport"("companyId", "period");

ALTER TABLE "Decision" ADD CONSTRAINT "Decision_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
