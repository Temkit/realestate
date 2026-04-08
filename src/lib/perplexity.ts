import OpenAI from "openai";
import type { Property, SearchResult, NeighborhoodData, ConversationTurn } from "./types";

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

function analyzeQuery(rawQuery: string): QueryContext {
  const locationFixes: [RegExp, string][] = [
    [/\b[mn]o[nd]?dorf[\s-]les[\s-]bains\b/i, "Mondorf-les-Bains, Luxembourg"],
    [/\bmondorf\b/i, "Mondorf-les-Bains, Luxembourg"],
    [/\besch[\s-]sur[\s-]alzette\b/i, "Esch-sur-Alzette, Luxembourg"],
    [/\besch[\s-]alzette\b/i, "Esch-sur-Alzette, Luxembourg"],
    [/\besch\b(?=.*\b(?:appart|maison|house|bureau|louer|rent|buy|acheter|terrain|immob))/i, "Esch-sur-Alzette, Luxembourg"],
    [/\bluxembourg[\s-]ville\b/i, "Luxembourg City, Luxembourg"],
    [/\blux[\s-]ville\b/i, "Luxembourg City, Luxembourg"],
    [/\bdudelange\b/i, "Dudelange, Luxembourg"],
    [/\bdüdelingen\b/i, "Dudelange, Luxembourg"],
    [/\bdifferdange\b/i, "Differdange, Luxembourg"],
    [/\bdifferdingen\b/i, "Differdange, Luxembourg"],
    [/\bpétange\b/i, "Pétange, Luxembourg"],
    [/\bpetange\b/i, "Pétange, Luxembourg"],
    [/\bettelbr[uü]ck\b/i, "Ettelbruck, Luxembourg"],
    [/\bwiltz\b/i, "Wiltz, Luxembourg"],
    [/\bvianden\b/i, "Vianden, Luxembourg"],
    [/\bmersch\b/i, "Mersch, Luxembourg"],
    [/\bclervaux\b/i, "Clervaux, Luxembourg"],
    [/\bechternach\b/i, "Echternach, Luxembourg"],
    [/\bgrevenmacher\b/i, "Grevenmacher, Luxembourg"],
    [/\bremich\b/i, "Remich, Luxembourg"],
    [/\bdiekirch\b/i, "Diekirch, Luxembourg"],
    [/\bstrassen\b/i, "Strassen, Luxembourg"],
    [/\bbertrange\b/i, "Bertrange, Luxembourg"],
    [/\bhesperange\b/i, "Hesperange, Luxembourg"],
    [/\bwalferdange\b/i, "Walferdange, Luxembourg"],
    [/\bsteinsel\b/i, "Steinsel, Luxembourg"],
    [/\bsandweiler\b/i, "Sandweiler, Luxembourg"],
    [/\bniederkorn\b/i, "Niederkorn, Luxembourg"],
    [/\bschifflange\b/i, "Schifflange, Luxembourg"],
    [/\bkayl\b/i, "Kayl, Luxembourg"],
    [/\brumelange\b/i, "Rumelange, Luxembourg"],
    [/\bbelvaux\b/i, "Belvaux, Luxembourg"],
    [/\bbelval\b/i, "Belval, Luxembourg"],
    [/\bsanem\b/i, "Sanem, Luxembourg"],
    [/\bbettembourg\b/i, "Bettembourg, Luxembourg"],
    [/\bleudelange\b/i, "Leudelange, Luxembourg"],
    [/\bmamer\b/i, "Mamer, Luxembourg"],
    [/\bcapellen\b/i, "Capellen, Luxembourg"],
    [/\bkopstal\b/i, "Kopstal, Luxembourg"],
    [/\bjunglinster\b/i, "Junglinster, Luxembourg"],
    [/\bwasserbillig\b/i, "Wasserbillig, Luxembourg"],
    [/\bkirchberg\b/i, "Kirchberg, Luxembourg City"],
    [/\bbonnevoie\b/i, "Bonnevoie, Luxembourg City"],
    [/\bgasperich\b/i, "Gasperich, Luxembourg City"],
    [/\bbelair\b/i, "Belair, Luxembourg City"],
    [/\blimpertsberg\b/i, "Limpertsberg, Luxembourg City"],
    [/\bhollerich\b/i, "Hollerich, Luxembourg City"],
    [/\bgrund\b/i, "Grund, Luxembourg City"],
    [/\bclausen\b/i, "Clausen, Luxembourg City"],
    [/\bmerl\b/i, "Merl, Luxembourg City"],
    [/\bcessange\b/i, "Cessange, Luxembourg City"],
  ];

  let enriched = rawQuery;
  for (const [pattern, replacement] of locationFixes) {
    if (pattern.test(enriched)) {
      enriched = enriched.replace(pattern, replacement);
      break;
    }
  }
  if (!/luxembourg/i.test(enriched)) {
    enriched += " Luxembourg";
  }
  return { enrichedQuery: enriched, domains: LUXEMBOURG_PORTALS };
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

const SEARCH_SYSTEM_PROMPT = `You are a Luxembourg real estate listing search engine. Find ACTUAL, CURRENTLY AVAILABLE properties on Luxembourg real estate portals.

CRITICAL RULES — FOLLOW EXACTLY:
1. ONLY return properties from individual listing pages you can cite with [N] markers. Do NOT return properties from search/category pages.
2. Copy ALL data EXACTLY as it appears on the listing. NEVER round prices (write 2600 not 3000, write 475000 not 500000). NEVER guess or invent data.
3. Every property MUST have a citation [N] in its description linking to the specific listing page.
4. Use the EXACT address from the listing. If only city name is available, use that — do NOT fabricate street addresses.
5. Clearly distinguish RENT vs SALE — check the listing. For rentals: listingMode="rent", price=monthly amount, listingStatus="Rental - €EXACT_PRICE/month".
6. If a detail is not on the listing, use 0 for numbers or null for optional fields. NEVER guess.
7. Quality over quantity: 3 accurate listings with real citations beat 10 unverified ones.

Return data as JSON matching the provided schema.`;

const EXPANDED_SEARCH_SYSTEM_PROMPT = `You are a Luxembourg real estate listing search engine. Find ADDITIONAL properties that COMPLEMENT an existing search.

CRITICAL RULES — FOLLOW EXACTLY:
1. ONLY return properties from individual listing pages you can cite with [N] markers.
2. Copy ALL data EXACTLY as it appears on the listing. NEVER round prices. NEVER guess.
3. Every property MUST have a citation [N] in its description.
4. Expand by: nearby communes, adjacent price ranges, similar property types.
5. Clearly distinguish RENT vs SALE. For rentals: listingMode="rent", price=monthly amount.
6. Quality over quantity: only return properties backed by a specific citation.

Return data as JSON matching the provided schema.`;

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
 * Priority: citation markers [N] → address keyword match → source domain fallback.
 */
function extractListingUrl(
  address: string,
  description: string,
  source: string | null,
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

  // 2. Match address keywords against search_results (title + snippet + url)
  if (addressWords.length > 0 && searchResults.length > 0) {
    let bestMatch: PerplexitySearchResult | null = null;
    let bestScore = 0;

    for (const sr of searchResults) {
      if (usedUrls.has(sr.url)) continue;
      if (!looksLikeListingUrl(sr.url)) continue;
      const haystack = [sr.title || "", sr.snippet || "", sr.url].join(" ").toLowerCase();
      const score = addressWords.filter((w) => haystack.includes(w)).length;
      if (score > bestScore && score >= 1) {
        bestScore = score;
        bestMatch = sr;
      }
    }

    if (bestMatch) {
      usedUrls.add(bestMatch.url);
      return bestMatch.url;
    }
  }

  // 3. Fall back to source domain match
  if (source) {
    const sourceDomain = source.toLowerCase().replace(/\s+/g, "");
    for (const sr of searchResults) {
      if (usedUrls.has(sr.url)) continue;
      if (!looksLikeListingUrl(sr.url)) continue;
      try {
        const hostname = new URL(sr.url).hostname.toLowerCase();
        if (hostname.includes(sourceDomain.split(".")[0])) {
          usedUrls.add(sr.url);
          return sr.url;
        }
      } catch { /* skip */ }
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
): { properties: Property[]; summary: string; suggestedFollowUps: string[]; marketContext: string } {
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

    const listingUrl = extractListingUrl(address, description, source, searchResults, usedUrls);

    const price = typeof p.price === "number" ? p.price : parseFloat(String(p.price || "0").replace(/[^0-9.]/g, "")) || 0;
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

  return { properties, summary, suggestedFollowUps, marketContext };
}

// ── Search functions ─────────────────────────────────────────────────────────

export async function searchProperties(query: string, mode: "buy" | "rent" = "buy"): Promise<SearchResult> {
  const client = getClient();
  const { enrichedQuery, domains } = analyzeQuery(query);

  const modeInstruction = mode === "rent"
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
    const { properties, summary, suggestedFollowUps, marketContext } = parseProperties(content, searchResults, "prop");
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

export async function searchExpandedProperties(
  originalQuery: string,
  preferenceHints: string | null
): Promise<SearchResult> {
  const client = getClient();
  const { enrichedQuery, domains } = analyzeQuery(originalQuery);

  let expandedPrompt = `Based on this original search: "${enrichedQuery}"

Find ADDITIONAL properties in nearby communes or with slightly different criteria. Do NOT repeat the same properties.`;

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
  const { enrichedQuery, domains } = analyzeQuery(query);

  const modeInstruction = mode === "rent"
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
