import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { Client } from "pg";

// Test-only secret lives in `.env.test.local` (gitignored, like `.env.local`)
// — kept deliberately separate. Loading the app's own `.env.local` here would
// also pull in GEMINI_API_KEY, which several tests rely on being *absent* to
// verify the AI agents' graceful fallback (see lib/ai.test.ts and the
// diagnostic-completion test in test/integration.test.ts).
dotenv.config({ path: path.join(__dirname, ".env.test.local") });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL não definida. Crie um Postgres dedicado a testes (NÃO o mesmo do dev/produção " +
      "— o schema public é dropado e recriado a cada execução) e coloque a connection string em " +
      ".env.test.local, por exemplo:\nTEST_DATABASE_URL=\"postgres://user:pass@host/dbname\""
  );
}

const migrationsDir = path.join(__dirname, "prisma", "migrations");
const migrationFolders = fs
  .readdirSync(migrationsDir)
  .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
  .sort();

async function setupTestDatabase() {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    for (const folder of migrationFolders) {
      const sql = fs.readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf-8");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

await setupTestDatabase();

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
