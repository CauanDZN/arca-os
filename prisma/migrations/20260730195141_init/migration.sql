-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "marketAge" TEXT NOT NULL,
    "employees" TEXT NOT NULL,
    "avgRevenue" TEXT NOT NULL,
    "margin" TEXT NOT NULL,
    "activeClients" TEXT NOT NULL,
    "productsServices" TEXT NOT NULL,
    "cities" TEXT NOT NULL,
    "painPoints" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'em_andamento',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Diagnostic_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosticId" TEXT NOT NULL,
    "areaKey" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Answer_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "Diagnostic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Answer_diagnosticId_areaKey_questionId_key" ON "Answer"("diagnosticId", "areaKey", "questionId");
