/**
 * Market analytics — computed from search results, zero API cost.
 *
 * Provides:
 *   - Price range (min/max/avg/median)
 *   - Price per m² stats
 *   - Price distribution (histogram buckets)
 *   - Supply level (low/medium/high)
 *   - Portal coverage
 *   - Commune comparison (from Turso search history)
 */

import type { Property, MarketAnalytics } from "@/lib/types";
import { createClient } from "@libsql/client";

// ── Pure computation (sync, never fails) ────────────────────────────────────

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Percentile from sorted array (0-100). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Remove statistical outliers using IQR method (Tukey's fences).
 * Keeps values in [Q1 - 1.5*IQR, Q3 + 1.5*IQR].
 * With < 4 values, no filtering (not enough data).
 */
function removeOutliers(sorted: number[]): number[] {
  if (sorted.length < 4) return sorted;
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((v) => v >= lo && v <= hi);
}

/**
 * Sanity-check a price for buy/rent mode to filter obvious data errors.
 */
function isPriceSane(price: number, mode: "buy" | "rent"): boolean {
  if (price <= 0) return false;
  if (mode === "rent") return price >= 200 && price <= 50000;
  return price >= 50000 && price <= 20000000;
}

/** Sanity check for €/m². */
function isPpsqmSane(ppsqm: number, mode: "buy" | "rent"): boolean {
  if (ppsqm <= 0) return false;
  if (mode === "rent") return ppsqm >= 5 && ppsqm <= 200;
  return ppsqm >= 500 && ppsqm <= 50000;
}

/**
 * Round a number up to a "nice" bucket width.
 * e.g., 37000 → 50000, 1200 → 1500, 180 → 200
 */
function niceBucketWidth(raw: number): number {
  if (raw <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatPrice(value: number, mode: "buy" | "rent"): string {
  if (mode === "rent") {
    return `€${value.toLocaleString()}`;
  }
  if (value >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(1)}M`;
  }
  return `€${Math.round(value / 1000)}k`;
}

/**
 * Compute market analytics from search results. Pure math, no API calls.
 * Returns sensible defaults when data is insufficient.
 */
export function computeMarketAnalytics(
  properties: Property[],
  mode: "buy" | "rent"
): MarketAnalytics {
  // ── Price range ─────────────────────────────────────────────────────
  // 1. Filter by sane price range (removes obvious data errors)
  // 2. Sort and remove IQR outliers (removes statistical skew)
  const sanePrices = properties
    .filter((p) => isPriceSane(p.price, mode))
    .map((p) => p.price)
    .sort((a, b) => a - b);

  const prices = removeOutliers(sanePrices);

  const priceRange =
    prices.length > 0
      ? {
          min: prices[0],
          max: prices[prices.length - 1],
          avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
          median: Math.round(median(prices)),
        }
      : null;

  // ── Price per m² ────────────────────────────────────────────────────
  const sanePpsqms = properties
    .filter((p) => p.pricePerSqm && isPpsqmSane(p.pricePerSqm, mode))
    .map((p) => p.pricePerSqm!)
    .sort((a, b) => a - b);

  const ppsqms = removeOutliers(sanePpsqms);

  const pricePerSqm =
    ppsqms.length > 0
      ? {
          min: ppsqms[0],
          max: ppsqms[ppsqms.length - 1],
          avg: Math.round(
            ppsqms.reduce((s, p) => s + p, 0) / ppsqms.length
          ),
        }
      : null;

  // ── Price distribution (5-8 buckets) ────────────────────────────────
  const priceDistribution: MarketAnalytics["priceDistribution"] = [];

  if (prices.length >= 2) {
    const min = prices[0];
    const max = prices[prices.length - 1];
    const range = max - min;
    const targetBuckets = Math.min(Math.max(3, prices.length), 7);
    const rawWidth = range / targetBuckets;
    const bucketWidth = niceBucketWidth(rawWidth);
    const bucketStart = Math.floor(min / bucketWidth) * bucketWidth;

    for (
      let start = bucketStart;
      start < max + bucketWidth;
      start += bucketWidth
    ) {
      const end = start + bucketWidth;
      const count = prices.filter((p) => p >= start && p < end).length;
      if (count > 0) {
        const label =
          mode === "rent"
            ? `${formatPrice(start, mode)}–${formatPrice(end, mode)}/mo`
            : `${formatPrice(start, mode)}–${formatPrice(end, mode)}`;
        priceDistribution.push({ label, min: start, max: end, count });
      }
    }
  }

  // ── Supply level ────────────────────────────────────────────────────
  const total = properties.length;
  const supplyLevel: MarketAnalytics["supplyLevel"] =
    total <= 3 ? "low" : total <= 8 ? "medium" : "high";

  // ── Portal coverage ─────────────────────────────────────────────────
  const portalMap = new Map<string, number>();
  for (const p of properties) {
    const sources = p.sources || (p.source ? [p.source] : []);
    for (const s of sources) {
      portalMap.set(s, (portalMap.get(s) || 0) + 1);
    }
  }
  const portalCoverage = [...portalMap.entries()]
    .map(([portal, count]) => ({ portal, count }))
    .sort((a, b) => b.count - a.count);

  return {
    priceRange,
    pricePerSqm,
    priceDistribution,
    supplyLevel,
    portalCoverage,
    communeComparison: null, // filled async by fetchCommuneComparison
  };
}

// ── Commune comparison from Turso (async) ───────────────────────────────────

/**
 * Query Turso for search demand in similar communes.
 * Returns top 5 communes where users searched for the same property type + mode.
 * Returns null if Turso is unavailable or no data exists.
 */
export async function fetchCommuneComparison(
  currentCommune: string | null,
  propertyType: string | null,
  mode: "buy" | "rent"
): Promise<MarketAnalytics["communeComparison"]> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;

  try {
    const db = createClient({ url, authToken });

    const conditions: string[] = [
      "mode = ?",
      "commune IS NOT NULL",
      "created_at > datetime('now', '-30 days')",
    ];
    const args: (string | null)[] = [mode];

    if (propertyType) {
      conditions.push("property_type = ?");
      args.push(propertyType);
    }
    if (currentCommune) {
      conditions.push("commune != ?");
      args.push(currentCommune);
    }

    const result = await db.execute({
      sql: `SELECT commune, COUNT(*) as search_count, ROUND(AVG(result_count)) as avg_results
            FROM search_logs
            WHERE ${conditions.join(" AND ")}
            GROUP BY commune
            ORDER BY search_count DESC
            LIMIT 5`,
      args,
    });

    if (!result.rows || result.rows.length === 0) return null;

    return result.rows.map((r) => ({
      commune: r.commune as string,
      searchCount: Number(r.search_count) || 0,
      avgResults: Number(r.avg_results) || 0,
    }));
  } catch {
    return null;
  }
}
