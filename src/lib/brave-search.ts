import type { Property, SearchResult } from "./types";

// ── Brave Search API ────────────────────────────────────────────────────────

interface BraveWebResult {
  url: string;
  title: string;
  description: string;
}

interface BraveSearchResponse {
  web?: { results: BraveWebResult[] };
}

const LUXEMBOURG_PORTAL_SITES = [
  "athome.lu",
  "immotop.lu",
  "wortimmo.lu",
  "immobilier.lu",
  "vivi.lu",
  "habiter.lu",
];

// ── Query translation ────────────────────────────────────────────────────────

/**
 * Translate a natural language query into Brave search keywords
 * with site: filters for Luxembourg portals.
 */
function buildSearchQuery(userQuery: string, mode: "buy" | "rent"): string {
  const siteFilter = LUXEMBOURG_PORTAL_SITES.map((s) => `site:${s}`).join(" OR ");
  const modeKeyword = mode === "rent" ? "location louer rent" : "vente acheter buy";
  // Clean up the query — remove "in Luxembourg" since we're already filtering by portals
  const cleaned = userQuery.replace(/\b(in|au|à|en)\s+luxemb?ourg\b/i, "").trim();
  return `(${siteFilter}) ${cleaned} ${modeKeyword} Luxembourg`;
}

// ── Brave API call ──────────────────────────────────────────────────────────

async function braveSearch(query: string, count: number = 20): Promise<BraveWebResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error("BRAVE_API_KEY is not configured");

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    search_lang: "fr",
    country: "ALL",
    result_filter: "web",
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data: BraveSearchResponse = await response.json();
  return data.web?.results || [];
}

// ── Listing URL filtering ───────────────────────────────────────────────────

/**
 * Check if a URL is a specific listing page (not a search/category page).
 * Luxembourg portals use numeric IDs for individual listings.
 */
function isListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    // Must be from a known portal
    const isPortal = LUXEMBOURG_PORTAL_SITES.some(
      (s) => hostname === s || hostname === `www.${s}` || hostname.endsWith(`.${s}`)
    );
    if (!isPortal) return false;

    // Must have a numeric listing ID (at least 4 digits)
    if (!/\d{4,}/.test(path)) return false;

    // Reject bare homepages
    if (path.length <= 1) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is from a known Luxembourg portal (but might be a category page).
 */
function isPortalUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return LUXEMBOURG_PORTAL_SITES.some(
      (s) => hostname === s || hostname === `www.${s}` || hostname.endsWith(`.${s}`)
    );
  } catch { return false; }
}

/**
 * Scrape a category/search page from a Luxembourg portal to extract individual listing URLs.
 * Each portal has different HTML patterns for listing links.
 */
async function extractListingUrlsFromCategoryPage(url: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const reader = response.body?.getReader();
    if (!reader) return [];

    const decoder = new TextDecoder();
    let html = "";
    const maxBytes = 300_000; // category pages are larger

    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const hostname = new URL(url).hostname.toLowerCase();
    const links: string[] = [];

    // Extract all href links that look like individual listing pages
    const hrefPattern = /href=["'](https?:\/\/[^"']+|\/[^"']+)["']/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      let href = match[1];
      // Skip asset URLs (CSS, JS, images, fonts)
      if (/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)(\?|$)/i.test(href)) continue;
      if (/\/_next\/|\/static\/|\/assets\/|\/bundles\/|\/css\//i.test(href)) continue;
      // Resolve relative URLs
      if (href.startsWith("/")) {
        href = `https://${hostname}${href}`;
      }
      // Check if this is a listing URL with a numeric ID
      if (isListingUrl(href) && !links.includes(href)) {
        links.push(href);
      }
    }

    return links.slice(0, 20); // cap at 20 listings per category page
  } catch {
    return [];
  }
}

// ── JSON-LD scraping ────────────────────────────────────────────────────────

interface ScrapedProperty {
  url: string;
  source: string;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyType: string | null;
  yearBuilt: number | null;
  description: string | null;
  features: string[];
  imageUrl: string | null;
  listingStatus: string;
  listingMode: "buy" | "rent";
}

/**
 * Fetch a listing page and extract property data from JSON-LD + meta tags.
 */
