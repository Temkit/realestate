"use server";

import { headers } from "next/headers";
import { searchProperties, searchExpandedProperties, searchWithContext, compareProperties, getNeighborhoodAnalysis } from "@/lib/perplexity";
import { checkRateLimit } from "@/lib/rate-limit";
import type { SearchResult, NeighborhoodData, ConversationTurn } from "@/lib/types";

// ── In-memory search cache (TTL: 20 minutes) ──────────────────────────────
const CACHE_TTL = 20 * 60 * 1000;
const searchCache = new Map<string, { result: SearchResult; timestamp: number }>();

/**
 * Data scraped from a listing page to enrich/correct Perplexity output.
 */
interface ScrapedListingData {
  imageUrl: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  pricePerSqm: number | null;
  contract: "rent" | "buy" | null;
  rooms: number | null;
  surface: number | null;
}

/**
 * Enrich search results with data scraped from listing pages server-side.
 * Fills in missing images and corrects bad data from Perplexity.
 */
async function enrichFromListingPages(result: SearchResult): Promise<void> {
  const toScrape = result.properties
    .filter((p) => p.listingUrl)
    .map((p) => ({ id: p.id, url: p.listingUrl! }));

  if (toScrape.length === 0) return;

  const scrapedMap = await scrapeListingPages(toScrape);
  if (Object.keys(scrapedMap).length === 0) return;

  for (const p of result.properties) {
    const scraped = scrapedMap[p.id];
    if (!scraped) continue;

    // Fill in missing image
    if (!p.imageUrl && scraped.imageUrl) {
      p.imageUrl = scraped.imageUrl;
    }

    // Correct price from scraped data — listing page is the source of truth
    if (scraped.price && scraped.price > 0) {
      p.price = scraped.price;
    }

    // Correct price per sqm from scraped data
    if (scraped.pricePerSqm && scraped.pricePerSqm > 0) {
      p.pricePerSqm = scraped.pricePerSqm;
    }

    // Correct contract type — scraped data is truth
    if (scraped.contract) {
      if (scraped.contract === "rent" && p.listingMode !== "rent") {
        p.listingMode = "rent";
        p.listingStatus = `Rental - €${p.price.toLocaleString()}/month`;
      } else if (scraped.contract === "buy" && p.listingMode !== "buy") {
        p.listingMode = "buy";
        p.listingStatus = "Active";
      }
    }

    // Fill in surface from scraped data
    if (scraped.surface && scraped.surface > 0 && !p.sqft) {
      p.sqft = scraped.surface;
    }

    // Fill in rooms from scraped data
    if (scraped.rooms && scraped.rooms > 0 && !p.bedrooms) {
      p.bedrooms = scraped.rooms;
    }

    // Parse og:title for property type and additional data
    if (scraped.title) {
      const parsed = parseListingTitle(scraped.title);

      // Correct property type if we got something more specific
      if (parsed.type && (p.propertyType === "Unknown" || p.propertyType === "Property")) {
        p.propertyType = parsed.type;
      }

      // Fill in from title if still missing
      if (!p.sqft && parsed.sqm) p.sqft = parsed.sqm;
      if (!p.bedrooms && parsed.rooms) p.bedrooms = parsed.rooms;

      // Title-based rental detection as fallback
      if (!scraped.contract && parsed.isRental && p.listingMode !== "rent") {
        p.listingMode = "rent";
        p.listingStatus = `Rental - €${p.price.toLocaleString()}/month`;
      }
    }

    // Use scraped description if current one is empty/short
    if (scraped.description && (!p.description || p.description.length < 20)) {
      p.description = scraped.description;
    }

    // Recalculate price per sqm if we now have both
    if (p.price > 0 && p.sqft > 0 && !p.pricePerSqm) {
      p.pricePerSqm = Math.round(p.price / p.sqft);
    }
  }
}

/**
 * Parse a listing page title (especially immotop.lu format) for property details.
 * Examples:
 *   "Bureau - Cabinet en Location" → type=Office, isRental=true
 *   "Appartement 3 chambres à vendre, Kirchberg | 120 m²" → type=Apartment, rooms=3, sqm=120
 *   "2-room flat first floor, Kirchberg | 2 rooms | 75 m²" → rooms=2, sqm=75
 */
