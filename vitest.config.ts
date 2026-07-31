import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// Test-only secret lives in `.env.test.local` (gitignored, like `.env.local`)
// — kept deliberately separate. Loading the app's own `.env.local` here would
// also pull in GEMINI_API_KEY, which several tests rely on being *absent* to
// verify the AI agents' graceful fallback (see lib/ai.test.ts and the
// diagnostic-completion test in test/integration.test.ts).
dotenv.config({ path: path.join(__dirname, ".env.test.local") });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: "./test/setup-db.ts",
    env: {
      DATABASE_URL: TEST_DATABASE_URL || "",
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});