async function scrapeListing(url: string, mode: "buy" | "rent"): Promise<ScrapedProperty | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
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
    const maxBytes = 150_000;

    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const hostname = new URL(url).hostname;
    const source = LUXEMBOURG_PORTAL_SITES.find(
      (s) => hostname === s || hostname === `www.${s}` || hostname.endsWith(`.${s}`)
    ) || hostname;

    // Extract JSON-LD data
    const jsonLdData = extractAllJsonLd(html);
    const propertyData = extractPropertyFromJsonLd(jsonLdData);

    // Extract meta tags as fallback
    const ogImage = extractMetaContent(html, "og:image");
    const ogTitle = extractMetaContent(html, "og:title");
    const ogDescription = extractMetaContent(html, "og:description");
    const metaPrice = extractPriceFromHtml(html);

    // Parse og:title for structured info (e.g. "2-room flat, Kirchberg | 2 rooms | 75 m²")
    const titleParsed = parseOgTitle(ogTitle);

    // Merge JSON-LD + og:title + meta fallbacks
    const address = propertyData.address || titleParsed.address || null;
    const imageUrl = propertyData.imageUrl || (ogImage && isPropertyImage(ogImage) ? ogImage : null);
    const description = propertyData.description || ogDescription || null;
    const price = propertyData.price || metaPrice || 0;

    // Determine city from JSON-LD, og:title, or URL
    const city = propertyData.city || titleParsed.city || extractCityFromUrl(url) || null;

    return {
      url,
      source,
      address,
      city,
      zipCode: propertyData.zipCode || null,
      price,
      bedrooms: propertyData.bedrooms || titleParsed.rooms || 0,
      bathrooms: propertyData.bathrooms || 0,
      sqft: propertyData.sqft || titleParsed.sqm || 0,
      propertyType: propertyData.propertyType || titleParsed.type || guessPropertyType(url, description || ""),
      yearBuilt: propertyData.yearBuilt || null,
      description,
      features: propertyData.features || [],
      imageUrl,
      listingStatus: mode === "rent" ? `Rental${price ? ` - €${price.toLocaleString()}/month` : ""}` : "Active",
      listingMode: mode,
    };
  } catch {
    return null;
  }
}

// ── JSON-LD parsing ─────────────────────────────────────────────────────────

interface ParsedPropertyData {
  address: string | null;
  city: string | null;
  zipCode: string | null;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyType: string | null;
  yearBuilt: number | null;
  description: string | null;
  features: string[];
  imageUrl: string | null;
}

function extractAllJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data)) {
        results.push(...data);
      } else {
        results.push(data);
      }
    } catch { /* skip malformed */ }
  }
  return results;
}

function extractPropertyFromJsonLd(items: unknown[]): ParsedPropertyData {
  const result: ParsedPropertyData = {
    address: null, city: null, zipCode: null, price: 0,
    bedrooms: 0, bathrooms: 0, sqft: 0, propertyType: null,
    yearBuilt: null, description: null, features: [], imageUrl: null,
  };

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    // Handle @graph arrays
    if (Array.isArray(obj["@graph"])) {
      const nested = extractPropertyFromJsonLd(obj["@graph"] as unknown[]);
      mergePropertyData(result, nested);
      continue;
    }

    const type = String(obj["@type"] || "").toLowerCase();
    const isRealEstate = type.includes("residence") || type.includes("apartment") ||
      type.includes("house") || type.includes("realestate") || type.includes("product") ||
      type.includes("offer") || type.includes("place");

    // Extract address
    const addressObj = obj.address as Record<string, unknown> | undefined;
    if (addressObj && typeof addressObj === "object") {
      result.address = result.address || asString(addressObj.streetAddress);
      result.city = result.city || asString(addressObj.addressLocality);
      result.zipCode = result.zipCode || asString(addressObj.postalCode);
    }

    // Extract name as address fallback
    if (!result.address && obj.name) {
      result.address = asString(obj.name);
    }

    // Price
    if (!result.price) {
      const offers = obj.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
      if (offers) {
        const offer = Array.isArray(offers) ? offers[0] : offers;
        if (offer && typeof offer === "object") {
          result.price = asNumber(offer.price) || asNumber(offer.lowPrice) || 0;
        }
      }
      if (!result.price && obj.price) result.price = asNumber(obj.price) || 0;
    }

    // Rooms
    if (!result.bedrooms && isRealEstate) {
      result.bedrooms = asNumber(obj.numberOfBedrooms) || asNumber(obj.numberOfRooms) || 0;
    }
    if (!result.bathrooms && isRealEstate) {
      result.bathrooms = asNumber(obj.numberOfBathroomsTotal) || asNumber(obj.numberOfBathrooms) || 0;
    }

    // Size
    if (!result.sqft && isRealEstate) {
      const floorSize = obj.floorSize as Record<string, unknown> | undefined;
      if (floorSize && typeof floorSize === "object") {
        result.sqft = asNumber(floorSize.value) || 0;
      }
      if (!result.sqft) result.sqft = asNumber(obj.floorSize) || 0;
    }

    // Type
    if (!result.propertyType && isRealEstate) {
      result.propertyType = asString(obj.propertyType) || asString(obj["@type"]) || null;
    }

    // Year
    if (!result.yearBuilt) {
      result.yearBuilt = asNumber(obj.yearBuilt) || null;
    }

    // Description
    if (!result.description) {
      result.description = asString(obj.description) || null;
    }

    // Image
    if (!result.imageUrl) {
      result.imageUrl = extractImageFromObj(obj);
    }

    // Features
    if (Array.isArray(obj.amenityFeature)) {
      for (const feat of obj.amenityFeature) {
        if (typeof feat === "object" && feat !== null) {
          const name = asString((feat as Record<string, unknown>).name);
          if (name) result.features.push(name);
        }
      }
    }
  }

  return result;
}

