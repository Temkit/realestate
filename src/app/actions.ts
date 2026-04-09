"use server";

import { headers } from "next/headers";
import {
  searchProperties,
  searchExpandedProperties,
  searchWithContext,
  compareProperties,
  getNeighborhoodAnalysis,
} from "@/lib/perplexity";
import {
  classifyUrl,
  scrapeImmotopCategoryPage,
  scrapeListingPage,
  parseSearchResultTitle,
} from "@/lib/scrapers";
import { checkRateLimit } from "@/lib/rate-limit";
import type {
  Property,
  SearchResult,
  NeighborhoodData,
  ConversationTurn,
  ScrapedListing,
  DiscoveryResult,
} from "@/lib/types";

// ── In-memory search cache (TTL: 20 minutes) ──────────────────────────────
const CACHE_TTL = 20 * 60 * 1000;
const searchCache = new Map<
  string,
  { result: SearchResult; timestamp: number }
>();

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

// ── Core pipeline: discovery → classify → scrape → merge ────────────────────

/**
 * Run the full search pipeline:
 * 1. Perplexity discovers URLs + summary
 * 2. Classify URLs (category / listing / skip)
 * 3. Scrape category pages for listings (parallel, max 3)
 * 4. Scrape individual listing pages (parallel, max 6)
 * 5. Parse athome.lu titles for partial data
 * 6. Merge, deduplicate, filter by mode
 * 7. Convert to Property[]
 */
async function runPipeline(
  discovery: DiscoveryResult,
  mode: "buy" | "rent"
): Promise<SearchResult> {
  const { searchResults, summary, suggestedFollowUps, marketContext } =
    discovery;

  // Step 2: Classify each URL
  const categoryUrls: string[] = [];
  const listingUrls: string[] = [];
  const titleOnlyResults: { url: string; title: string }[] = [];

  for (const sr of searchResults) {
    const type = classifyUrl(sr.url);
    if (type === "category") {
      categoryUrls.push(sr.url);
    } else if (type === "listing") {
      listingUrls.push(sr.url);
    } else if (sr.title) {
      // Non-portal URL with title — try to parse title for data (athome.lu search results)
      titleOnlyResults.push({ url: sr.url, title: sr.title });
    }
  }

  // Also check search results with titles from portal URLs that were classified
  // as category/listing — athome.lu titles in search results contain useful data
  for (const sr of searchResults) {
    if (
      sr.title &&
      sr.url &&
      classifyUrl(sr.url) !== "skip" &&
      !listingUrls.includes(sr.url) &&
      !categoryUrls.includes(sr.url)
    ) {
      titleOnlyResults.push({ url: sr.url, title: sr.title });
    }
  }

  // Step 3: Scrape category pages (parallel, max 3)
  const categoryListings: ScrapedListing[] = [];
  const categoryPages = categoryUrls.slice(0, 3);
  if (categoryPages.length > 0) {
    const categoryResults = await Promise.allSettled(
      categoryPages.map((url) => scrapeImmotopCategoryPage(url))
    );
    for (const result of categoryResults) {
      if (result.status === "fulfilled") {
        categoryListings.push(...result.value);
      }
    }
  }

  // Step 4: Scrape individual listing pages (parallel, max 6)
  const scrapedListings: ScrapedListing[] = [];
  const pagesToScrape = listingUrls.slice(0, 6);
  if (pagesToScrape.length > 0) {
    const listingResults = await Promise.allSettled(
      pagesToScrape.map((url) => scrapeListingPage(url))
    );
    for (const result of listingResults) {
      if (result.status === "fulfilled" && result.value) {
        scrapedListings.push(result.value);
      }
    }
  }

  // Step 5: Parse athome.lu-style titles for partial data
  const titleListings: ScrapedListing[] = [];
  const scrapedUrls = new Set([
    ...categoryListings.map((l) => l.url),
    ...scrapedListings.map((l) => l.url),
  ]);
  for (const { url, title } of titleOnlyResults) {
    if (scrapedUrls.has(url)) continue;
    const parsed = parseSearchResultTitle(title, url);
    if (parsed && parsed.url) {
      titleListings.push({
        url: parsed.url,
        source: parsed.source || "athome.lu",
        price: parsed.price || 0,
        surface: parsed.surface || 0,
        rooms: parsed.rooms || 0,
        bathrooms: parsed.bathrooms || 0,
        propertyType: parsed.propertyType || "Property",
        city: parsed.city || "",
        address: parsed.address || "",
        imageUrl: parsed.imageUrl || null,
        contractType: parsed.contractType || "buy",
        description: parsed.description || "",
      });
    }
  }

  // Step 6: Merge all listings, deduplicate by URL
  const allListings: ScrapedListing[] = [];
  const seenUrls = new Set<string>();

  for (const listing of [
    ...categoryListings,
    ...scrapedListings,
    ...titleListings,
  ]) {
    if (seenUrls.has(listing.url)) continue;
    seenUrls.add(listing.url);
    allListings.push(listing);
  }

  // Step 7: Filter by mode
  const filtered = allListings.filter((l) => l.contractType === mode);

  // Step 8: Convert to Property[]
  const properties: Property[] = filtered.map((listing, i) =>
    scrapedListingToProperty(listing, `prop-${Date.now()}-${i}`)
  );

  // Step 9: Compute contextual insights from the result set
  computeInsights(properties);

  return {
    properties,
    summary: summary || `Found ${properties.length} results`,
    citations: searchResults.map((sr) => sr.url),
    suggestedFollowUps,
    marketContext,
  };
}