function parseListingTitle(title: string): {
  type: string | null;
  rooms: number;
  sqm: number;
  isRental: boolean;
} {
  const lower = title.toLowerCase();

  // Detect rental
  const isRental = /\b(location|louer|rent|en location|à louer|for rent)\b/i.test(lower);

  // Extract type
  let type: string | null = null;
  if (/bureau|office|cabinet/i.test(lower)) type = "Office";
  else if (/appartement|apartment|flat/i.test(lower)) type = "Apartment";
  else if (/maison|house|villa/i.test(lower)) type = "House";
  else if (/studio/i.test(lower)) type = "Studio";
  else if (/terrain|land/i.test(lower)) type = "Land";
  else if (/commerce|commercial|retail|magasin/i.test(lower)) type = "Commercial";
  else if (/duplex/i.test(lower)) type = "Duplex";
  else if (/penthouse/i.test(lower)) type = "Penthouse";
  else if (/loft/i.test(lower)) type = "Loft";

  // Extract rooms
  let rooms = 0;
  const roomMatch = lower.match(/(\d+)\s*(?:rooms?|chambres?|pièces?|ch\b)/);
  if (roomMatch) rooms = parseInt(roomMatch[1]);
  if (!rooms) {
    const dashRoom = lower.match(/(\d+)-room/);
    if (dashRoom) rooms = parseInt(dashRoom[1]);
  }

  // Extract sqm
  let sqm = 0;
  const sqmMatch = title.match(/([\d.,]+)\s*m²/i);
  if (sqmMatch) sqm = parseFloat(sqmMatch[1].replace(",", "."));

  return { type, rooms, sqm, isRental };
}

/**
 * Scrape category pages to find individual listing URLs for properties that have none.
 * Category pages (e.g. immotop.lu/location-bureaux/mondorf/) list individual listings
 * with their prices in the HTML. We match them to our properties by price + city.
 */
async function resolveListingUrlsFromCategoryPages(result: SearchResult): Promise<void> {
  const unmatched = result.properties.filter((p) => !p.listingUrl);
  const categoryUrls = result.categoryUrls || [];

  if (unmatched.length === 0 || categoryUrls.length === 0) return;

  // Scrape category pages (max 3, in parallel)
  const pages = categoryUrls.slice(0, 3);
  const allListingUrls: { url: string; title: string; price: number; sqm: number }[] = [];

  const settled = await Promise.allSettled(
    pages.map(async (pageUrl) => {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(pageUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/html",
            "Accept-Encoding": "identity",
          },
          redirect: "follow",
        });
        if (!resp.ok) return;
        const html = await resp.text();
        const hostname = new URL(pageUrl).hostname;

        // immotop.lu embeds __NEXT_DATA__ with full listing data including prices
        const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];
            for (const q of queries) {
              const listings = q?.state?.data?.results || q?.state?.data?.realEstates || [];
              if (!Array.isArray(listings)) continue;
              for (const listing of listings) {
                // URL is at listing.seo.url, data at listing.realEstate
                const seoUrl = listing?.seo?.url;
                if (!seoUrl) continue;
                const url = seoUrl.startsWith("http") ? seoUrl : `https://${hostname}${seoUrl}`;
                const re = listing?.realEstate || listing;
                const price = re?.price?.value || re?.properties?.[0]?.price?.value || 0;
                const surface = re?.properties?.[0]?.surface || "";
                const sqm = parseInt(surface.replace(/[^\d]/g, "")) || 0;
                const title = `${re?.title || ""} ${price} ${surface}`;
                if (/\/annonces\/\d{4,}/.test(url)) {
                  allListingUrls.push({ url, title, price, sqm });
                }
              }
            }
          } catch { /* skip malformed JSON */ }
        }

        // Fallback: extract listing links from HTML for other portals
        if (allListingUrls.length === 0) {
          const linkPattern = /<a[^>]*href=["']((?:https?:\/\/[^"']+|\/[^"']+))["'][^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          while ((match = linkPattern.exec(html)) !== null) {
            let href = match[1];
            const linkText = match[2].replace(/<[^>]+>/g, " ").trim();
            if (href.startsWith("/")) href = `https://${hostname}${href}`;
            if (/\.(css|js|png|jpg|svg|woff)/i.test(href)) continue;
            if (/agences-immobilieres/i.test(href)) continue;
            try {
              const path = new URL(href).pathname;
              if (/\d{4,}/.test(path)) {
                allListingUrls.push({ url: href, title: linkText, price: 0, sqm: 0 });
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip failed pages */ }
    })
  );
  void settled;

  if (allListingUrls.length === 0) return;

  // Deduplicate
  const seen = new Set<string>();
  const uniqueListings = allListingUrls.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  // Match unmatched properties to scraped listing URLs by price (exact match from embedded JSON)
  const usedUrls = new Set(result.properties.filter((p) => p.listingUrl).map((p) => p.listingUrl!));

  for (const p of unmatched) {
    let bestUrl: string | null = null;
    let bestScore = 0;

    for (const listing of uniqueListings) {
      if (usedUrls.has(listing.url)) continue;
      let score = 0;

      // Direct price match from embedded JSON data (most reliable)
      if (listing.price > 0 && p.price > 0 && listing.price === p.price) {
        score += 5;
      }

      // Direct sqm match from embedded JSON
      if (listing.sqm > 0 && p.sqft > 0 && listing.sqm === p.sqft) {
        score += 3;
      }

      // Fallback: text matching in title
      if (score === 0) {
        const titleLower = listing.title.toLowerCase();
        if (p.price > 0 && titleLower.includes(String(p.price))) score += 3;
        if (p.sqft > 0 && titleLower.includes(String(p.sqft))) score += 2;
        if (p.city && titleLower.includes(p.city.toLowerCase())) score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestUrl = listing.url;
      }
    }

    if (bestUrl && bestScore >= 3) {
      p.listingUrl = bestUrl;
      usedUrls.add(bestUrl);
    }
  }
}

