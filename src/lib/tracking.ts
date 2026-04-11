/**
 * Price + listing tracking — stores historical data in Turso for future features.
 *
 * Tables:
 *   price_snapshots  — daily avg price per commune+type+mode (for trend lines)
 *   listing_tracker  — first/last seen per listing URL (for days-on-market)
 *
 * All writes are fire-and-forget — never block the search pipeline.
 */

import { createClient } from "@libsql/client";
import type { Property } from "./types";

let db: ReturnType<typeof createClient> | null = null;
let initialized = false;

function getDb() {
  if (db) return db;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  db = createClient({ url, authToken });
  return db;
}

async function ensureTables() {
  if (initialized) return;
  const client = getDb();
  if (!client) return;

  await client.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS price_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        commune TEXT NOT NULL,
        property_type TEXT NOT NULL,
        mode TEXT NOT NULL,
        avg_price REAL NOT NULL,
        median_price REAL NOT NULL,
        avg_ppsqm REAL NOT NULL,
        listing_count INTEGER NOT NULL,
        UNIQUE(date, commune, property_type, mode)
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_price_snapshots_lookup
        ON price_snapshots(commune, property_type, mode, date)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS listing_tracker (
        listing_url TEXT PRIMARY KEY,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        price REAL,
        surface REAL,
        commune TEXT,
        property_type TEXT,
        mode TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_listing_tracker_commune
        ON listing_tracker(commune, mode)`,
      args: [],
    },
  ]);

  initialized = true;
}

// ── Price snapshots ─────────────────────────────────────────────────────────

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function recordPriceSnapshots(
  properties: Property[],
  mode: "buy" | "rent"
): Promise<void> {
  const client = getDb();
  if (!client) return;
  await ensureTables();

  // Group by commune + propertyType
  const groups = new Map<
    string,
    { commune: string; type: string; prices: number[]; ppsqms: number[] }
  >();

  for (const p of properties) {
    if (!p.city || p.price <= 0) continue;
    const key = `${p.city}|${p.propertyType}`;
    const group = groups.get(key) || {
      commune: p.city,
      type: p.propertyType,
      prices: [],
      ppsqms: [],
    };
    group.prices.push(p.price);
    if (p.pricePerSqm && p.pricePerSqm > 0) group.ppsqms.push(p.pricePerSqm);
    groups.set(key, group);
  }

  const statements = [];
  for (const group of groups.values()) {
    if (group.prices.length === 0) continue;
    const sorted = [...group.prices].sort((a, b) => a - b);
    const avg = Math.round(sorted.reduce((s, p) => s + p, 0) / sorted.length);
    const med = Math.round(median(sorted));
    const avgPpsqm =
      group.ppsqms.length > 0
        ? Math.round(
            group.ppsqms.reduce((s, p) => s + p, 0) / group.ppsqms.length
          )
        : 0;

    statements.push({
      sql: `INSERT OR IGNORE INTO price_snapshots (date, commune, property_type, mode, avg_price, median_price, avg_ppsqm, listing_count)
            VALUES (date('now'), ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        group.commune,
        group.type,
        mode,
        avg,
        med,
        avgPpsqm,
        group.prices.length,
      ],
    });
  }

  if (statements.length > 0) {
    await client.batch(statements);
  }
}

// ── Listing tracker ─────────────────────────────────────────────────────────

async function trackListings(
  properties: Property[],
  mode: "buy" | "rent"
): Promise<void> {
  const client = getDb();
  if (!client) return;
  await ensureTables();

  const statements = [];
  for (const p of properties) {
    const urls = p.listingUrls || (p.listingUrl ? [p.listingUrl] : []);
    for (const url of urls) {
      if (!url) continue;
      statements.push({
        sql: `INSERT INTO listing_tracker (listing_url, first_seen, last_seen, price, surface, commune, property_type, mode)
              VALUES (?, date('now'), date('now'), ?, ?, ?, ?, ?)
              ON CONFLICT(listing_url) DO UPDATE SET
                last_seen = date('now'),
                price = COALESCE(excluded.price, listing_tracker.price),
                surface = COALESCE(excluded.surface, listing_tracker.surface)`,
        args: [
          url,
          p.price || null,
          p.sqft || null,
          p.city || null,
          p.propertyType || null,
          mode,
        ],
      });
    }
  }

  if (statements.length > 0) {
    await client.batch(statements);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Track all search results: price snapshots + listing URLs.
 * Fire-and-forget — never blocks the search pipeline.
 */
export async function trackSearchResults(
  properties: Property[],
  mode: "buy" | "rent"
): Promise<void> {
  try {
    await Promise.all([
      recordPriceSnapshots(properties, mode),
      trackListings(properties, mode),
    ]);
  } catch {
    /* tracking should never break the pipeline */
  }
}

/**
 * Get average rent per m² for a commune+type from price history.
 * Used by the yield calculator. Returns null if no data.
 */
export async function getRentEstimate(
  commune: string,
  propertyType: string
): Promise<number | null> {
  try {
    const client = getDb();
    if (!client) return null;
    await ensureTables();

    const result = await client.execute({
      sql: `SELECT AVG(avg_ppsqm) as rent_ppsqm
            FROM price_snapshots
            WHERE commune = ? AND property_type = ? AND mode = 'rent'
              AND avg_ppsqm > 0
              AND date > date('now', '-90 days')`,
      args: [commune, propertyType],
    });

    const val = result.rows[0]?.rent_ppsqm;
    return typeof val === "number" && val > 0 ? val : null;
  } catch {
    return null;
  }
}
