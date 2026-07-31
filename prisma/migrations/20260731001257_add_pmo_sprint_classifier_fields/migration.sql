-- AlterTable
ALTER TABLE "Document" ADD COLUMN "aiConfidence" TEXT;
ALTER TABLE "Document" ADD COLUMN "aiSuggestedCategory" TEXT;

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "Diagnostic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("areaKey", "areaName", "createdAt", "diagnosticId", "id", "position", "priority", "status", "timeframe", "title", "updatedAt") SELECT "areaKey", "areaName", "createdAt", "diagnosticId", "id", "position", "priority", "status", "timeframe", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
