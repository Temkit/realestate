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
import { getTier2Communes } from "@/lib/communes";
import { getSimilarTypes } from "@/lib/search/type-synonyms";
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
    const propertyType = parsed.propertyType || "";

    // Two search strategies: tier 2 geography + similar types
    const queries: string[] = [];

    // Strategy 1: Same type, farther communes (tier 2)
    const tier2 = getTier2Communes(commune);
    if (tier2.length > 0) {
      queries.push(`${propertyType} ${tier2.slice(0, 3).join(" ")} Luxembourg`);
    }

    // Strategy 2: Similar types, same area
    const similarTypes = getSimilarTypes(propertyType);
    if (similarTypes.length > 0 && commune) {
      queries.push(`${similarTypes[0]} ${commune} Luxembourg`);
    }

    if (queries.length === 0)
      return { properties: [], summary: "", citations: [] };

    // Run all queries, merge results
    const allProperties: SearchResult["properties"] = [];
    const allCitations: string[] = [];
    const primarySet = new Set(primaryListingUrls);

    for (const q of queries) {
      const expandedQuery = preferenceHints ? `${q} ${preferenceHints}` : q;
      const cacheKey = buildSearchCacheKey(expandedQuery, mode);
      let result = await getSearchCache(cacheKey);
      if (!result) {
        result = await runPipeline(expandedQuery, mode);
        await setSearchCache(cacheKey, result);
      }

      for (const p of result.properties) {
        // Skip properties already in primary results
        const urls = p.listingUrls || (p.listingUrl ? [p.listingUrl] : []);
        if (urls.some((u) => primarySet.has(u))) continue;
        // Skip duplicates within expanded
        if (allProperties.some((ep) => ep.id === p.id)) continue;
        allProperties.push(p);
      }
      allCitations.push(...(result.citations || []));
    }

    return {
      properties: allProperties,
      summary: allProperties.length > 0
        ? `${allProperties.length} similar options nearby`
        : "",
      citations: [...new Set(allCitations)],
    };
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
