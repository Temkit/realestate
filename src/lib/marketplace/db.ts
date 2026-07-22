/**
 * Marketplace DB client — same Turso instance as the immo tracking tables.
 * Lazy singleton; returns null when env is missing (pages render an
 * explicit "DB not configured" state instead of crashing).
 */

import { createClient } from "@libsql/client";

let db: ReturnType<typeof createClient> | null = null;

export function getMarketplaceDb() {
  if (db) return db;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  db = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return db;
}

export function requireMarketplaceDb() {
  const client = getMarketplaceDb();
  if (!client) {
    throw new Error("TURSO_DATABASE_URL not configured");
  }
  return client;
}
