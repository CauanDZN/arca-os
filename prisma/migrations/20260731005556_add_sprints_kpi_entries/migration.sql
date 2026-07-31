-- CreateTable
CREATE TABLE "KpiEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "areaKey" TEXT NOT NULL,
    "indicatorName" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosticId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sprint_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "Diagnostic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosticId" TEXT NOT NULL,
    "areaKey" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "position" INTEGER NOT NULL DEFAULT 0,
    "responsible" TEXT NOT NULL DEFAULT '',
    "dueDate" DATETIME,
    "sprintId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "Diagnostic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("areaKey", "areaName", "createdAt", "diagnosticId", "dueDate", "id", "position", "priority", "responsible", "status", "timeframe", "title", "updatedAt") SELECT "areaKey", "areaName", "createdAt", "diagnosticId", "dueDate", "id", "position", "priority", "responsible", "status", "timeframe", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "KpiEntry_companyId_areaKey_indicatorName_month_key" ON "KpiEntry"("companyId", "areaKey", "indicatorName", "month");