function mergePropertyData(target: ParsedPropertyData, source: ParsedPropertyData) {
  target.address = target.address || source.address;
  target.city = target.city || source.city;
  target.zipCode = target.zipCode || source.zipCode;
  target.price = target.price || source.price;
  target.bedrooms = target.bedrooms || source.bedrooms;
  target.bathrooms = target.bathrooms || source.bathrooms;
  target.sqft = target.sqft || source.sqft;
  target.propertyType = target.propertyType || source.propertyType;
  target.yearBuilt = target.yearBuilt || source.yearBuilt;
  target.description = target.description || source.description;
  target.imageUrl = target.imageUrl || source.imageUrl;
  if (source.features.length > 0 && target.features.length === 0) {
    target.features = source.features;
  }
}

function extractImageFromObj(obj: Record<string, unknown>): string | null {
  const imageField = obj.image || obj.photo || obj.photos || obj.thumbnailUrl;
  if (typeof imageField === "string" && imageField.startsWith("http")) return imageField;
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

// ── HTML helpers ────────────────────────────────────────────────────────────

function extractMetaContent(html: string, property: string): string | null {
  const p1 = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, "i");
  const p2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`, "i");
  const match = html.match(p1) || html.match(p2);
  return match?.[1] || null;
}

function extractPriceFromHtml(html: string): number {
  // Try common price patterns in meta tags
  const priceMatch = html.match(/(?:price|prix)[^"]*?["']?\s*[:=]\s*["']?([\d.,]+)/i);
  if (priceMatch) {
    return parseFloat(priceMatch[1].replace(/[.,](?=\d{3})/g, "").replace(",", ".")) || 0;
  }
  return 0;
}

function isPropertyImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (/logo|favicon|icon|placeholder|default|banner|sprite|no[-_]?image/i.test(lower)) return false;
  if (/\/\d{1,2}x\d{1,2}[/.]/i.test(lower)) return false;
  if (lower.endsWith(".svg")) return false;
  return lower.startsWith("http");
}

/**
 * Parse immotop.lu og:title format for property details.
 * Examples:
 *   "2-room flat first floor, Kirchberg, Luxembourg | 2 rooms | 75 m²"
 *   "Apartment for rent, Kirchberg | 3 rooms | 120 m² | €2,500/month"
 *   "Bureau à louer à Mondorf-les-Bains | 109 m²"
 */
function parseOgTitle(title: string | null): {
  address: string | null;
  city: string | null;
  rooms: number;
  sqm: number;
  type: string | null;
} {
  if (!title) return { address: null, city: null, rooms: 0, sqm: 0, type: null };

  const parts = title.split("|").map((s) => s.trim());

  // Extract rooms: "2 rooms", "3 chambres", "2-room"
  let rooms = 0;
  for (const part of parts) {
    const roomMatch = part.match(/(\d+)\s*(?:rooms?|chambres?|pièces?)/i);
    if (roomMatch) { rooms = parseInt(roomMatch[1]); break; }
  }
  // Also try "X-room" in the title
  if (!rooms) {
    const dashRoom = title.match(/(\d+)-room/i);
    if (dashRoom) rooms = parseInt(dashRoom[1]);
  }

  // Extract sqm: "75 m²", "120m²"
  let sqm = 0;
  for (const part of parts) {
    const sqmMatch = part.match(/([\d.,]+)\s*m²/i);
    if (sqmMatch) { sqm = parseFloat(sqmMatch[1].replace(",", ".")); break; }
  }

  // Extract type
  let type: string | null = null;
  const titleLower = title.toLowerCase();
  if (titleLower.includes("appartement") || titleLower.includes("apartment") || titleLower.includes("flat")) type = "Apartment";
  else if (titleLower.includes("maison") || titleLower.includes("house")) type = "House";
  else if (titleLower.includes("bureau") || titleLower.includes("office")) type = "Office";
  else if (titleLower.includes("studio")) type = "Studio";
  else if (titleLower.includes("terrain") || titleLower.includes("land")) type = "Land";
  else if (titleLower.includes("commerce") || titleLower.includes("retail")) type = "Commercial";

  // Extract address/city from first part: "2-room flat, Kirchberg, Luxembourg"
  const firstPart = parts[0] || "";
  const locationParts = firstPart.split(",").map((s) => s.trim());
  let city: string | null = null;
  let address: string | null = firstPart || null;

  // Last meaningful part before "Luxembourg" is usually the city
  for (let i = locationParts.length - 1; i >= 0; i--) {
    const part = locationParts[i];
    if (/luxemb/i.test(part)) continue;
    if (part.length > 2) { city = part; break; }
  }

  return { address, city, rooms, sqm, type };
}

function extractCityFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    // Common Luxembourg cities in URLs
    const cities: Record<string, string> = {
      "luxembourg": "Luxembourg City",
      "kirchberg": "Kirchberg", "bonnevoie": "Bonnevoie",
      "gasperich": "Gasperich", "belair": "Belair",
      "limpertsberg": "Limpertsberg", "merl": "Merl",
      "esch-sur-alzette": "Esch-sur-Alzette", "esch": "Esch-sur-Alzette",
      "dudelange": "Dudelange", "differdange": "Differdange",
      "ettelbruck": "Ettelbruck", "diekirch": "Diekirch",
      "mondorf-les-bains": "Mondorf-les-Bains", "mondorf": "Mondorf-les-Bains",
      "bertrange": "Bertrange", "strassen": "Strassen",
      "hesperange": "Hesperange", "walferdange": "Walferdange",
      "mamer": "Mamer", "capellen": "Capellen",
      "bettembourg": "Bettembourg", "belval": "Belval",
      "petange": "Pétange", "schifflange": "Schifflange",
      "remich": "Remich", "grevenmacher": "Grevenmacher",
      "junglinster": "Junglinster", "mersch": "Mersch",
      "clervaux": "Clervaux", "wiltz": "Wiltz",
      "echternach": "Echternach", "vianden": "Vianden",
    };
    for (const [key, value] of Object.entries(cities)) {
      if (path.includes(key)) return value;
    }
    return null;
  } catch { return null; }
}

function guessPropertyType(url: string, description: string): string {
  const text = (url + " " + description).toLowerCase();
  if (text.includes("bureau") || text.includes("office")) return "Office";
  if (text.includes("appartement") || text.includes("apartment")) return "Apartment";
  if (text.includes("maison") || text.includes("house")) return "House";
  if (text.includes("terrain") || text.includes("land")) return "Land";
  if (text.includes("commerce") || text.includes("retail")) return "Commercial";
  if (text.includes("studio")) return "Studio";
  return "Property";
}

function asString(val: unknown): string | null {
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function asNumber(val: unknown): number | null {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

// ── AI summary (uses Perplexity sonar cheaply) ──────────────────────────────

async function generateSummary(
  properties: Property[],
  userQuery: string,
  mode: "buy" | "rent"
): Promise<{ summary: string; insights: Map<string, string>; suggestedFollowUps: string[]; marketContext: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey || properties.length === 0) {
    return {
      summary: `Found ${properties.length} properties`,
      insights: new Map(),
      suggestedFollowUps: [],
      marketContext: "",
    };
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, baseURL: "https://api.perplexity.ai" });

  const propList = properties.slice(0, 12).map((p, i) =>
    `${i + 1}. ${p.address || p.city}, €${p.price.toLocaleString()}${mode === "rent" ? "/mo" : ""}, ${p.sqft}m², ${p.bedrooms}bd/${p.bathrooms}ba, ${p.propertyType} (${p.source})`
  ).join("\n");

  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [
      {
        role: "system",
        content: `You summarize real estate search results for Luxembourg. Return JSON:
{
  "summary": "1-2 sentences: count, price range, top pick",
  "insights": {"1": "short insight for property 1", "2": "...", ...},
  "suggestedFollowUps": ["3-4 follow-up queries"],
  "marketContext": "one short market stat, max 15 words"
}
Keep it concise. Respond in the same language as the user query. MUST be valid JSON.`,
      },
      {
        role: "user",
        content: `User searched: "${userQuery}" (${mode})\n\nResults:\n${propList}`,
      },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "";
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    const insights = new Map<string, string>();
    if (parsed.insights && typeof parsed.insights === "object") {
      for (const [key, val] of Object.entries(parsed.insights)) {
        insights.set(key, String(val));
      }
    }
    return {
      summary: parsed.summary || `Found ${properties.length} properties`,
      insights,
      suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps : [],
      marketContext: parsed.marketContext || "",
    };
  } catch {
    return {
      summary: `Found ${properties.length} properties`,
      insights: new Map(),
      suggestedFollowUps: [],
      marketContext: "",
    };
  }
}

// ── Main search function ────────────────────────────────────────────────────

export async function braveSearchProperties(
  query: string,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  // 1. Search Brave for URLs
  const searchQuery = buildSearchQuery(query, mode);
  const results = await braveSearch(searchQuery);

  // 2. Separate direct listing URLs from category/search pages
  const directListings = results.map((r) => r.url).filter(isListingUrl);
  const categoryPages = results.map((r) => r.url).filter((u) => !isListingUrl(u) && isPortalUrl(u));

  // 3. If few direct listings, scrape category pages for individual listing URLs
  let allListingUrls = [...directListings];

  if (allListingUrls.length < 5 && categoryPages.length > 0) {
    // Scrape up to 4 category pages in parallel to find listing URLs
    const pagesToScrape = categoryPages.slice(0, 4);
    const categoryResults = await Promise.allSettled(
      pagesToScrape.map(extractListingUrlsFromCategoryPage)
    );
    for (const result of categoryResults) {
      if (result.status === "fulfilled") {
        allListingUrls.push(...result.value);
      }
    }
  }

  // Deduplicate and cap
  const uniqueUrls = [...new Set(allListingUrls)].slice(0, 15);

  if (uniqueUrls.length === 0) {
    return {
      properties: [],
      summary: "No listings found. Try a different search.",
      citations: results.map((r) => r.url),
    };
  }

  // 3. Scrape JSON-LD from each listing (parallel, max 6 concurrent)
  const scraped: ScrapedProperty[] = [];
  const batches: string[][] = [];
  for (let i = 0; i < uniqueUrls.length; i += 6) {
    batches.push(uniqueUrls.slice(i, i + 6));
  }

  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map((url) => scrapeListing(url, mode))
    );
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        scraped.push(result.value);
      }
    }
  }

  if (scraped.length === 0) {
    return {
      properties: [],
      summary: "Found listing pages but could not extract data. Try a different search.",
      citations: uniqueUrls,
    };
  }

  // 4. Convert to Property objects
  const properties: Property[] = scraped.map((s, i) => ({
    id: `brave-${Date.now()}-${i}`,
    address: s.address || s.city || "Address not available",
    city: s.city || "",
    state: "Luxembourg",
    zipCode: s.zipCode || "",
    price: s.price,
    bedrooms: s.bedrooms,
    bathrooms: s.bathrooms,
    sqft: s.sqft,
    propertyType: s.propertyType || "Property",
    yearBuilt: s.yearBuilt,
    description: s.description || "",
    features: s.features,
    imageUrl: s.imageUrl,
    source: s.source,
    listingUrl: s.url,
    listingStatus: s.listingStatus,
    listingMode: s.listingMode,
    pricePerSqm: s.price > 0 && s.sqft > 0 ? Math.round(s.price / s.sqft) : undefined,
  }));

  // 5. Generate AI summary + insights (cheap Perplexity call)
  const { summary, insights, suggestedFollowUps, marketContext } = await generateSummary(properties, query, mode);

  // Apply insights to individual properties
  properties.forEach((p, i) => {
    const insight = insights.get(String(i + 1));
    if (insight) p.aiInsight = insight;
  });

  return {
    properties,
    summary,
    citations: uniqueUrls,
    suggestedFollowUps,
    marketContext,
  };
}

export async function braveExpandedSearch(
  query: string,
  mode: "buy" | "rent" = "buy"
): Promise<SearchResult> {
  // For expanded search, broaden the query
  const broadened = `${query} nearby similar properties`;
  return braveSearchProperties(broadened, mode);
}
