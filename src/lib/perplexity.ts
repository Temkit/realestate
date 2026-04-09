import OpenAI from "openai";
import type { Property, SearchResult, NeighborhoodData, ConversationTurn } from "./types";
import { getNearbyCommunes } from "./communes";

let clientInstance: OpenAI | null = null;

function getClient() {
  if (clientInstance) return clientInstance;
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey || apiKey === "your-perplexity-api-key-here") {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }
  clientInstance = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });
  return clientInstance;
}

// ── Location & domain detection ──────────────────────────────────────────────

interface QueryContext {
  enrichedQuery: string;
  domains: string[];
  parsed: ParsedQuery;
}

const LUXEMBOURG_PORTALS = [
  "athome.lu",
  "immotop.lu",
  "wortimmo.lu",
  "immobilier.lu",
  "vivi.lu",
  "habiter.lu",
  "remax.lu",
  "engelvoelkers.com",
];

// ── Query parsing via Perplexity ─────────────────────────────────────────────

interface ParsedQuery {
  commune: string | null;
  neighborhood: string | null;
  propertyType: string | null;
  transactionType: "buy" | "rent" | "any";
  cleanedQuery: string;
}

const QUERY_PARSE_SCHEMA = {
  type: "object" as const,
  required: ["commune", "neighborhood", "propertyType", "transactionType", "cleanedQuery"],
  additionalProperties: false,
  properties: {
    commune: { type: ["string", "null"] as const, description: "The Luxembourg commune name, properly spelled. null if not identifiable." },
    neighborhood: { type: ["string", "null"] as const, description: "Neighborhood within Luxembourg City (Kirchberg, Bonnevoie, Gasperich, etc.) if applicable. null otherwise." },
    propertyType: { type: ["string", "null"] as const, description: "apartment, house, office, land, commercial, studio, or null" },
    transactionType: { type: "string" as const, enum: ["buy", "rent", "any"], description: "buy, rent, or any if unclear" },
    cleanedQuery: { type: "string" as const, description: "The user query rewritten as a clean real estate search query for Luxembourg portals" },
  },
};

/**
 * Parse a user's search query using Perplexity to extract:
 * - Correct commune name (handles misspellings, abbreviations, all languages)
 * - Neighborhood within Luxembourg City
 * - Property type and transaction type
 * - A cleaned/normalized search query
 */
async function parseQuery(rawQuery: string): Promise<ParsedQuery> {
  const client = getClient();

  const response = await (client.chat.completions.create as Function)({
    model: "sonar",
    web_search_options: { search_context_size: "low" },
    response_format: {
      type: "json_schema",
      json_schema: { name: "query_parse", schema: QUERY_PARSE_SCHEMA, strict: true },
    },
    max_tokens: 256,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "Extract the Luxembourg location and intent from a real estate search query. Correct misspellings. Identify the commune (one of the 100 Luxembourg communes), any neighborhood within Luxembourg City, property type, and whether the user wants to buy or rent. Rewrite the query as a clean search for Luxembourg real estate portals.",
      },
      { role: "user", content: rawQuery },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content) as ParsedQuery;
  } catch {
    return {
      commune: null,
      neighborhood: null,
      propertyType: null,
      transactionType: "any",
      cleanedQuery: rawQuery + " Luxembourg",
    };
  }
}

/**
 * Analyze a raw user query: parse it with Perplexity, then build the enriched query and context.
 */
async function analyzeQuery(rawQuery: string): Promise<QueryContext & { parsed: ParsedQuery }> {
  const parsed = await parseQuery(rawQuery);

  // Use the cleaned query from Perplexity, ensure "Luxembourg" is present
  let enrichedQuery = parsed.cleanedQuery;
  if (!/luxemb/i.test(enrichedQuery)) {
    enrichedQuery += " Luxembourg";
  }

  return { enrichedQuery, domains: LUXEMBOURG_PORTALS, parsed };
}

// ── Perplexity response types ────────────────────────────────────────────────

interface PerplexitySearchResult {
  url: string;
  title?: string;
  snippet?: string;
  date?: string;
}

interface PerplexityRawResponse {
  citations?: string[];
  search_results?: PerplexitySearchResult[];
}

// ── JSON Schema for structured output ────────────────────────────────────────

