import { NextRequest } from "next/server";
import { analyzeQuery } from "@/lib/gemini";
import { scrapeImmotopCategoryPage } from "@/lib/firecrawl-scraper";
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
  checkScrapeCache,
  setScrapeCache,
  getParseCache,
  setParseCache,
} from "@/lib/search-cache";
import { getTier1Communes } from "@/lib/communes";
import { logSearch } from "@/lib/analytics";
import { trackSearchResults } from "@/lib/tracking";
import type { OgData } from "@/lib/search-cache";
import type { SearchResult, ScrapedListing, Property } from "@/lib/types";

import { discoverUrls, filterListingUrls, isImmotopCategoryUrl } from "@/lib/search/brave";
import { fetchOgTags } from "@/lib/search/og-fetch";
import { geminiReadUrls } from "@/lib/search/gemini-reader";
import { firecrawlForImages } from "@/lib/search/firecrawl-images";
import { deduplicateListings } from "@/lib/search/dedup";
import { dedupedToProperty } from "@/lib/search/converter";
import { computeInsights } from "@/lib/search/insights";
import { enrichWithAI } from "@/lib/search/enrichment";
import { computeMarketAnalytics, fetchCommuneComparison } from "@/lib/search/market-analytics";
import { computePropertyFeatures } from "@/lib/search/property-features";
import { computeRentalYields } from "@/lib/search/yield-calculator";

export const maxDuration = 60;

