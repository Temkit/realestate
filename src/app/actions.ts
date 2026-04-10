"use server";

import { headers } from "next/headers";
import { analyzeQuery } from "@/lib/gemini";
import {
  compareProperties,
  getNeighborhoodAnalysis,
} from "@/lib/perplexity";
import { scrapeImmotopCategoryPage } from "@/lib/firecrawl-scraper";
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
  checkScrapeCache,
  setScrapeCache,
  getOgCache,
  setOgCache,
  getImageCache,
  setImageCache,
  getParseCache,
  setParseCache,
} from "@/lib/search-cache";
import type { OgData } from "@/lib/search-cache";
import { getNearbyCommunes } from "@/lib/communes";
import { checkRateLimit } from "@/lib/rate-limit";
import { logSearch } from "@/lib/analytics";
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

  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.web?.results || []).map((item: { url?: string; title?: string; description?: string }) => ({
    url: item.url || "",
    title: item.title || "",
    description: item.description || "",
  }));
}

async function discoverUrls(query: string): Promise<BraveResult[]> {
  const searches = PORTALS.map((portal) =>
    braveSearch(`site:${portal} ${query} Luxembourg`)
  );

  const results = await Promise.allSettled(searches);
  const allResults: BraveResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const r of result.value) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          allResults.push(r);
        }
      }
    }
  }

  return allResults;
}

// ── URL classification ──────────────────────────────────────────────────────

const LISTING_PATTERNS: Record<string, RegExp> = {
  "athome.lu": /id-\d+/,
  "immotop.lu": /\/annonces\/\d+/,
  "wortimmo.lu": /id_\d+/,
  "vivi.lu": /\/\d{4,}\/?$/,
};

function isListingUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [portal, pattern] of Object.entries(LISTING_PATTERNS)) {
      if (hostname.includes(portal)) return pattern.test(url) && !/agences/.test(url);
    }
  } catch { /* ignore */ }
  return false;
}

function isImmotopCategoryUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    const p = new URL(url).pathname;
    return h.includes("immotop.lu") && !isListingUrl(url) && !/agences|prix-immobilier|communes|search/.test(p) && p.length > 5;
  } catch { return false; }
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

// ── Step 3a: Free og:image fetch (cached 7d) ───────────────────────────────

async function fetchOgTags(url: string): Promise<OgData | null> {
  // Check cache first
  const cached = await getOgCache(url);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Accept-Encoding": "identity" },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const reader = resp.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const ogImage = (html.match(/property="og:image"[^>]*content="([^"]+)"/i) || html.match(/content="([^"]+)"[^>]*property="og:image"/i) || [])[1];
    const ogTitle = (html.match(/property="og:title"[^>]*content="([^"]+)"/i) || html.match(/content="([^"]+)"[^>]*property="og:title"/i) || [])[1];

    let price = 0, surface = 0;
    if (ogTitle) {
      const pm = ogTitle.match(/([\d\s.]+)\s*€/);
      if (pm) price = parseInt(pm[1].replace(/[\s.]/g, ""));
      const sm = ogTitle.match(/(\d{2,})\s*m[²2]/);
      if (sm) surface = parseInt(sm[1]);
    }

    const validImg = ogImage && !/logo|favicon|icon/i.test(ogImage) ? ogImage : null;
    const result: OgData = { ogImage: validImg, ogTitle: ogTitle || null, price, surface };
    await setOgCache(url, result);
    return result;
  } catch { return null; }
}

// ── Step 3b: Gemini URL Context ─────────────────────────────────────────────

