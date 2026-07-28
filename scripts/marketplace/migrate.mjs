/**
 * Apply the marketplace schema to Turso (or a local file DB).
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/marketplace/migrate.mjs
 *   TURSO_DATABASE_URL=file:./local-marketplace.db node scripts/marketplace/migrate.mjs
 */
import { createClient } from "@libsql/client";
import { STATEMENTS, ALTERS, POST_INDEXES } from "./schema.mjs";

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

// ADD COLUMN only when missing (idempotent for already-migrated DBs)
for (const { table, column, ddl } of ALTERS) {
  const info = await db.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
  const exists = info.rows.some((r) => r.name === column);
  if (!exists) {
    await db.execute({ sql: ddl, args: [] });
    console.log(`Added column ${table}.${column}`);
  }
}

// Indexes that depend on the columns added above
for (const sql of POST_INDEXES) {
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
