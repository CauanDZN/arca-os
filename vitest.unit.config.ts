import { defineConfig } from "vitest/config";

// Config para testes unitários puros (lib/*.test.ts que não tocam o banco).
// Sem globalSetup de Postgres — `npm test` (test/integration.test.ts) continua
// exigindo TEST_DATABASE_URL via .env.test.local.
// Uso: npx vitest run --config vitest.unit.config.ts
export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