/**
 * SSE streaming search endpoint.
 * Sends events as each pipeline step completes:
 *   { type: "status", message: "..." }
 *   { type: "properties", data: Property[] }
 *   { type: "analytics", data: MarketAnalytics }
 *   { type: "enrichment", data: { summary, marketContext, suggestedFollowUps } }
 *   { type: "done", data: SearchResult }
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const mode = (req.nextUrl.searchParams.get("mode") || "buy") as "buy" | "rent";

  if (!query.trim()) {
    return Response.json({ error: "Empty query" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
        );
      };

      const start = Date.now();

      try {
        // ── Check full cache first ────────────────────────────────────
        const cacheKey = buildSearchCacheKey(query, mode);
        const cached = await getSearchCache(cacheKey);
        if (cached) {
          send("status", "Found cached results");
          send("done", cached);
          logSearch({ query, mode, commune: null, propertyType: null, resultCount: cached.properties.length, cacheHit: true, durationMs: Date.now() - start }).catch(() => {});
          controller.close();
          return;
        }

        // Also check enriched cache key
        let parseData = await getParseCache(query);
        if (parseData?.enrichedQuery && parseData?.parsed?.transactionType) {
          const effectiveMode = parseData.parsed.transactionType !== "any" ? parseData.parsed.transactionType : mode;
          const enrichedKey = buildSearchCacheKey(parseData.enrichedQuery, effectiveMode);
          if (enrichedKey !== cacheKey) {
            const enrichedCached = await getSearchCache(enrichedKey);
            if (enrichedCached) {
              await setSearchCache(cacheKey, enrichedCached);
              send("status", "Found cached results");
              send("done", enrichedCached);
              controller.close();
              return;
            }
          }
        }

        // ── Step 1: Parse query ───────────────────────────────────────
        send("status", "Understanding your query...");
        let enrichedQuery = query + " Luxembourg";
        let effectiveMode = mode;
        try {
          if (parseData) {
            enrichedQuery = parseData.enrichedQuery;
            effectiveMode = parseData.parsed.transactionType !== "any" ? parseData.parsed.transactionType : mode;
          } else {
            const { enrichedQuery: eq, parsed } = await analyzeQuery(query);
            enrichedQuery = eq;
            effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;
            await setParseCache(query, { enrichedQuery: eq, parsed });
            parseData = { enrichedQuery: eq, parsed };
          }
        } catch { /* use defaults */ }

        // ── Step 2: Discover URLs ─────────────────────────────────────
        send("status", "Searching 4 Luxembourg portals...");
        let braveResults: Awaited<ReturnType<typeof discoverUrls>> = [];
        try {
          braveResults = await discoverUrls(enrichedQuery);
        } catch { /* continue */ }

        let listingUrls = filterListingUrls(braveResults);
        send("status", `Found ${listingUrls.length} listings across portals`);

        // Auto-broaden if few results
        if (listingUrls.length < 8) {
          try {
            const commune = parseData?.parsed?.commune || parseData?.parsed?.neighborhood || "";
            // Use the original query term (e.g. "bureau") not the English parsed type ("office")
            const queryType = query.split(/\s+/)[0] || parseData?.parsed?.propertyType || "";
            if (commune) {
              const tier1 = getTier1Communes(commune);
              if (tier1.length > 0) {
                send("status", `Few results — also checking ${tier1.slice(0, 3).join(", ")}...`);
                const nearbyResults = await discoverUrls(`${queryType} ${tier1.join(" ")} Luxembourg`);
                const existing = new Set(braveResults.map((r) => r.url));
                for (const r of nearbyResults) {
                  if (!existing.has(r.url)) { existing.add(r.url); braveResults.push(r); }
                }
                listingUrls = filterListingUrls(braveResults);
                send("status", `Now ${listingUrls.length} listings with nearby areas`);
              }
            }
          } catch { /* continue */ }
        }

        const immotopCategories = [...new Set(
          braveResults.filter((r) => isImmotopCategoryUrl(r.url)).map((r) => r.url)
        )].slice(0, 3);

        // ── Step 3: Fetch data (parallel) ─────────────────────────────
        send("status", "Reading listing details...");
        const ogResults: Record<string, OgData> = {};
        const categoryListings: ScrapedListing[] = [];

        // 3a + 3b: og:fetch + categories
        await Promise.all([
          Promise.allSettled(
            listingUrls.map(async (url) => {
              try { const og = await fetchOgTags(url); if (og) ogResults[url] = og; } catch { /* skip */ }
            })
          ),
          immotopCategories.length > 0
            ? Promise.allSettled(
                immotopCategories.map(async (url) => {
                  try { categoryListings.push(...await scrapeImmotopCategoryPage(url)); } catch { /* skip */ }
                })
              )
            : Promise.resolve([]),
        ]);

        // 3c: Gemini URL Context
        const urlsNeedingData = listingUrls.filter((u) => !(ogResults[u]?.price > 0));
        const { cached: cachedListings, uncached: urlsToRead } = await checkScrapeCache(urlsNeedingData);

        send("status", `Extracting data from ${urlsToRead.length} pages with AI...`);
        let geminiListings: ScrapedListing[] = [];
        try {
          geminiListings = await geminiReadUrls(urlsToRead);
          for (const listing of geminiListings) await setScrapeCache(listing.url, listing);
        } catch { /* continue */ }

        // ── Step 4: Merge ─────────────────────────────────────────────
        const seenUrls = new Set<string>();
        const allListings: ScrapedListing[] = [];
        for (const l of categoryListings) { if (!seenUrls.has(l.url)) { seenUrls.add(l.url); allListings.push(l); } }
        for (const l of [...geminiListings, ...cachedListings]) {
          if (seenUrls.has(l.url)) continue;
          seenUrls.add(l.url);
          const og = ogResults[l.url];
          const fc: Record<string, string> = {}; // firecrawl runs later
          if (og?.ogImage) l.imageUrl = og.ogImage;
          if (og?.price && !l.price) l.price = og.price;
          if (og?.surface && !l.surface) l.surface = og.surface;
          void fc;
          allListings.push(l);
        }
        for (const url of listingUrls) {
          if (seenUrls.has(url)) continue;
          const og = ogResults[url];
          if (!og || (!og.price && !og.surface)) continue;
          seenUrls.add(url);
          const hostname = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; } })();
          const titleMode = og.ogTitle && /louer|location|rent/i.test(og.ogTitle) ? "rent" as const : "buy" as const;
          allListings.push({ url, source: hostname, price: og.price, surface: og.surface, rooms: 0, bathrooms: 0, propertyType: "Property", city: "", address: "", imageUrl: og.ogImage || null, contractType: titleMode, description: og.ogTitle || "" });
        }

        // ── Step 5: Dedup + filter ────────────────────────────────────
        const deduped = deduplicateListings(allListings);
        const filtered = deduped.filter((l) => l.contractType === effectiveMode);
        const properties: Property[] = filtered.map((listing, i) =>
          dedupedToProperty(listing, `prop-${Date.now()}-${i}`)
        );

        // ── Step 6: Send first batch of properties ────────────────────
        send("status", `Found ${properties.length} properties, analyzing...`);
        if (properties.length > 0) {
          send("properties", properties);
        }

        // ── Step 7: Insights ──────────────────────────────────────────
        computeInsights(properties);

        // ── Step 8: Market analytics ──────────────────────────────────
        const marketAnalytics = computeMarketAnalytics(properties, effectiveMode);
        try {
          const commune = parseData?.parsed?.commune || parseData?.parsed?.neighborhood || null;
          const propertyType = parseData?.parsed?.propertyType || null;
          marketAnalytics.communeComparison = await fetchCommuneComparison(commune, propertyType, effectiveMode);
        } catch { /* optional */ }
        send("analytics", marketAnalytics);

        // ── Step 9: Property features ─────────────────────────────────
        try { computePropertyFeatures(properties, effectiveMode, marketAnalytics); } catch { /* optional */ }
        try { await computeRentalYields(properties, effectiveMode); } catch { /* optional */ }

        // Send updated properties with features
        if (properties.length > 0) {
          send("properties", properties);
        }

        // ── Step 10: AI enrichment ────────────────────────────────────
        send("status", "Generating market insights...");
        let aiEnrichment = { summary: `Found ${properties.length} properties`, marketContext: "", suggestedFollowUps: [] as string[] };
        try {
          aiEnrichment = await enrichWithAI(properties, query, effectiveMode);
        } catch { /* use fallback */ }
        send("enrichment", aiEnrichment);

        // ── Step 11: Firecrawl images (background, sends update) ──────
        const urlsMissingImage = properties.filter((p) => !p.imageUrl).map((p) => p.listingUrl || p.listingUrls?.[0] || "").filter(Boolean);
        if (urlsMissingImage.length > 0) {
          send("status", "Loading property images...");
          try {
            const fcImages = await firecrawlForImages(urlsMissingImage);
            let updated = false;
            for (const p of properties) {
              const url = p.listingUrl || p.listingUrls?.[0] || "";
              if (!p.imageUrl && fcImages[url]) { p.imageUrl = fcImages[url]; updated = true; }
            }
            if (updated) send("properties", properties);
          } catch { /* images are optional */ }
        }

        // ── Step 12: Build final result + cache ───────────────────────
        const result: SearchResult = {
          properties,
          summary: aiEnrichment.summary || `Found ${properties.length} properties`,
          citations: listingUrls,
          suggestedFollowUps: aiEnrichment.suggestedFollowUps,
          marketContext: aiEnrichment.marketContext,
          marketAnalytics,
        };

        // Cache under both raw and enriched keys
        await setSearchCache(cacheKey, result);
        if (parseData?.enrichedQuery && parseData?.parsed?.transactionType) {
          const enrichedKey = buildSearchCacheKey(parseData.enrichedQuery, parseData.parsed.transactionType !== "any" ? parseData.parsed.transactionType : mode);
          if (enrichedKey !== cacheKey) await setSearchCache(enrichedKey, result);
        }

        // Track + log
        trackSearchResults(properties, effectiveMode).catch(() => {});
        logSearch({
          query, mode: effectiveMode,
          commune: parseData?.parsed?.commune || parseData?.parsed?.neighborhood || null,
          propertyType: parseData?.parsed?.propertyType || null,
          resultCount: properties.length,
          cacheHit: false,
          durationMs: Date.now() - start,
        }).catch(() => {});

        send("done", result);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Search failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