const PROPERTY_SCHEMA = {
  type: "object" as const,
  required: ["properties", "summary"],
  additionalProperties: false,
  properties: {
    properties: {
      type: "array" as const,
      items: {
        type: "object" as const,
        required: ["address", "city", "price", "propertyType", "description", "source", "listingMode"],
        additionalProperties: false,
        properties: {
          address: { type: "string" as const, description: "Exact street address from the listing. If only city available, use city name." },
          city: { type: "string" as const, description: "City or commune name" },
          state: { type: "string" as const, default: "Luxembourg" },
          zipCode: { type: ["string", "null"] as const },
          price: { type: "number" as const, description: "EXACT price from listing. Monthly amount for rentals. 0 if unknown. NEVER round." },
          bedrooms: { type: "number" as const, description: "Number of bedrooms. 0 for commercial." },
          bathrooms: { type: "number" as const, description: "Number of bathrooms. 0 if unknown." },
          sqft: { type: "number" as const, description: "Surface area in m². 0 if unknown." },
          propertyType: { type: "string" as const, description: "House, Apartment, Office, Studio, Land, Commercial, etc." },
          yearBuilt: { type: ["number", "null"] as const },
          description: { type: "string" as const, description: "Brief description with citation markers [1], [2] etc. linking to the source." },
          features: { type: "array" as const, items: { type: "string" as const } },
          source: { type: "string" as const, description: "Portal name: athome.lu, immotop.lu, wortimmo.lu, etc." },
          listingStatus: { type: "string" as const, description: "Active for sales. 'Rental - €X/month' for rentals with exact price." },
          aiInsight: { type: ["string", "null"] as const, description: "One short sentence about what makes this property notable." },
          listingMode: { type: "string" as const, enum: ["buy", "rent"], description: "buy for sales, rent for rentals." },
        },
      },
    },
    summary: { type: "string" as const, description: "1-2 sentences: count, price range, top pick." },
    marketContext: { type: ["string", "null"] as const, description: "One short market stat, max 15 words." },
    suggestedFollowUps: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "3-4 follow-up queries the user might try.",
    },
  },
};

// ── System prompts ───────────────────────────────────────────────────────────

const SEARCH_SYSTEM_PROMPT = `You are a Luxembourg real estate search engine. Find property listings on athome.lu, immotop.lu, wortimmo.lu, vivi.lu and similar Luxembourg portals.

For each property found, extract:
- The exact address as written on the listing page
- The exact price as shown on the listing (do not round: write 2600, not 3000)
- Surface area in m², number of rooms/bedrooms/bathrooms
- Whether it's for sale (listingMode="buy") or rent (listingMode="rent")
- The portal name as source
- A brief description with [N] citation markers referencing your sources

If information is missing from the listing, use 0 for numbers or null for text fields.
Return as many listings as you find.`;

const EXPANDED_SEARCH_SYSTEM_PROMPT = `You are a Luxembourg real estate search engine. Find ADDITIONAL property listings that complement an existing search. Look in nearby communes, adjacent price ranges, or similar property types.

For each property, extract:
- The exact address and price from the listing (do not round prices)
- Surface area in m², rooms, bedrooms, bathrooms
- Whether it's for sale (listingMode="buy") or rent (listingMode="rent")
- The portal name as source
- A brief description with [N] citation markers

Return as many relevant listings as you find.`;

// ── Shared API call options ─────────────────────────────────────────────────

function buildApiOptions(domains: string[]) {
  return {
    search_domain_filter: domains.length > 0 ? domains : undefined,
    // No recency filter — listings stay up for months, filtering would exclude valid results
    web_search_options: {
      search_context_size: "high" as const,
      user_location: {
        country: "LU",
        city: "Luxembourg",
      },
    },
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: "property_search_results",
        schema: PROPERTY_SCHEMA,
        strict: true,
      },
    },
    max_tokens: 4096,
    temperature: 0,
  };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Match a property to the best search_result URL.
 * Priority: citation markers [N] → price match in title.
 * Only assigns a URL if we're confident it's the right listing.
 */
