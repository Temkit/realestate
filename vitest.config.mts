import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Marketplace integration tests — run against a REAL libsql engine (a
 * file-backed DB), not mocks (per testing standards). globalSetup migrates +
 * seeds a fresh DB; tests exercise the actual data-layer functions.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false, // one sqlite file, avoid write contention
    env: {
      TURSO_DATABASE_URL: "file:./.vitest-marketplace.db",
      MARKETPLACE_SIGNING_SECRET: "test-signing-secret-0123456789abcdef",
    },
  },
});