/**
 * Compute per-property insights from the result set.
 * All insights are derived from real scraped data, not AI.
 */
function computeInsights(properties: Property[]): void {
  if (properties.length === 0) return;

  const withPrice = properties.filter((p) => p.price > 0);
  const withPpsqm = properties.filter((p) => p.pricePerSqm && p.pricePerSqm > 0);
  const withSqft = properties.filter((p) => p.sqft > 0);

  // Compute averages
  const avgPrice = withPrice.length > 0
    ? withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length
    : 0;
  const avgPpsqm = withPpsqm.length > 0
    ? withPpsqm.reduce((s, p) => s + (p.pricePerSqm || 0), 0) / withPpsqm.length
    : 0;

  // Find best values
  const lowestPrice = withPrice.length > 0
    ? withPrice.reduce((min, p) => p.price < min.price ? p : min)
    : null;
  const bestPpsqm = withPpsqm.length > 0
    ? withPpsqm.reduce((min, p) => (p.pricePerSqm || Infinity) < (min.pricePerSqm || Infinity) ? p : min)
    : null;
  const largestSurface = withSqft.length > 0
    ? withSqft.reduce((max, p) => p.sqft > max.sqft ? p : max)
    : null;

  // Count per city
  const cityCount: Record<string, number> = {};
  for (const p of properties) {
    if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1;
  }

  // Assign insights
  for (const p of properties) {
    const insights: string[] = [];

    // Best value badges
    if (lowestPrice && p.id === lowestPrice.id && withPrice.length > 2) {
      insights.push("Lowest price");
    }
    if (bestPpsqm && p.id === bestPpsqm.id && withPpsqm.length > 2) {
      insights.push("Best €/m²");
    }
    if (largestSurface && p.id === largestSurface.id && withSqft.length > 2) {
      insights.push("Largest");
    }

    // Price position vs average
    if (p.price > 0 && avgPrice > 0 && withPrice.length > 2) {
      const diff = ((p.price - avgPrice) / avgPrice) * 100;
      if (diff <= -20) insights.push(`${Math.abs(Math.round(diff))}% below avg`);
      else if (diff >= 20) insights.push(`${Math.round(diff)}% above avg`);
    }

    // €/m² context
    if (p.pricePerSqm && avgPpsqm > 0 && withPpsqm.length > 2) {
      const diff = ((p.pricePerSqm - avgPpsqm) / avgPpsqm) * 100;
      if (diff <= -15 && !insights.includes("Best €/m²")) {
        insights.push(`€/m² below avg`);
      }
    }

    // Size description
    if (p.sqft > 0) {
      if (p.sqft <= 30) insights.push("Compact");
      else if (p.sqft >= 150) insights.push("Spacious");
    }

    // Supply context
    if (p.city && cityCount[p.city] === 1 && Object.keys(cityCount).length > 1) {
      insights.push(`Only listing in ${p.city}`);
    }

    // Set the insight (join top 2)
    if (insights.length > 0) {
      p.aiInsight = insights.slice(0, 2).join(" · ");
    }
  }
}

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
        ? `Rental - €${listing.price.toLocaleString()}/month`
        : "Active",
    listingMode: listing.contractType,
    pricePerSqm,
  };
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function searchAction(
  query: string,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  await enforceRateLimit();

  const cacheKey = `search:${query.trim().toLowerCase()}:${mode}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const discovery = await searchProperties(query, mode);
  const result = await runPipeline(discovery, mode);

  searchCache.set(cacheKey, { result, timestamp: Date.now() });
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

  const discovery = await searchExpandedProperties(
    query,
    preferenceHints,
    _mode
  );
  const result = await runPipeline(discovery, _mode);
  return result;
}

export async function refineSearchAction(
  query: string,
  previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  await enforceRateLimit();

  const cacheKey = `refine:${query.trim().toLowerCase()}:${mode}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const discovery = await searchWithContext(query, previousTurns, mode);
  const result = await runPipeline(discovery, mode);

  searchCache.set(cacheKey, { result, timestamp: Date.now() });
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