function extractListingUrl(
  address: string,
  description: string,
  source: string | null,
  price: number,
  searchResults: PerplexitySearchResult[],
  usedUrls: Set<string>
): string | null {
  const addressLower = address.toLowerCase();
  const commonWords = new Set(["street", "avenue", "road", "drive", "lane", "court", "place", "boulevard", "north", "south", "east", "west", "rue", "allée", "chemin", "impasse", "route", "montée", "cité", "résidence", "lot", "square", "passage"]);
  const addressWords = addressLower.split(/[\s,]+/).filter((w) => w.length > 2 && !commonWords.has(w));

  // Build a flat URL list from search_results for citation indexing
  const urls = searchResults.map((sr) => sr.url);

  // 1. Try citation markers [N] in description
  const citationRefs = description.match(/\[(\d+)\]/g);
  if (citationRefs) {
    for (const ref of citationRefs) {
      const idx = parseInt(ref.replace(/[[\]]/g, ""), 10) - 1;
      if (idx >= 0 && idx < urls.length && !usedUrls.has(urls[idx])) {
        if (looksLikeListingUrl(urls[idx])) {
          usedUrls.add(urls[idx]);
          return urls[idx];
        }
      }
    }
  }

  // 2. Match by price in search_results title (e.g. "Bureau • 165 m² • 3 900")
  // Only match if the title contains the property's exact price — prevents wrong URL assignment
  if (price > 0 && searchResults.length > 0) {
    for (const sr of searchResults) {
      if (usedUrls.has(sr.url)) continue;
      if (!looksLikeListingUrl(sr.url)) continue;
      const title = (sr.title || "").replace(/\s/g, "");
      const priceStr = String(price);
      // Check if title contains the price
      if (title.includes(priceStr) || title.includes(price.toLocaleString("de-LU"))) {
        usedUrls.add(sr.url);
        return sr.url;
      }
    }
  }

  return null;
}

function looksLikeListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.length <= 1) return false;
    if (/^\/(search|results|index)\/?$/i.test(path)) return false;
    const hostname = parsed.hostname.toLowerCase();
    const isLuxPortal =
      hostname.includes("athome.lu") ||
      hostname.includes("immotop.lu") ||
      hostname.includes("wortimmo.lu") ||
      hostname.includes("immobilier.lu") ||
      hostname.includes("vivi.lu") ||
      hostname.includes("habiter.lu");
    if (isLuxPortal) {
      return /\d{4,}/.test(path);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse structured JSON response into Property array.
 * With response_format, JSON is guaranteed valid — no regex needed.
 */
function parseProperties(
  content: string,
  searchResults: PerplexitySearchResult[],
  idPrefix: string
): { properties: Property[]; summary: string; suggestedFollowUps: string[]; marketContext: string; categoryUrls: string[] } {
  const parsed = JSON.parse(content);
  const rawProperties: unknown[] = Array.isArray(parsed.properties) ? parsed.properties : [];
  const summary: string = parsed.summary || "";
  const suggestedFollowUps: string[] = Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps : [];
  const marketContext: string = parsed.marketContext || "";

  const usedUrls = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Property[] = rawProperties.map((p: any, i: number) => {
    const address = p.address || "Address not available";
    const city = p.city || "";
    const description = p.description || "";
    const source = typeof p.source === "string" ? p.source.replace(/\[\d+\]/g, "").trim() || null : null;
    const price = typeof p.price === "number" ? p.price : parseFloat(String(p.price || "0").replace(/[^0-9.]/g, "")) || 0;

    const listingUrl = extractListingUrl(address, description, source, price, searchResults, usedUrls);
    const sqft = p.sqft || 0;

    return {
      id: `${idPrefix}-${Date.now()}-${i}`,
      address,
      city,
      state: p.state || "Luxembourg",
      zipCode: String(p.zipCode || ""),
      price,
      bedrooms: p.bedrooms || 0,
      bathrooms: p.bathrooms || 0,
      sqft,
      propertyType: p.propertyType || "Unknown",
      yearBuilt: p.yearBuilt || null,
      description: description.replace(/\[\d+\]/g, "").trim(),
      features: Array.isArray(p.features) ? p.features : [],
      imageUrl: null,
      source,
      listingUrl,
      listingStatus: p.listingStatus || (p.listingMode === "rent" ? `Rental - €${price.toLocaleString()}/month` : "Active"),
      aiInsight: p.aiInsight || undefined,
      listingMode: p.listingMode === "rent" ? "rent" : "buy",
      pricePerSqm: price > 0 && sqft > 0 ? Math.round(price / sqft) : undefined,
    };
  });

  // Second pass: match properties without URLs by price/sqft against search_results titles
  for (const p of properties) {
    if (p.listingUrl) continue;

    let bestUrl: string | null = null;
    let bestScore = 0;

    for (const sr of searchResults) {
      if (usedUrls.has(sr.url)) continue;
      if (!looksLikeListingUrl(sr.url)) continue;

      const haystack = ((sr.title || "") + " " + (sr.snippet || "")).toLowerCase();
      let score = 0;

      if (p.price > 0 && haystack.includes(String(p.price))) score += 2;
      if (p.sqft > 0 && haystack.includes(String(p.sqft))) score += 2;
      if (p.city && haystack.includes(p.city.toLowerCase())) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestUrl = sr.url;
      }
    }

    if (bestUrl && bestScore >= 2) {
      p.listingUrl = bestUrl;
      usedUrls.add(bestUrl);
    }
  }

  // Collect category page URLs that properties reference but couldn't use
  // We'll return these so the actions layer can scrape them for listing URLs
  const categoryUrls: string[] = [];
  for (const sr of searchResults) {
    if (usedUrls.has(sr.url)) continue;
    if (looksLikeListingUrl(sr.url)) continue;
    // It's a category page from a known portal
    try {
      const hostname = new URL(sr.url).hostname.toLowerCase();
      if (hostname.includes("immotop.lu") || hostname.includes("wortimmo.lu")) {
        categoryUrls.push(sr.url);
      }
    } catch { /* skip */ }
  }

  return { properties, summary, suggestedFollowUps, marketContext, categoryUrls };
}

