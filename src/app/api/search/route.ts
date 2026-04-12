import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/search";
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
  getParseCache,
} from "@/lib/search-cache";
import { logSearch } from "@/lib/analytics";

// 60s timeout — works on Vercel Pro, capped at 10s on Hobby
export const maxDuration = 60;

/**
 * Simple POST search endpoint. No SSE, no streaming.
 * Returns the full SearchResult as JSON.
 * Used as fallback when SSE fails on Vercel.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const mode = (req.nextUrl.searchParams.get("mode") || "buy") as
    | "buy"
    | "rent";

  if (!query.trim()) {
    return Response.json(
      { properties: [], summary: "", citations: [] },
      { status: 200 }
    );
  }

  const start = Date.now();

  try {
    // Check cache
    const cacheKey = buildSearchCacheKey(query, mode);
    const cached = await getSearchCache(cacheKey);
    if (cached) {
      logSearch({
        query,
        mode,
        commune: null,
        propertyType: null,
        resultCount: cached.properties.length,
        cacheHit: true,
        durationMs: Date.now() - start,
      }).catch(() => {});
      return Response.json(cached, {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }

    // Check enriched cache key
    const parseData = await getParseCache(query);
    if (parseData?.enrichedQuery && parseData?.parsed?.transactionType) {
      const effectiveMode =
        parseData.parsed.transactionType !== "any"
          ? parseData.parsed.transactionType
          : mode;
      const enrichedKey = buildSearchCacheKey(
        parseData.enrichedQuery,
        effectiveMode
      );
      if (enrichedKey !== cacheKey) {
        const enrichedCached = await getSearchCache(enrichedKey);
        if (enrichedCached) {
          await setSearchCache(cacheKey, enrichedCached);
          return Response.json(enrichedCached);
        }
      }
    }

    // Run pipeline
    const result = await runPipeline(query, mode);
    await setSearchCache(cacheKey, result);

    // Cache under enriched key too
    if (parseData?.enrichedQuery && parseData?.parsed?.transactionType) {
      const effectiveMode =
        parseData.parsed.transactionType !== "any"
          ? parseData.parsed.transactionType
          : mode;
      const enrichedKey = buildSearchCacheKey(
        parseData.enrichedQuery,
        effectiveMode
      );
      if (enrichedKey !== cacheKey) {
        await setSearchCache(enrichedKey, result);
      }
    }

    logSearch({
      query,
      mode,
      commune:
        parseData?.parsed?.commune ||
        parseData?.parsed?.neighborhood ||
        null,
      propertyType: parseData?.parsed?.propertyType || null,
      resultCount: result.properties.length,
      cacheHit: false,
      durationMs: Date.now() - start,
    }).catch(() => {});

    return Response.json(result, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    return Response.json(
      {
        properties: [],
        summary: "",
        citations: [],
        error: err instanceof Error ? err.message : "Search failed",
      },
      { status: 200 }
    );
  }
}
