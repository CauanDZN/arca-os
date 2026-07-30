import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";
import os from "os";
import Database from "better-sqlite3";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "arca-os-test-"));
const dbPath = path.join(tmpDir, "test.db");

const migrationsDir = path.join(__dirname, "prisma", "migrations");
const migrationFolders = fs
  .readdirSync(migrationsDir)
  .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
  .sort();

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
for (const folder of migrationFolders) {
  const sql = fs.readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf-8");
  db.exec(sql);
}
db.close();

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
