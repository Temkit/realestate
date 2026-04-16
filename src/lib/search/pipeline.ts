/**
 * Search pipeline — orchestrates the full search flow.
 *
 * Steps:
 *  1. Parse query (Gemini, cached 24h)
 *  2. Discover URLs (Brave × 4 portals)
 *  3. Fetch data in parallel:
 *     a. og:fetch (free, cached 7d)
 *     b. Immotop categories (__NEXT_DATA__, free)
 *     c. Gemini URL Context (cached 7d via scrape cache)
 *     d. Firecrawl images (cached 7d, max 3 calls)
 *  4. Merge data sources per URL
 *  5. Filter junk + cross-portal dedup
 *  6. Filter by mode (rent/buy)
 *  7. Compute insights (data-driven badges)
 *  8. AI enrichment (Gemini summary + per-property insights)
 *  9. Return SearchResult
 *
 * Every step has try/catch — partial results returned if any step fails.
 */

import { analyzeQuery } from "@/lib/gemini";
import { scrapeImmotopCategoryPage } from "@/lib/firecrawl-scraper";
import {
  checkScrapeCache,
  setScrapeCache,
  getParseCache,
  setParseCache,
} from "@/lib/search-cache";
import { getTier1Communes } from "@/lib/communes";
import type { OgData } from "@/lib/search-cache";
import type { SearchResult, ScrapedListing } from "@/lib/types";

import { discoverUrls, filterListingUrls, isImmotopCategoryUrl } from "./brave";
import { fetchOgTags } from "./og-fetch";
import { geminiReadUrls } from "./gemini-reader";
import { firecrawlForImages } from "./firecrawl-images";
import { deduplicateListings } from "./dedup";
import { dedupedToProperty } from "./converter";
import { computeInsights } from "./insights";
import { enrichWithAI } from "./enrichment";
import { computeMarketAnalytics, fetchCommuneComparison } from "./market-analytics";
import { computePropertyFeatures } from "./property-features";
import { computeRentalYields } from "./yield-calculator";
import { trackSearchResults } from "@/lib/tracking";

