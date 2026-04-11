"use server";

/**
 * Server actions — thin layer over the search pipeline.
 * Handles: rate limiting, caching, analytics logging.
 * All search logic lives in @/lib/search/.
 */

import { headers } from "next/headers";
import { analyzeQuery } from "@/lib/gemini";
import { compareProperties, getNeighborhoodAnalysis } from "@/lib/perplexity";
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
  getParseCache,
} from "@/lib/search-cache";
import { getNearbyCommunes } from "@/lib/communes";
import { checkRateLimit } from "@/lib/rate-limit";
import { logSearch } from "@/lib/analytics";
import { runPipeline } from "@/lib/search";
import type {
  SearchResult,
  NeighborhoodData,
  ConversationTurn,
} from "@/lib/types";

// ── Rate limiting ─────────────��─────────────────────────────────────────────

async function enforceRateLimit() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    throw new Error(
      `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
    );
  }
}

// ── Search ────────────���──────────────────────────────���──────────────────────

export async function searchAction(
  query: string,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  if (!query.trim()) return { properties: [], summary: "", citations: [] };
  await enforceRateLimit();
  const start = Date.now();

  // Check cache under raw query key
  const cacheKey = buildSearchCacheKey(query, mode);
  const cached = await getSearchCache(cacheKey);
  if (cached) {
    logSearch({ query, mode, commune: null, propertyType: null, resultCount: cached.properties.length, cacheHit: true, durationMs: Date.now() - start }).catch(() => {});
    return cached;
  }

  // Also check under enriched query key (e.g. "bureau mondorf" → "bureau Mondorf-les-Bains")
  let parseData: Awaited<ReturnType<typeof getParseCache>> = null;
  try {
    parseData = await getParseCache(query);
    if (parseData?.enrichedQuery && parseData?.parsed?.transactionType) {
      const effectiveMode = parseData.parsed.transactionType !== "any" ? parseData.parsed.transactionType : mode;
      const enrichedKey = buildSearchCacheKey(parseData.enrichedQuery, effectiveMode);
      if (enrichedKey !== cacheKey) {
        const enrichedCached = await getSearchCache(enrichedKey);
        if (enrichedCached) {
          await setSearchCache(cacheKey, enrichedCached);
          logSearch({ query, mode, commune: parseData.parsed.commune || parseData.parsed.neighborhood || null, propertyType: parseData.parsed.propertyType || null, resultCount: enrichedCached.properties.length, cacheHit: true, durationMs: Date.now() - start }).catch(() => {});
          return enrichedCached;
        }
      }
    }
  } catch { /* enriched lookup failed, continue to pipeline */ }

  const result = await runPipeline(query, mode);

  // Cache under both raw AND enriched query keys
  await setSearchCache(cacheKey, result);
  if (!parseData) {
    try { parseData = await getParseCache(query); } catch { /* ignore */ }
  }
  try {
    if (parseData?.enrichedQuery && parseData?.parsed?.transactionType) {
      const effectiveMode = parseData.parsed.transactionType !== "any" ? parseData.parsed.transactionType : mode;
      const enrichedKey = buildSearchCacheKey(parseData.enrichedQuery, effectiveMode);
      if (enrichedKey !== cacheKey) {
        await setSearchCache(enrichedKey, result);
      }
    }
  } catch { /* enriched cache save failed, not critical */ }

  logSearch({
    query,
    mode,
    commune: parseData?.parsed?.commune || parseData?.parsed?.neighborhood || null,
    propertyType: parseData?.parsed?.propertyType || null,
    resultCount: result.properties.length,
    cacheHit: false,
    durationMs: Date.now() - start,
  }).catch(() => {});

  return result;
}

// ── Expanded search (nearby communes) ───────────────────────────────────────

export async function expandedSearchAction(
  query: string,
  preferenceHints: string | null,
  mode: "buy" | "rent" = "buy",
  primaryListingUrls: string[] = []
): Promise<SearchResult> {
  if (!query.trim()) return { properties: [], summary: "", citations: [] };
  await enforceRateLimit();

  try {
    const { parsed } = await analyzeQuery(query);
    const commune = parsed.neighborhood || parsed.commune || "";
    const nearby = getNearbyCommunes(commune);
    if (nearby.length === 0)
      return { properties: [], summary: "", citations: [] };

    let nearbyQuery = `${parsed.propertyType || ""} ${nearby.slice(0, 3).join(" ")} Luxembourg`;
    if (preferenceHints) nearbyQuery += ` ${preferenceHints}`;

    const cacheKey = buildSearchCacheKey(nearbyQuery, mode);
    const cached = await getSearchCache(cacheKey);
    if (cached) {
      // Filter out primary results even from cache
      if (primaryListingUrls.length > 0) {
        const primarySet = new Set(primaryListingUrls);
        const filtered = cached.properties.filter(
          (p) => !p.listingUrls?.some((u) => primarySet.has(u)) && !primarySet.has(p.listingUrl || "")
        );
        return { ...cached, properties: filtered };
      }
      return cached;
    }

    const result = await runPipeline(nearbyQuery, mode);
    await setSearchCache(cacheKey, result);

    // Filter out properties already in primary results
    if (primaryListingUrls.length > 0) {
      const primarySet = new Set(primaryListingUrls);
      const filtered = result.properties.filter(
        (p) => !p.listingUrls?.some((u) => primarySet.has(u)) && !primarySet.has(p.listingUrl || "")
      );
      return { ...result, properties: filtered };
    }

    return result;
  } catch {
    return { properties: [], summary: "", citations: [] };
  }
}

// ��─ Refine search ────────────���──────────────────────────────────────────────

export async function refineSearchAction(
  query: string,
  _previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<SearchResult> {
  if (!query.trim()) return { properties: [], summary: "", citations: [] };
  // Reuse searchAction — same cache logic with enriched key lookup
  return searchAction(query, mode as "buy" | "rent");
}

// ── Compare + Neighborhood ──────────────────────────────────────────────────

export async function compareAction(
  properties: {
    address: string;
    city: string;
    price: number;
    sqft: number;
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
    features: string[];
  }[]
): Promise<string> {
  await enforceRateLimit();
  return compareProperties(properties);
}

export async function neighborhoodAction(
  address: string,
  city: string,
  state: string
): Promise<NeighborhoodData> {
  await enforceRateLimit();
  return getNeighborhoodAnalysis(address, city, state);
}