async function geminiReadUrls(urls: string[]): Promise<ScrapedListing[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || urls.length === 0) return [];

  const urlList = urls.map((u, i) => `${i + 1}. ${u}`).join("\n");

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Read these listing pages. For EACH return one line:\nURL | PRICE (number only in euros) | SURFACE (m² number only, realistic: studio 20-50, apartment 40-200, house 80-400, office 10-500) | TYPE | CITY | MODE (rent or buy) | ADDRESS | ROOMS (number, 0 if unknown)\n\n${urlList}\n\nReturn ONLY the lines, no other text.` }] }],
          tools: [{ url_context: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!resp.ok) return [];

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") || "";

    const results: ScrapedListing[] = [];
    for (const line of text.split("\n")) {
      const parts = line.split("|").map((s: string) => s.trim());
      if (parts.length < 6) continue;
      const url = parts[0].replace(/^\d+\.\s*/, "").trim();
      if (!url.startsWith("http")) continue;
      const price = parseInt((parts[1] || "0").replace(/[^\d]/g, "")) || 0;
      const surface = parseInt((parts[2] || "0").replace(/[^\d]/g, "")) || 0;
      const mode = /rent|location|louer|mois/i.test(parts[5] || "") ? "rent" as const : "buy" as const;
      const hostname = new URL(url).hostname.replace("www.", "");

      if (price === 0 && surface === 0) continue;

      results.push({
        url,
        source: hostname,
        price,
        surface,
        rooms: parseInt(parts[7] || "0") || 0,
        bathrooms: 0,
        propertyType: parts[3] || "Property",
        city: parts[4] || "",
        address: parts[6] || parts[4] || "",
        imageUrl: null, // Gemini fabricates images — never trust
        contractType: mode,
        description: "",
      });
    }
    return results;
  } catch { return []; }
}

// ── Step 3c: Firecrawl fallback for images ──────────────────────────────────

async function firecrawlForImages(urls: string[]): Promise<Record<string, string>> {
  if (urls.length === 0) return {};
  const images: Record<string, string> = {};

  // Check image cache first
  const uncachedUrls: string[] = [];
  for (const url of urls) {
    const cached = await getImageCache(url);
    if (cached) { images[url] = cached; }
    else { uncachedUrls.push(url); }
  }
  if (uncachedUrls.length === 0) return images;

  try {
    const Firecrawl = (await import("firecrawl")).default;
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return images;
    const app = new Firecrawl({ apiKey });

    // Max 3 Firecrawl calls for images
    for (const url of uncachedUrls.slice(0, 3)) {
      try {
        const result = await app.scrape(url);
        const meta = result.metadata || {};
        const md = result.markdown || "";
        const ogImg = meta.ogImage as string | undefined;
        const mdImg = md.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp)[^)]*)\)/i)?.[1];
        const img = ogImg || mdImg;
        if (img && !/logo|favicon|icon/i.test(img)) {
          images[url] = img;
          await setImageCache(url, img);
        }
      } catch { /* skip failed */ }
    }
    return images;
  } catch { return images; }
}

// ── AI Enrichment ───────────────────────────────────────────────────────────

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
      `${i + 1}. ${p.address}, ${p.city} — €${p.price.toLocaleString()}${mode === "rent" ? "/mo" : ""}, ${p.sqft}m², ${p.propertyType} [${p.source}]${p.aiInsight ? ` (${p.aiInsight})` : ""}`
    ).join("\n");

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Enrich Luxembourg real estate results. Return JSON:\n{"summary":"1-2 sentences: count, price range, best value. Same language as user query.","marketContext":"One short market insight, max 15 words.","suggestedFollowUps":["3-4 follow-up queries"],"insights":{"1":"short insight","2":"..."}}\n\nFor insights: location advantages, value context. Max 8 words each.\n\nUser: "${userQuery}" (${mode})\n\n${propList}` }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 600, responseMimeType: "application/json" },
        }),
      }
    );

    if (!resp.ok) return fallback;
    const data = await resp.json();
    const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

    // Merge AI insights with data-driven ones
    if (parsed.insights && typeof parsed.insights === "object") {
      for (const [key, insight] of Object.entries(parsed.insights)) {
        const idx = parseInt(key) - 1;
        if (idx >= 0 && idx < properties.length && typeof insight === "string" && insight.trim()) {
          const p = properties[idx];
          if (p.aiInsight) {
            const existing = p.aiInsight.split(" · ");
            if (existing.length < 3) p.aiInsight = [...existing, insight.trim()].join(" · ");
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
  } catch { return fallback; }
}

// ── Insights computation ────────────────────────────────────────────────────

function computeInsights(properties: Property[]): void {
  if (properties.length === 0) return;

  const withPrice = properties.filter((p) => p.price > 0);
  const withPpsqm = properties.filter((p) => p.pricePerSqm && p.pricePerSqm > 0);
  const withSqft = properties.filter((p) => p.sqft > 0);

  const avgPrice = withPrice.length > 0 ? withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length : 0;
  const avgPpsqm = withPpsqm.length > 0 ? withPpsqm.reduce((s, p) => s + (p.pricePerSqm || 0), 0) / withPpsqm.length : 0;
  const lowestPrice = withPrice.length > 0 ? withPrice.reduce((min, p) => (p.price < min.price ? p : min)) : null;
  const bestPpsqm = withPpsqm.length > 0 ? withPpsqm.reduce((min, p) => (p.pricePerSqm || Infinity) < (min.pricePerSqm || Infinity) ? p : min) : null;
  const largestSurface = withSqft.length > 0 ? withSqft.reduce((max, p) => (p.sqft > max.sqft ? p : max)) : null;

  const cityCount: Record<string, number> = {};
  for (const p of properties) if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1;

  for (const p of properties) {
    const insights: string[] = [];
    if (lowestPrice && p.id === lowestPrice.id && withPrice.length > 2) insights.push("Lowest price");
    if (bestPpsqm && p.id === bestPpsqm.id && withPpsqm.length > 2) insights.push("Best €/m²");
    if (largestSurface && p.id === largestSurface.id && withSqft.length > 2) insights.push("Largest");
    if (p.price > 0 && avgPrice > 0 && withPrice.length > 2) {
      const diff = ((p.price - avgPrice) / avgPrice) * 100;
      if (diff <= -20) insights.push(`${Math.abs(Math.round(diff))}% below avg`);
      else if (diff >= 20) insights.push(`${Math.round(diff)}% above avg`);
    }
    if (p.pricePerSqm && avgPpsqm > 0 && withPpsqm.length > 2) {
      const diff = ((p.pricePerSqm - avgPpsqm) / avgPpsqm) * 100;
      if (diff <= -15 && !insights.includes("Best €/m²")) insights.push("€/m² below avg");
    }
    if (p.sqft > 0) {
      if (p.sqft <= 30) insights.push("Compact");
      else if (p.sqft >= 150) insights.push("Spacious");
    }
    if (p.city && cityCount[p.city] === 1 && Object.keys(cityCount).length > 1) insights.push(`Only listing in ${p.city}`);
    if (insights.length > 0) p.aiInsight = insights.slice(0, 2).join(" · ");
  }
}

// ── Conversion ──────────────────────────────────────────────────────────────

function scrapedListingToProperty(listing: ScrapedListing, id: string): Property {
  const pricePerSqm = listing.price > 0 && listing.surface > 0 ? Math.round(listing.price / listing.surface) : undefined;
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
    listingStatus: listing.contractType === "rent" ? `Rental - €${listing.price.toLocaleString()}/month` : "Active",
    listingMode: listing.contractType,
    pricePerSqm,
  };
}

// ── Core pipeline ───────────────────────────────────────────────────────────

async function runPipeline(
  query: string,
  mode: "buy" | "rent"
): Promise<SearchResult> {
  // Step 1: Parse query with Gemini (cached 24h, fallback: raw query)
  let enrichedQuery = query + " Luxembourg";
  let effectiveMode = mode;
  try {
    const cachedParse = await getParseCache(query);
    if (cachedParse) {
      enrichedQuery = cachedParse.enrichedQuery;
      effectiveMode = cachedParse.parsed.transactionType !== "any" ? cachedParse.parsed.transactionType : mode;
    } else {
      const { enrichedQuery: eq, parsed } = await analyzeQuery(query);
      enrichedQuery = eq;
      effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;
      await setParseCache(query, { enrichedQuery: eq, parsed });
    }
  } catch { /* use defaults */ }

  // Step 2: Brave Search (fallback: empty results, pipeline continues)
  let braveResults: BraveResult[] = [];
  try {
    braveResults = await discoverUrls(enrichedQuery);
  } catch { /* no URLs found */ }

  const listingUrls = filterListingUrls(braveResults);
  const immotopCategories = [...new Set(
    braveResults.filter((r) => isImmotopCategoryUrl(r.url)).map((r) => r.url)
  )].slice(0, 3);

  // Step 3: ALL data fetching in parallel — og:fetch + categories + Gemini + Firecrawl
  const ogResults: Record<string, OgData> = {};
  const categoryListings: ScrapedListing[] = [];
  let geminiListings: ScrapedListing[] = [];
  let firecrawlImages: Record<string, string> = {};

  // Run og:fetch and category scraping in parallel (both free)
  const [ogSettled, catSettled] = await Promise.all([
    // og:fetch all listing URLs
    Promise.allSettled(
      listingUrls.map(async (url) => {
        try { const og = await fetchOgTags(url); if (og) ogResults[url] = og; } catch { /* skip */ }
      })
    ),
    // Immotop category pages
    immotopCategories.length > 0
      ? Promise.allSettled(immotopCategories.map(async (url) => {
          try { const listings = await scrapeImmotopCategoryPage(url); categoryListings.push(...listings); } catch { /* skip */ }
        }))
      : Promise.resolve([]),
  ]);
  void ogSettled;
  void catSettled;

  // Gemini URL Context for URLs still missing price (fallback: skip)
  const urlsNeedingData = listingUrls.filter((u) => !(ogResults[u]?.price > 0));
  const { cached: cachedListings, uncached: urlsToRead } = await checkScrapeCache(urlsNeedingData);
  try {
    geminiListings = await geminiReadUrls(urlsToRead);
    for (const listing of geminiListings) await setScrapeCache(listing.url, listing);
  } catch { /* Gemini failed — continue with what we have */ }

  // Firecrawl for images — only URLs missing og:image (fallback: no images)
  const urlsMissingImage = listingUrls.filter((u) => !ogResults[u]?.ogImage);
  try {
    firecrawlImages = await firecrawlForImages(urlsMissingImage);
  } catch { /* Firecrawl failed — continue without images */ }

  // Step 4: Merge all data sources
  const seenUrls = new Set<string>();
  const allListings: ScrapedListing[] = [];

  // Category listings first (immotop, most accurate)
  for (const l of categoryListings) {
    if (!seenUrls.has(l.url)) { seenUrls.add(l.url); allListings.push(l); }
  }

  // Gemini-read listings + cached
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

  // URLs that only have og:data — build from og:title
  for (const url of listingUrls) {
    if (seenUrls.has(url)) continue;
    const og = ogResults[url];
    if (!og || (!og.price && !og.surface)) continue;
    seenUrls.add(url);
    const hostname = new URL(url).hostname.replace("www.", "");
    const titleMode = og.ogTitle && /louer|location|rent/i.test(og.ogTitle) ? "rent" as const : "buy" as const;
    allListings.push({
      url, source: hostname, price: og.price, surface: og.surface,
      rooms: 0, bathrooms: 0, propertyType: "Property",
      city: "", address: "", imageUrl: og.ogImage || firecrawlImages[url] || null,
      contractType: titleMode, description: og.ogTitle || "",
    });
  }

  // Step 5: Filter + convert
  const filtered = allListings.filter((l) => l.contractType === effectiveMode);
  const properties = filtered.map((listing, i) =>
    scrapedListingToProperty(listing, `prop-${Date.now()}-${i}`)
  );

  // Step 6: Insights (never fails — pure computation)
  computeInsights(properties);

  // Step 7: AI enrichment (fallback: computed summary)
  let aiEnrichment: AIEnrichment = {
    summary: `Found ${properties.length} properties`,
    marketContext: "",
    suggestedFollowUps: [],
  };
  try {
    aiEnrichment = await enrichWithAI(properties, query, effectiveMode);
  } catch { /* use fallback summary */ }

  return {
    properties,
    summary: aiEnrichment.summary || `Found ${properties.length} properties`,
    citations: listingUrls,
    suggestedFollowUps: aiEnrichment.suggestedFollowUps,
    marketContext: aiEnrichment.marketContext,
  };
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function searchAction(
  query: string,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  if (!query.trim()) return { properties: [], summary: "", citations: [] };
  await enforceRateLimit();
  const start = Date.now();

  const cacheKey = buildSearchCacheKey(query, mode);
  const cached = await getSearchCache(cacheKey);
  if (cached) {
    // Log cache hit (fire and forget)
    logSearch({ query, mode, commune: null, propertyType: null, resultCount: cached.properties.length, cacheHit: true, durationMs: Date.now() - start }).catch(() => {});
    return cached;
  }

  const result = await runPipeline(query, mode);
  await setSearchCache(cacheKey, result);

  // Log cache miss with parsed data (fire and forget)
  const parseData = await getParseCache(query);
  logSearch({
    query, mode,
    commune: parseData?.parsed?.commune || parseData?.parsed?.neighborhood || null,
    propertyType: parseData?.parsed?.propertyType || null,
    resultCount: result.properties.length,
    cacheHit: false,
    durationMs: Date.now() - start,
  }).catch(() => {});

  return result;
}

export async function expandedSearchAction(
  query: string,
  preferenceHints: string | null,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  if (!query.trim()) return { properties: [], summary: "", citations: [] };
  await enforceRateLimit();

  // Full pipeline for nearby communes — cached + same quality as primary
  try {
    const { parsed } = await analyzeQuery(query);
    const commune = parsed.neighborhood || parsed.commune || "";
    const nearby = getNearbyCommunes(commune);
    if (nearby.length === 0) return { properties: [], summary: "", citations: [] };

    let nearbyQuery = `${parsed.propertyType || ""} ${nearby.slice(0, 3).join(" ")} Luxembourg`;
    if (preferenceHints) nearbyQuery += ` ${preferenceHints}`;

    const cacheKey = buildSearchCacheKey(nearbyQuery, mode);
    const cached = await getSearchCache(cacheKey);
    if (cached) return cached;

    const result = await runPipeline(nearbyQuery, mode);
    await setSearchCache(cacheKey, result);
    return result;
  } catch {
    return { properties: [], summary: "", citations: [] };
  }
}

export async function refineSearchAction(
  query: string,
  _previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<SearchResult> {
  if (!query.trim()) return { properties: [], summary: "", citations: [] };
  await enforceRateLimit();
  const start = Date.now();

  const cacheKey = buildSearchCacheKey(query, mode);
  const cached = await getSearchCache(cacheKey);
  if (cached) {
    logSearch({ query, mode, commune: null, propertyType: null, resultCount: cached.properties.length, cacheHit: true, durationMs: Date.now() - start }).catch(() => {});
    return cached;
  }

  const result = await runPipeline(query, mode);
  await setSearchCache(cacheKey, result);

  const parseData = await getParseCache(query);
  logSearch({
    query, mode,
    commune: parseData?.parsed?.commune || parseData?.parsed?.neighborhood || null,
    propertyType: parseData?.parsed?.propertyType || null,
    resultCount: result.properties.length,
    cacheHit: false,
    durationMs: Date.now() - start,
  }).catch(() => {});

  return result;
}

export async function compareAction(
  properties: { address: string; city: string; price: number; sqft: number; bedrooms: number; bathrooms: number; propertyType: string; features: string[] }[]
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
