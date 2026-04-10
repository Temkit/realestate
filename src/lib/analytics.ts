import { createClient } from "@libsql/client";

// ── Turso client ────────────────────────────────────────────────────────────

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

async function ensureTable() {
  if (initialized) return;
  const client = getDb();
  if (!client) return;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      mode TEXT NOT NULL,
      commune TEXT,
      property_type TEXT,
      result_count INTEGER NOT NULL DEFAULT 0,
      cache_hit INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at)
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_search_logs_commune ON search_logs(commune)
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query)
  `);

  initialized = true;
}

// ── Log a search ────────────────────────────────────────────────────────────

export async function logSearch(params: {
  query: string;
  mode: "buy" | "rent";
  commune: string | null;
  propertyType: string | null;
  resultCount: number;
  cacheHit: boolean;
  durationMs: number;
}): Promise<void> {
  try {
    await ensureTable();
    const client = getDb();
    if (!client) return;

    await client.execute({
      sql: `INSERT INTO search_logs (query, mode, commune, property_type, result_count, cache_hit, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        params.query,
        params.mode,
        params.commune || null,
        params.propertyType || null,
        params.resultCount,
        params.cacheHit ? 1 : 0,
        params.durationMs,
      ],
    });
  } catch {
    // Analytics should never break the search
  }
}

// ── Query analytics ─────────────────────────────────────────────────────────

export async function getTopSearches(days: number = 30, limit: number = 20) {
  try {
    await ensureTable();
    const client = getDb();
    if (!client) return [];

    const result = await client.execute({
      sql: `SELECT query, mode, COUNT(*) as count,
              AVG(duration_ms) as avg_ms,
              AVG(result_count) as avg_results,
              SUM(cache_hit) * 100.0 / COUNT(*) as cache_hit_pct
            FROM search_logs
            WHERE created_at > datetime('now', ?)
            GROUP BY query, mode
            ORDER BY count DESC
            LIMIT ?`,
      args: [`-${days} days`, limit],
    });
    return result.rows;
  } catch { return []; }
}

export async function getTopCommunes(days: number = 30, limit: number = 15) {
  try {
    await ensureTable();
    const client = getDb();
    if (!client) return [];

    const result = await client.execute({
      sql: `SELECT commune, COUNT(*) as count,
              mode,
              AVG(result_count) as avg_results
            FROM search_logs
            WHERE commune IS NOT NULL
              AND created_at > datetime('now', ?)
            GROUP BY commune, mode
            ORDER BY count DESC
            LIMIT ?`,
      args: [`-${days} days`, limit],
    });
    return result.rows;
  } catch { return []; }
}

export async function getTopPropertyTypes(days: number = 30) {
  try {
    await ensureTable();
    const client = getDb();
    if (!client) return [];

    const result = await client.execute({
      sql: `SELECT property_type, mode, COUNT(*) as count
            FROM search_logs
            WHERE property_type IS NOT NULL
              AND created_at > datetime('now', ?)
            GROUP BY property_type, mode
            ORDER BY count DESC`,
      args: [`-${days} days`],
    });
    return result.rows;
  } catch { return []; }
}

export async function getZeroResultQueries(days: number = 7, limit: number = 20) {
  try {
    await ensureTable();
    const client = getDb();
    if (!client) return [];

    const result = await client.execute({
      sql: `SELECT query, mode, COUNT(*) as count
            FROM search_logs
            WHERE result_count = 0
              AND created_at > datetime('now', ?)
            GROUP BY query, mode
            ORDER BY count DESC
            LIMIT ?`,
      args: [`-${days} days`, limit],
    });
    return result.rows;
  } catch { return []; }
}

export async function getStats(days: number = 30) {
  try {
    await ensureTable();
    const client = getDb();
    if (!client) return null;

    const result = await client.execute({
      sql: `SELECT
              COUNT(*) as total_searches,
              COUNT(DISTINCT query) as unique_queries,
              AVG(duration_ms) as avg_duration_ms,
              AVG(CASE WHEN cache_hit = 0 THEN duration_ms END) as avg_cold_ms,
              AVG(CASE WHEN cache_hit = 1 THEN duration_ms END) as avg_cached_ms,
              SUM(cache_hit) * 100.0 / COUNT(*) as cache_hit_pct,
              AVG(result_count) as avg_results,
              SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as zero_result_pct
            FROM search_logs
            WHERE created_at > datetime('now', ?)`,
      args: [`-${days} days`],
    });
    return result.rows[0] || null;
  } catch { return null; }
}
