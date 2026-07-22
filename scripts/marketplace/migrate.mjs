/**
 * Apply the marketplace schema to Turso (or a local file DB).
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/marketplace/migrate.mjs
 *   TURSO_DATABASE_URL=file:./local-marketplace.db node scripts/marketplace/migrate.mjs
 */
import { createClient } from "@libsql/client";
import { STATEMENTS } from "./schema.mjs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}

const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

for (const sql of STATEMENTS) {
  await db.execute({ sql, args: [] });
}

const tables = await db.execute({
  sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  args: [],
});
console.log(
  `Migrated ${STATEMENTS.length} statements. Tables: ${tables.rows.map((r) => r.name).join(", ")}`
);
db.close();