async function enforceRateLimit() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
  }
}

export async function searchAction(query: string, mode: "buy" | "rent" = "buy"): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  await enforceRateLimit();

  // Check cache first
  const cacheKey = `search:${query.trim().toLowerCase()}:${mode}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = await searchProperties(query, mode);

  // For properties without listing URLs, scrape category pages to find individual listing URLs
  await resolveListingUrlsFromCategoryPages(result);

  // Enrich with listing page data server-side before returning
  await enrichFromListingPages(result);

  // Cache the result
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
  const result = await searchExpandedProperties(query, preferenceHints);

  // Enrich with listing images server-side
  await enrichFromListingPages(result);

  return result;
}

/**
 * Scrape a listing page for image, title, and description.
 */
async function scrapeListingPage(url: string): Promise<ScrapedListingData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,de;q=0.7",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    const maxBytes = 100_000;

    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // Extract image: JSON-LD → og:image → twitter:image
    let imageUrl: string | null = null;
    const imageFromJsonLd = extractImageFromJsonLd(html);
    if (imageFromJsonLd && isPropertyImage(imageFromJsonLd)) imageUrl = imageFromJsonLd;
    if (!imageUrl) {
      const imageFromOg = extractMetaImage(html, "og:image");
      if (imageFromOg && isPropertyImage(imageFromOg)) imageUrl = imageFromOg;
    }
    if (!imageUrl) {
      const imageFromTwitter = extractMetaImage(html, "twitter:image");
      if (imageFromTwitter && isPropertyImage(imageFromTwitter)) imageUrl = imageFromTwitter;
    }

    // Extract title and description
    const title = extractMetaImage(html, "og:title") || extractMetaImage(html, "title") || null;
    const description = extractMetaImage(html, "og:description") || extractMetaImage(html, "description") || null;

    // Extract price, contract, and details from embedded JSON (immotop.lu pattern)
    const { price, pricePerSqm, contract, rooms, surface } = extractEmbeddedData(html);

    return { imageUrl, title, description, price, pricePerSqm, contract, rooms, surface };
  } catch {
    return null;
  }
}

/**
 * Scrape multiple listing pages in parallel (max 6 concurrent).
 */
async function scrapeListingPages(
  urls: { id: string; url: string }[]
): Promise<Record<string, ScrapedListingData>> {
  const results: Record<string, ScrapedListingData> = {};

  const batches: { id: string; url: string }[][] = [];
  for (let i = 0; i < urls.length; i += 6) {
    batches.push(urls.slice(i, i + 6));
  }

  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map(async ({ id, url }) => {
        const data = await scrapeListingPage(url);
        if (data) results[id] = data;
      })
    );
    void settled;
  }

  return results;
}

/**
 * Extract structured data embedded in the page's JavaScript (common on immotop.lu, wortimmo.lu).
 * Looks for patterns like "price":{"value":470}, "contract":"rent", "bathrooms":0, etc.
 */
function extractEmbeddedData(html: string): {
  price: number | null;
  pricePerSqm: number | null;
  contract: "rent" | "buy" | null;
  rooms: number | null;
  surface: number | null;
} {
  let price: number | null = null;
  let pricePerSqm: number | null = null;
  let contract: "rent" | "buy" | null = null;
  let rooms: number | null = null;
  let surface: number | null = null;

  // Price: "price":{"visible":true,"value":470,...}
  const priceMatch = html.match(/"price":\{"visible":true,"value":(\d+)/);
  if (priceMatch) {
    price = parseInt(priceMatch[1]);
  }

  // Price per sqm: "pricePerSquareMeter":"7 778 €/m²"
  const ppsqmMatch = html.match(/"pricePerSquareMeter":"([\d\s.,]+)/);
  if (ppsqmMatch) {
    pricePerSqm = parseInt(ppsqmMatch[1].replace(/[\s.]/g, ""));
  }

  // Contract type: "contract":"rent" or "contract":"sale"
  const contractMatch = html.match(/"contract":"(rent|sale|buy|location|vente)"/i);
  if (contractMatch) {
    const val = contractMatch[1].toLowerCase();
    contract = (val === "rent" || val === "location") ? "rent" : "buy";
  }

  // Rooms: "rooms":3 or "numberOfRooms":3
  const roomsMatch = html.match(/"(?:rooms|numberOfRooms|bedrooms)":(\d+)/);
  if (roomsMatch && parseInt(roomsMatch[1]) > 0) {
    rooms = parseInt(roomsMatch[1]);
  }

  // Surface: look for m² pattern near a number in structured data
  const surfaceMatch = html.match(/"(?:surface|surfaceValue|floorSize|area)":(\d+)/);
  if (surfaceMatch) {
    surface = parseInt(surfaceMatch[1]);
  }

  return { price, pricePerSqm, contract, rooms, surface };
}

/**
 * Reject generic portal images (logos, banners, placeholders).
 * Real property photos are hosted on CDN subdomains with long paths.
 */
function isPropertyImage(url: string): boolean {
  const lower = url.toLowerCase();
  // Reject obvious logos/icons/placeholders
  if (/logo|favicon|icon|placeholder|default|banner|sprite|no[-_]?image/i.test(lower)) return false;
  // Reject tiny images (common pattern: .../50x50/... or similar)
  if (/\/\d{1,2}x\d{1,2}[/.]/i.test(lower)) return false;
  // Reject SVGs (usually icons/logos)
  if (lower.endsWith(".svg")) return false;
  // Must be a reasonable image URL
  return lower.startsWith("http");
}

/**
 * Parse all JSON-LD blocks and look for image fields.
 * Handles RealEstateListing, Product, Residence, Apartment, SingleFamilyResidence,
 * and generic schema.org types with image properties.
 */
function extractImageFromJsonLd(html: string): string | null {
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const image = findImageInJsonLd(data);
      if (image) return image;
    } catch {
      // Malformed JSON-LD — skip
    }
  }

  return null;
}

function findImageInJsonLd(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  // Handle arrays (e.g. @graph)
  if (Array.isArray(data)) {
    for (const item of data) {
      const img = findImageInJsonLd(item);
      if (img) return img;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check @graph
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const img = findImageInJsonLd(item);
      if (img) return img;
    }
  }

  // Extract image from this object
  const imageField = obj.image || obj.photo || obj.photos || obj.thumbnailUrl;

  if (typeof imageField === "string" && imageField.startsWith("http")) {
    return imageField;
  }

  if (Array.isArray(imageField)) {
    for (const item of imageField) {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (typeof item === "object" && item !== null) {
        const nested = item as Record<string, unknown>;
        const url = nested.url || nested.contentUrl || nested.thumbnailUrl;
        if (typeof url === "string" && url.startsWith("http")) return url;
      }
    }
  }

  if (typeof imageField === "object" && imageField !== null) {
    const nested = imageField as Record<string, unknown>;
    const url = nested.url || nested.contentUrl || nested.thumbnailUrl;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  return null;
}

/**
 * Extract image URL from meta tags (og:image, twitter:image, etc.)
 * Handles both attribute orderings: property-then-content and content-then-property.
 */
function extractMetaImage(html: string, property: string): string | null {
  // property="og:image" content="..."
  const pattern1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  // content="..." property="og:image"
  const pattern2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );

  const match = html.match(pattern1) || html.match(pattern2);
  if (match?.[1] && match[1].startsWith("http")) {
    return match[1];
  }

  return null;
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

  // Check cache
  const cacheKey = `refine:${query.trim().toLowerCase()}:${mode}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = await searchWithContext(query, previousTurns, mode);

  // Enrich with listing images server-side
  await enrichFromListingPages(result);

  // Cache the result
  searchCache.set(cacheKey, { result, timestamp: Date.now() });

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
