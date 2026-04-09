"use server";

import { headers } from "next/headers";
import { analyzeQuery } from "@/lib/gemini";
import {
  compareProperties,
  getNeighborhoodAnalysis,
} from "@/lib/perplexity";
import { scrapeMultipleUrls } from "@/lib/firecrawl-scraper";
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
  checkScrapeCache,
  setScrapeCache,
} from "@/lib/search-cache";
import { getNearbyCommunes } from "@/lib/communes";
import { checkRateLimit } from "@/lib/rate-limit";
import type {
  Property,
  SearchResult,
  NeighborhoodData,
  ConversationTurn,
  ScrapedListing,
} from "@/lib/types";

// ── Rate limiting ────────────────────────────────────────────────────────────

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

// ── Brave Search ─────────────────────────────────────────────────────────────

const PORTALS = ["athome.lu", "immotop.lu", "wortimmo.lu", "vivi.lu"] as const;

interface BraveResult {
  url: string;
  title: string;
  description: string;
}

async function braveSearch(query: string): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error("BRAVE_API_KEY is not configured");

  const params = new URLSearchParams({
    q: query,
    count: "10",
    search_lang: "fr",
    country: "ALL",
    result_filter: "web",
  });

  const resp = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!resp.ok) {
    console.error(`Brave search failed: ${resp.status} ${resp.statusText}`);
    return [];
  }

  const data = await resp.json();
  const results: BraveResult[] = [];

  for (const item of data.web?.results || []) {
    results.push({
      url: item.url || "",
      title: item.title || "",
      description: item.description || "",
    });
  }

  return results;
}

async function discoverUrls(
  query: string,
  mode: string
): Promise<BraveResult[]> {
  const modeKeyword = mode === "rent" ? "louer location" : "vendre achat";

  const searches = PORTALS.map((portal) =>
    braveSearch(`site:${portal} ${query} Luxembourg ${modeKeyword}`)
  );

  const results = await Promise.allSettled(searches);
  const allResults: BraveResult[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    }
  }

  return allResults;
}

// ── URL filtering ────────────────────────────────────────────────────────────

const LISTING_URL_PATTERNS: Record<string, RegExp> = {
  "athome.lu": /id-\d+/,
  "immotop.lu": /\/annonces\/\d+/,
  "wortimmo.lu": /id_\d+/,
  "vivi.lu": /\/\d+\/?$/,
};

function isListingUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [portal, pattern] of Object.entries(LISTING_URL_PATTERNS)) {
      if (hostname.includes(portal)) {
        return pattern.test(url);
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function filterListingUrls(results: BraveResult[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const result of results) {
    if (!result.url || seen.has(result.url)) continue;
    if (isListingUrl(result.url)) {
      seen.add(result.url);
      urls.push(result.url);
    }
  }

  return urls.slice(0, 15);
}

// ── Insights computation ─────────────────────────────────────────────────────

function computeInsights(properties: Property[]): void {
  if (properties.length === 0) return;

  const withPrice = properties.filter((p) => p.price > 0);
  const withPpsqm = properties.filter(
    (p) => p.pricePerSqm && p.pricePerSqm > 0
  );
  const withSqft = properties.filter((p) => p.sqft > 0);

  const avgPrice =
    withPrice.length > 0
      ? withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length
      : 0;
  const avgPpsqm =
    withPpsqm.length > 0
      ? withPpsqm.reduce((s, p) => s + (p.pricePerSqm || 0), 0) /
        withPpsqm.length
      : 0;

  const lowestPrice =
    withPrice.length > 0
      ? withPrice.reduce((min, p) => (p.price < min.price ? p : min))
      : null;
  const bestPpsqm =
    withPpsqm.length > 0
      ? withPpsqm.reduce((min, p) =>
          (p.pricePerSqm || Infinity) < (min.pricePerSqm || Infinity) ? p : min
        )
      : null;
  const largestSurface =
    withSqft.length > 0
      ? withSqft.reduce((max, p) => (p.sqft > max.sqft ? p : max))
      : null;

  const cityCount: Record<string, number> = {};
  for (const p of properties) {
    if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1;
  }

  for (const p of properties) {
    const insights: string[] = [];

    if (lowestPrice && p.id === lowestPrice.id && withPrice.length > 2) {
      insights.push("Lowest price");
    }
    if (bestPpsqm && p.id === bestPpsqm.id && withPpsqm.length > 2) {
      insights.push("Best \u20ac/m\u00b2");
    }
    if (
      largestSurface &&
      p.id === largestSurface.id &&
      withSqft.length > 2
    ) {
      insights.push("Largest");
    }

    if (p.price > 0 && avgPrice > 0 && withPrice.length > 2) {
      const diff = ((p.price - avgPrice) / avgPrice) * 100;
      if (diff <= -20)
        insights.push(`${Math.abs(Math.round(diff))}% below avg`);
      else if (diff >= 20) insights.push(`${Math.round(diff)}% above avg`);
    }

    if (p.pricePerSqm && avgPpsqm > 0 && withPpsqm.length > 2) {
      const diff = ((p.pricePerSqm - avgPpsqm) / avgPpsqm) * 100;
      if (diff <= -15 && !insights.includes("Best \u20ac/m\u00b2")) {
        insights.push("\u20ac/m\u00b2 below avg");
      }
    }

    if (p.sqft > 0) {
      if (p.sqft <= 30) insights.push("Compact");
      else if (p.sqft >= 150) insights.push("Spacious");
    }

    if (
      p.city &&
      cityCount[p.city] === 1 &&
      Object.keys(cityCount).length > 1
    ) {
      insights.push(`Only listing in ${p.city}`);
    }

    if (insights.length > 0) {
      p.aiInsight = insights.slice(0, 2).join(" \u00b7 ");
    }
  }
}

// ── Conversion ───────────────────────────────────────────────────────────────

function scrapedListingToProperty(
  listing: ScrapedListing,
  id: string
): Property {
  const pricePerSqm =
    listing.price > 0 && listing.surface > 0
      ? Math.round(listing.price / listing.surface)
      : undefined;

  return {
    id,
    address: listing.address || listing.city || "Address not available",
    city: listing.city,
    state: "Luxembourg",
    zipCode: "",
    price: listing.price,
    bedrooms: listing.rooms,
    bathrooms: listing.bathrooms,
    sqft: listing.surface,
    propertyType: listing.propertyType,
    yearBuilt: null,
    description: listing.description,
    features: [],
    imageUrl: listing.imageUrl,
    source: listing.source,
    listingUrl: listing.url,
    listingStatus:
      listing.contractType === "rent"
        ? `Rental - \u20ac${listing.price.toLocaleString()}/month`
        : "Active",
    listingMode: listing.contractType,
    pricePerSqm,
  };
}

// ── AI enrichment (GPT-4.1 nano) ────────────────────────────────────────────

interface AIEnrichment {
  summary: string;
  marketContext: string;
  suggestedFollowUps: string[];
}

async function enrichWithAI(
  properties: Property[],
  userQuery: string,
  mode: "buy" | "rent"
): Promise<AIEnrichment> {
  const fallback: AIEnrichment = {
    summary: properties.length > 0
      ? `Found ${properties.length} ${mode === "rent" ? "rental" : ""} properties.`
      : "No properties found. Try broadening your search.",
    marketContext: "",
    suggestedFollowUps: [],
  };

  if (properties.length === 0) return fallback;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return fallback;

  try {
    const propList = properties.slice(0, 12).map((p, i) =>
      `${i + 1}. ${p.address}, ${p.city} — €${p.price.toLocaleString()}${mode === "rent" ? "/mo" : ""}, ${p.sqft}m², ${p.bedrooms}bd, ${p.propertyType} [${p.source}]${p.aiInsight ? ` (${p.aiInsight})` : ""}`
    ).join("\n");

    const prompt = `You enrich Luxembourg real estate search results. Return JSON:
{"summary": "1-2 sentences: count, price range, best value. Same language as user query.", "marketContext": "One short market insight, max 15 words.", "suggestedFollowUps": ["3-4 follow-up queries"], "insights": {"1": "short insight for property 1", "2": "..."}}

For insights: location advantages, value context, notable features. Max 8 words each. Skip properties with good existing insights.

User: "${userQuery}" (${mode})

${propList}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!resp.ok) return fallback;

    const data = await resp.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(content);

    // Apply per-property AI insights — merge with existing data-driven ones
    if (parsed.insights && typeof parsed.insights === "object") {
      for (const [key, insight] of Object.entries(parsed.insights)) {
        const idx = parseInt(key) - 1;
        if (idx >= 0 && idx < properties.length && typeof insight === "string" && insight.trim()) {
          const p = properties[idx];
          if (p.aiInsight) {
            // Append AI insight after data-driven ones (max 3 total)
            const existing = p.aiInsight.split(" · ");
            if (existing.length < 3) {
              p.aiInsight = [...existing, insight.trim()].join(" · ");
            }
          } else {
            p.aiInsight = insight.trim();
          }
        }
      }
    }

    return {
      summary: parsed.summary || fallback.summary,
      marketContext: parsed.marketContext || "",
      suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps : [],
    };
  } catch {
    return fallback;
  }
}

// ── Core pipeline ────────────────────────────────────────────────────────────

async function runBraveFirecrawlPipeline(
  query: string,
  mode: "buy" | "rent"
): Promise<SearchResult> {
  // 1. Parse query with Perplexity
  const { enrichedQuery, parsed } = await analyzeQuery(query);
  const effectiveMode =
    parsed.transactionType !== "any" ? parsed.transactionType : mode;

  // 2. Run 4 Brave searches in parallel
  const braveResults = await discoverUrls(enrichedQuery, effectiveMode);

  // 3. Filter to listing URLs
  const listingUrls = filterListingUrls(braveResults);

  // 4. Check scrape cache
  const { cached: cachedListings, uncached: urlsToScrape } =
    checkScrapeCache(listingUrls);

  // 5. Firecrawl uncached URLs
  const freshListings = await scrapeMultipleUrls(urlsToScrape);
  for (const listing of freshListings) {
    setScrapeCache(listing.url, listing);
  }

  // 6. Merge, filter by mode, convert
  const allListings = [...cachedListings, ...freshListings];
  const filtered = allListings.filter(
    (l) => l.contractType === effectiveMode
  );
  const properties: Property[] = filtered.map((listing, i) =>
    scrapedListingToProperty(listing, `prop-${Date.now()}-${i}`)
  );

  // 7. Compute data-driven insights
  computeInsights(properties);

  // 8. AI enrichment (GPT-4.1 nano — cheap, adds summary + context + per-property insights)
  const aiEnrichment = await enrichWithAI(properties, query, effectiveMode);

  return {
    properties,
    summary: aiEnrichment.summary || `Found ${properties.length} properties`,
    citations: listingUrls,
    suggestedFollowUps: aiEnrichment.suggestedFollowUps,
    marketContext: aiEnrichment.marketContext,
  };
}

// ── Public actions ───────────────────────────────────────────────────────────

export async function searchAction(
  query: string,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  await enforceRateLimit();

  // Check keyword cache
  const cacheKey = buildSearchCacheKey(query, mode);
  const cached = getSearchCache(cacheKey);
  if (cached) return cached;

  const result = await runBraveFirecrawlPipeline(query, mode);

  setSearchCache(cacheKey, result);
  return result;
}

export async function expandedSearchAction(
  query: string,
  preferenceHints: string | null,
  _mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  await enforceRateLimit();

  // Expand query with nearby communes
  const { parsed } = await analyzeQuery(query);
  const commune = parsed.neighborhood || parsed.commune || "";
  const nearby = getNearbyCommunes(commune);

  let expandedQuery = query;
  if (nearby.length > 0) {
    expandedQuery = `${query} ${nearby.slice(0, 3).join(" ")}`;
  }

  if (preferenceHints) {
    expandedQuery += ` ${preferenceHints}`;
  }

  return runBraveFirecrawlPipeline(expandedQuery, _mode);
}

export async function refineSearchAction(
  query: string,
  _previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  await enforceRateLimit();

  const cacheKey = buildSearchCacheKey(query, mode);
  const cached = getSearchCache(cacheKey);
  if (cached) return cached;

  const result = await runBraveFirecrawlPipeline(query, mode);

  setSearchCache(cacheKey, result);
  return result;
}

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