export async function runPipeline(
  query: string,
  mode: "buy" | "rent"
): Promise<SearchResult> {
  // ── Step 1: Parse query ─────────────────────────────────────────────
  let enrichedQuery = query + " Luxembourg";
  let effectiveMode = mode;
  try {
    const cachedParse = await getParseCache(query);
    if (cachedParse) {
      enrichedQuery = cachedParse.enrichedQuery;
      effectiveMode =
        cachedParse.parsed.transactionType !== "any"
          ? cachedParse.parsed.transactionType
          : mode;
    } else {
      const { enrichedQuery: eq, parsed } = await analyzeQuery(query);
      enrichedQuery = eq;
      effectiveMode =
        parsed.transactionType !== "any" ? parsed.transactionType : mode;
      await setParseCache(query, { enrichedQuery: eq, parsed });
    }
  } catch {
    /* use defaults */
  }

  // ── Step 2: Discover URLs ───────────────────────────────────────────
  let braveResults: Awaited<ReturnType<typeof discoverUrls>> = [];
  try {
    braveResults = await discoverUrls(enrichedQuery);
  } catch {
    /* no URLs found */
  }

  let listingUrls = filterListingUrls(braveResults);

  // ── Step 2b: Auto-broaden if < 8 listing URLs ──────────────────────
  // Add tier 1 neighbors (5-10 min away) to get more results
  if (listingUrls.length < 8) {
    try {
      const cachedParse = await getParseCache(query);
      const commune = cachedParse?.parsed?.commune || cachedParse?.parsed?.neighborhood || "";
      // Use original query term (e.g. "bureau") not English parsed type ("office")
      const queryType = query.split(/\s+/)[0] || cachedParse?.parsed?.propertyType || "";
      if (commune) {
        const tier1 = getTier1Communes(commune);
        if (tier1.length > 0) {
          const nearbyQuery = `${queryType} ${tier1.join(" ")} Luxembourg`;
          const nearbyResults = await discoverUrls(nearbyQuery);
          // Merge, dedup by URL
          const existingUrls = new Set(braveResults.map((r) => r.url));
          for (const r of nearbyResults) {
            if (!existingUrls.has(r.url)) {
              existingUrls.add(r.url);
              braveResults.push(r);
            }
          }
          listingUrls = filterListingUrls(braveResults);
        }
      }
    } catch { /* broadening failed, continue with what we have */ }
  }

  const immotopCategories = [
    ...new Set(
      braveResults
        .filter((r) => isImmotopCategoryUrl(r.url))
        .map((r) => r.url)
    ),
  ].slice(0, 3);

  // ── Step 3: Fetch data (parallel) ───────────────────────────────────
  const ogResults: Record<string, OgData> = {};
  const categoryListings: ScrapedListing[] = [];
  let geminiListings: ScrapedListing[] = [];
  let firecrawlImages: Record<string, string> = {};

  // 3a + 3b: og:fetch + category pages (both free, run in parallel)
  const [ogSettled, catSettled] = await Promise.all([
    Promise.allSettled(
      listingUrls.map(async (url) => {
        try {
          const og = await fetchOgTags(url);
          if (og) ogResults[url] = og;
        } catch {
          /* skip */
        }
      })
    ),
    immotopCategories.length > 0
      ? Promise.allSettled(
          immotopCategories.map(async (url) => {
            try {
              const listings = await scrapeImmotopCategoryPage(url);
              categoryListings.push(...listings);
            } catch {
              /* skip */
            }
          })
        )
      : Promise.resolve([]),
  ]);
  void ogSettled;
  void catSettled;

  // 3c: Gemini URL Context for URLs still missing price
  const urlsNeedingData = listingUrls.filter(
    (u) => !(ogResults[u]?.price > 0)
  );
  const { cached: cachedListings, uncached: urlsToRead } =
    await checkScrapeCache(urlsNeedingData);
  try {
    geminiListings = await geminiReadUrls(urlsToRead);
    for (const listing of geminiListings)
      await setScrapeCache(listing.url, listing);
  } catch {
    /* Gemini failed — continue with what we have */
  }

  // 3d: Firecrawl for images (only URLs missing og:image)
  const urlsMissingImage = listingUrls.filter(
    (u) => !ogResults[u]?.ogImage
  );
  try {
    firecrawlImages = await firecrawlForImages(urlsMissingImage);
  } catch {
    /* continue without images */
  }

  // ── Step 4: Merge all data sources per URL ──────────────────────────
  const seenUrls = new Set<string>();
  const allListings: ScrapedListing[] = [];

  // Category listings first (immotop, most accurate)
  for (const l of categoryListings) {
    if (!seenUrls.has(l.url)) {
      seenUrls.add(l.url);
      allListings.push(l);
    }
  }

  // Gemini-read + cached listings
  for (const l of [...geminiListings, ...cachedListings]) {
    if (seenUrls.has(l.url)) continue;
    seenUrls.add(l.url);
    const og = ogResults[l.url];
    const fcImg = firecrawlImages[l.url];
    if (og?.ogImage) l.imageUrl = og.ogImage;
    if (fcImg) l.imageUrl = fcImg;
    if (og?.price && !l.price) l.price = og.price;
    if (og?.surface && !l.surface) l.surface = og.surface;
    allListings.push(l);
  }

  // URLs that only have og:data (no Gemini/category data)
  for (const url of listingUrls) {
    if (seenUrls.has(url)) continue;
    const og = ogResults[url];
    if (!og || (!og.price && !og.surface)) continue;
    seenUrls.add(url);
    const hostname = new URL(url).hostname.replace("www.", "");
    const titleMode =
      og.ogTitle && /louer|location|rent/i.test(og.ogTitle)
        ? ("rent" as const)
        : ("buy" as const);
    allListings.push({
      url,
      source: hostname,
      price: og.price,
      surface: og.surface,
      rooms: 0,
      bathrooms: 0,
      propertyType: "Property",
      city: "",
      address: "",
      imageUrl: og.ogImage || firecrawlImages[url] || null,
      contractType: titleMode,
      description: og.ogTitle || "",
    });
  }

  // ── Step 5: Filter junk + cross-portal dedup ────────────────────────
  const deduped = deduplicateListings(allListings);

  // ── Step 6: Filter by mode ──────────────────────────────────────────
  let filtered = deduped.filter((l) => l.contractType === effectiveMode);

  // ── Step 6b: Filter by commune relevance ────────────────────────────
  // If user searched a specific commune, only keep listings whose city
  // matches that commune OR its tier-1 neighbors (already auto-broadened).
  // Prevents Immotop/etc category pages from polluting with Luxembourg-wide results.
  try {
    const cachedParse = await getParseCache(query);
    const commune = cachedParse?.parsed?.commune || cachedParse?.parsed?.neighborhood || null;
    if (commune) {
      const allowed = new Set<string>();
      const normalize = (s: string) => s.toLowerCase().replace(/[-\s]+/g, "").trim();
      allowed.add(normalize(commune));
      for (const n of getTier1Communes(commune)) allowed.add(normalize(n));

      const beforeCount = filtered.length;
      const relevant = filtered.filter((l) => {
        if (!l.city) return true; // keep listings without city data (benefit of doubt)
        const city = normalize(l.city);
        // Match if the listing's city contains OR is contained in any allowed commune name
        // (handles "Mondorf" vs "Mondorf-les-Bains", "Luxembourg-Kirchberg" vs "Luxembourg")
        for (const a of allowed) {
          if (city.includes(a) || a.includes(city)) return true;
        }
        return false;
      });

      // Only apply filter if it leaves at least 1 result; otherwise keep all
      // (prevents showing zero results when city data is just unusual formatting)
      if (relevant.length >= 1) {
        filtered = relevant;
        void beforeCount;
      }
    }
  } catch { /* filter is optional, fall through with all results */ }

  // ── Step 7: Convert to Property[] ───────────────────────────────────
  const properties = filtered.map((listing, i) =>
    dedupedToProperty(listing, `prop-${Date.now()}-${i}`)
  );

  // ── Step 8: Market analytics (outlier-filtered) ─────────────────────
  const marketAnalytics = computeMarketAnalytics(properties, effectiveMode);

  // ── Step 9: Compute insights using outlier-filtered averages ────────
  computeInsights(properties, marketAnalytics);
  try {
    const parseData = await getParseCache(query);
    const commune =
      parseData?.parsed?.commune || parseData?.parsed?.neighborhood || null;
    const propertyType = parseData?.parsed?.propertyType || null;
    marketAnalytics.communeComparison = await fetchCommuneComparison(
      commune,
      propertyType,
      effectiveMode
    );
  } catch {
    /* commune comparison is optional */
  }

  // ── Step 10: Property features (pure math, never fails) ──────────────
  try {
    computePropertyFeatures(properties, effectiveMode, marketAnalytics);
  } catch {
    /* property features are optional */
  }

  // ── Step 11: Rental yields (async, buy mode only) ───────────────────
  try {
    await computeRentalYields(properties, effectiveMode);
  } catch {
    /* yields are optional */
  }

  // ── Step 12: AI enrichment ──────────────────────────────────────────
  let aiEnrichment = {
    summary: `Found ${properties.length} properties`,
    marketContext: "",
    suggestedFollowUps: [] as string[],
  };
  try {
    aiEnrichment = await enrichWithAI(properties, query, effectiveMode);
  } catch {
    /* use fallback summary */
  }

  // ── Step 13: Track prices + listings (fire-and-forget) ──────────────
  trackSearchResults(properties, effectiveMode).catch(() => {});

  return {
    properties,
    summary:
      aiEnrichment.summary || `Found ${properties.length} properties`,
    citations: listingUrls,
    suggestedFollowUps: aiEnrichment.suggestedFollowUps,
    marketContext: aiEnrichment.marketContext,
    marketAnalytics,
  };
}