// ── Search functions ─────────────────────────────────────────────────────────

export async function searchProperties(query: string, mode: "buy" | "rent" = "buy"): Promise<SearchResult> {
  const client = getClient();
  const { enrichedQuery, domains, parsed } = await analyzeQuery(query);

  // Use parsed transaction type if user's query has clear intent, otherwise use UI mode
  const effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;

  const modeInstruction = effectiveMode === "rent"
    ? "\n\nThe user is looking to RENT. Only return RENTAL listings. Do NOT include properties for sale."
    : "\n\nThe user is looking to BUY. Only return properties for SALE. Do NOT include rental listings.";

  // @ts-expect-error -- Perplexity-specific params not in OpenAI types
  const response = await client.chat.completions.create({
    model: "sonar",
    ...buildApiOptions(domains),
    messages: [
      { role: "system", content: SEARCH_SYSTEM_PROMPT + modeInstruction },
      { role: "user", content: enrichedQuery },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const searchResults = raw.search_results || [];
  // Fallback: use citations as URLs if search_results is empty (backward compat)
  if (searchResults.length === 0 && raw.citations) {
    for (const url of raw.citations) {
      searchResults.push({ url });
    }
  }

  try {
    const { properties, summary, suggestedFollowUps, marketContext, categoryUrls } = parseProperties(content, searchResults, "prop");
    return {
      properties,
      summary: summary || `Found ${properties.length} results`,
      citations: searchResults.map((sr) => sr.url),
      suggestedFollowUps,
      marketContext,
      categoryUrls,
    };
  } catch {
    return {
      properties: [],
      summary: content,
      citations: searchResults.map((sr) => sr.url),
    };
  }
}

export async function searchExpandedProperties(
  originalQuery: string,
  preferenceHints: string | null
): Promise<SearchResult> {
  const client = getClient();
  const { enrichedQuery, domains, parsed } = await analyzeQuery(originalQuery);

  // Use parsed commune for reliable nearby lookup
  const commune = parsed.neighborhood || parsed.commune || "";
  const nearby = getNearbyCommunes(commune);
  const nearbyText = nearby.length > 0
    ? `Search specifically in these nearby communes: ${nearby.join(", ")}.`
    : "Search in nearby communes.";

  let expandedPrompt = `Based on this original search: "${enrichedQuery}"

Find ADDITIONAL properties in the area. ${nearbyText} Do NOT repeat properties from the original search.`;

  if (preferenceHints) {
    expandedPrompt += `\n\nUser preferences: ${preferenceHints}`;
  }

  // @ts-expect-error -- Perplexity-specific params not in OpenAI types
  const response = await client.chat.completions.create({
    model: "sonar",
    ...buildApiOptions(domains),
    messages: [
      { role: "system", content: EXPANDED_SEARCH_SYSTEM_PROMPT },
      { role: "user", content: expandedPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const searchResults = raw.search_results || [];
  if (searchResults.length === 0 && raw.citations) {
    for (const url of raw.citations) {
      searchResults.push({ url });
    }
  }

  try {
    const { properties, summary, suggestedFollowUps, marketContext } = parseProperties(content, searchResults, "expanded");
    return {
      properties,
      summary: summary || `Found ${properties.length} additional results`,
      citations: searchResults.map((sr) => sr.url),
      suggestedFollowUps,
      marketContext,
    };
  } catch {
    return {
      properties: [],
      summary: content,
      citations: searchResults.map((sr) => sr.url),
    };
  }
}

export async function searchWithContext(
  query: string,
  previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<SearchResult> {
  const client = getClient();
  const { enrichedQuery, domains, parsed } = await analyzeQuery(query);

  const effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;
  const modeInstruction = effectiveMode === "rent"
    ? "The user is looking to RENT. Only return rental listings."
    : "The user is looking to BUY. Only return properties for sale.";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${SEARCH_SYSTEM_PROMPT}\n\n${modeInstruction}\n\nThis is a follow-up query. Use conversation history for context. Do NOT repeat earlier properties.` },
  ];

  for (const turn of previousTurns) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: enrichedQuery });

  // @ts-expect-error -- Perplexity-specific params not in OpenAI types
  const response = await client.chat.completions.create({
    model: "sonar",
    ...buildApiOptions(domains),
    messages,
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const searchResults = raw.search_results || [];
  if (searchResults.length === 0 && raw.citations) {
    for (const url of raw.citations) {
      searchResults.push({ url });
    }
  }

  try {
    const { properties, summary, suggestedFollowUps, marketContext } = parseProperties(content, searchResults, "refine");
    return {
      properties,
      summary: summary || `Found ${properties.length} results`,
      citations: searchResults.map((sr) => sr.url),
      suggestedFollowUps,
      marketContext,
    };
  } catch {
    return {
      properties: [],
      summary: content,
      citations: searchResults.map((sr) => sr.url),
    };
  }
}

export async function compareProperties(
  properties: { address: string; city: string; price: number; sqft: number; bedrooms: number; bathrooms: number; propertyType: string; features: string[] }[]
): Promise<string> {
  const client = getClient();

  const propertyDescriptions = properties.map((p, i) =>
    `Property ${i + 1}: ${p.address}, ${p.city} — €${p.price.toLocaleString()}, ${p.sqft}m², ${p.bedrooms}bd/${p.bathrooms}ba, ${p.propertyType}. Features: ${p.features.slice(0, 5).join(", ") || "none listed"}`
  ).join("\n");

  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [
      {
        role: "system",
        content: `You are a Luxembourg real estate advisor. Compare the given properties and give a clear, opinionated recommendation. Be concise (3-4 sentences max). State which is the best value and why. Respond in the same language the properties are described in.`,
      },
      {
        role: "user",
        content: `Compare these properties:\n\n${propertyDescriptions}`,
      },
    ],
    temperature: 0,
  });

  return response.choices[0]?.message?.content || "Unable to generate comparison.";
}

export async function getNeighborhoodAnalysis(
  address: string,
  city: string,
  state: string
): Promise<NeighborhoodData> {
  const client = getClient();
  const location = `${address}, ${city}, ${state}`;

  const response = await (client.chat.completions.create as Function)({
    model: "sonar-pro",
    web_search_options: {
      search_context_size: "high",
      user_location: { country: "LU", city: "Luxembourg" },
    },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "neighborhood_analysis",
        schema: {
          type: "object",
          required: ["overview"],
          additionalProperties: false,
          properties: {
            overview: { type: "string" },
            schoolRating: { type: ["string", "null"] },
            walkScore: { type: ["string", "null"] },
            crimeLevel: { type: ["string", "null"] },
            nearbyAmenities: { type: "array", items: { type: "string" } },
            commuteInfo: { type: ["string", "null"] },
            medianHomePrice: { type: ["string", "null"] },
            priceHistory: { type: ["string", "null"] },
          },
        },
        strict: true,
      },
    },
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are a Luxembourg neighborhood analyst. Given a property location, provide detailed neighborhood analysis with real, current data specific to Luxembourg.`,
      },
      {
        role: "user",
        content: `Neighborhood analysis for: ${location}`,
      },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const searchResults = raw.search_results || [];
  const citations = searchResults.map((sr) => sr.url);
  // Fallback to old citations field
  if (citations.length === 0 && raw.citations) {
    citations.push(...raw.citations);
  }

  try {
    const parsed = JSON.parse(content);
    return {
      overview: parsed.overview || "",
      schoolRating: parsed.schoolRating || null,
      walkScore: parsed.walkScore || null,
      crimeLevel: parsed.crimeLevel || null,
      nearbyAmenities: parsed.nearbyAmenities || [],
      commuteInfo: parsed.commuteInfo || null,
      medianHomePrice: parsed.medianHomePrice || null,
      priceHistory: parsed.priceHistory || null,
      citations,
    };
  } catch {
    return {
      overview: content,
      schoolRating: null,
      walkScore: null,
      crimeLevel: null,
      nearbyAmenities: [],
      commuteInfo: null,
      medianHomePrice: null,
      priceHistory: null,
      citations,
    };
  }
}
