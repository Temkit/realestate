import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const DB_FILE = ".vitest-marketplace.db";
const DB_URL = `file:./${DB_FILE}`;

/** Fresh migrated + seeded DB before the whole run. */
export default function setup() {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(DB_FILE + suffix, { force: true });
  }
  const env = { ...process.env, TURSO_DATABASE_URL: DB_URL };
  execFileSync("node", ["scripts/marketplace/migrate.mjs"], { env, stdio: "inherit" });
  execFileSync("node", ["scripts/marketplace/seed.mjs"], { env, stdio: "inherit" });
}
