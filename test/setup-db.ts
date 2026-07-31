import fs from "fs";
import path from "path";
import { Client } from "pg";

export default async function setup() {
  const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
  if (!TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL não definida. Crie um Postgres dedicado a testes (NÃO o mesmo do dev/produção " +
        "— o schema public é dropado e recriado a cada execução) e coloque a connection string em " +
        ".env.test.local, por exemplo:\nTEST_DATABASE_URL=\"postgres://user:pass@host/dbname\""
    );
  }

  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const migrationFolders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

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
