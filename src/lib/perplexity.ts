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

// Luxembourg-focused portal domains (primary portals first)
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

/**
 * Enriches the user's raw query with location corrections
 * and returns the domains to filter search on.
 * Always defaults to Luxembourg portals since this is a Luxembourg-only app.
 */
function analyzeQuery(rawQuery: string): QueryContext {
  // Misspelling / abbreviation corrections
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

  // Apply location corrections
  for (const [pattern, replacement] of locationFixes) {
    if (pattern.test(enriched)) {
      enriched = enriched.replace(pattern, replacement);
      break;
    }
  }

  // Always append "Luxembourg" context if not already present
  if (!/luxembourg/i.test(enriched)) {
    enriched += " Luxembourg";
  }

  // Always use Luxembourg portals — this is a Luxembourg-only app
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

// ── System prompts ───────────────────────────────────────────────────────────

const SEARCH_SYSTEM_PROMPT = `You are a Luxembourg real estate listing search engine. Find ACTUAL, CURRENTLY AVAILABLE properties for sale or rent in Luxembourg.

CRITICAL RULES:
- Return ONLY real property listings that are currently on the market
- NEVER return real estate agencies, agents, brokers, or agency directories
- NEVER invent or guess data — if you cannot find a specific detail, use null or 0
- Each property MUST reference a specific citation using [N] markers in the description — this is how we link properties to their source URLs
- Prices MUST be the EXACT number from the listing — NEVER round or approximate. Write 2600 not 3000, write 475000 not 500000. Copy the number exactly as it appears on the listing page.
- Each property MUST clearly indicate if it's for SALE or RENT — check the listing carefully
- Return data EXACTLY as it appears on the source — do not interpret, summarize, or modify any values
- Include the portal name in the "source" field (e.g. athome.lu, immotop.lu, wortimmo.lu)
- Prioritize ACCURACY over quantity — only include properties you found on a specific listing page with a verifiable URL
- Do NOT return properties from search result/category pages — only from individual listing detail pages
- If a property has specific details (exact m², rooms, year built, features), include them. If not, use null/0
- For addresses: use the EXACT address from the listing, not just the city name. If only city is available, still include it but don't fabricate a street address

Return a JSON object with this structure:
{
  "properties": [
    {
      "id": "unique-id-string",
      "address": "full street address or location description",
      "city": "city or commune name",
      "state": "Luxembourg",
      "zipCode": "postal code (L-XXXX)",
      "price": 500000,
      "bedrooms": 3,
      "bathrooms": 2,
      "sqft": 150,
      "propertyType": "House",
      "yearBuilt": null,
      "description": "brief description from the listing [1]",
      "features": ["feature1", "feature2"],
      "imageUrl": null,
      "source": "website name where listing was found",
      "listingStatus": "Active",
      "aiInsight": "one short sentence: what makes this property notable (e.g. 'Below market price for Kirchberg', 'Best value per m²', 'Near international school', 'Recently listed')",
      "listingMode": "buy"
    }
  ],
  "summary": "MAX 1-2 short sentences. State how many found, price range, and your top pick. Example: '8 apartments found, €650K–€1.2M. Best value: 17 rue Sauvage at €868K — below market for Kirchberg.' NEVER write more than 2 sentences.",
  "marketContext": "One short stat. Example: 'Kirchberg average: €10,500/m²'. MAX 15 words.",
  "suggestedFollowUps": ["3-4 natural follow-up queries the user might want to try next, e.g. 'Show me cheaper options in nearby Neudorf', 'Only rentals under €2,000/month', 'Apartments with terrace']
}

- For commercial (office/bureau/retail): bedrooms=0, bathrooms=0
- Price = NUMBER only. Monthly rent for rentals. 0 if unknown.
- The "sqft" field is used for surface area in m² — return the value in m² directly, do NOT convert. Use 0 if unknown.
- For rentals: set listingMode to "rent" and listingStatus to "Rental - €X/month" or similar
- For sales: set listingMode to "buy"
- aiInsight MUST be unique per property — highlight what differentiates each one
- Only return properties you can back with a specific citation [N] to an individual listing page — do NOT pad results with unverified data
- Quality over quantity: 5 accurate listings beat 15 guessed ones
- MUST be valid JSON`;

const EXPANDED_SEARCH_SYSTEM_PROMPT = `You are a Luxembourg real estate listing search engine. Find ACTUAL, CURRENTLY AVAILABLE properties for sale or rent in Luxembourg that COMPLEMENT an existing search.

CRITICAL RULES:
- Return ONLY real property listings that are currently on the market
- NEVER return real estate agencies, agents, brokers, or agency directories
- NEVER invent or guess data — if you cannot find a specific detail, use null or 0
- Each property MUST reference a specific citation using [N] markers in the description
- Each property MUST have an accurate price EXACTLY as shown on the listing — do NOT round
- Each property MUST clearly indicate if it's for SALE or RENT
- Include the portal name in the "source" field (e.g. athome.lu, immotop.lu, wortimmo.lu)
- These results should EXPAND the user's options — look in nearby communes, adjacent price ranges, or similar property types
- Only include properties you found on a specific listing page with a verifiable citation
- For addresses: use the EXACT address from the listing

Return a JSON object with this structure:
{
  "properties": [
    {
      "id": "unique-id-string",
      "address": "full street address or location description",
      "city": "city or commune name",
      "state": "Luxembourg",
      "zipCode": "postal code (L-XXXX)",
      "price": 500000,
      "bedrooms": 3,
      "bathrooms": 2,
      "sqft": 150,
      "propertyType": "House",
      "yearBuilt": null,
      "description": "brief description from the listing [1]",
      "features": ["feature1", "feature2"],
      "imageUrl": null,
      "source": "website name where listing was found",
      "listingStatus": "Active",
      "aiInsight": "one short sentence about what makes this notable",
      "listingMode": "buy"
    }
  ],
  "summary": "brief summary explaining how these differ from the main results, in the same language as the query"
}

- For commercial (office/bureau/retail): bedrooms=0, bathrooms=0
- Price = NUMBER only. Monthly rent for rentals. 0 if unknown.
- The "sqft" field is used for surface area in m² — return the value in m² directly, do NOT convert. Use 0 if unknown.
- For rentals: set listingMode to "rent" and listingStatus to "Rental - €X/month" or similar
- For sales: set listingMode to "buy"
- Only return properties backed by a specific citation — quality over quantity
- MUST be valid JSON`;

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Match a property to the best citation/search_result URL.
 * Strategy: check if the URL or its metadata contains address keywords.
 * Falls back to domain matching against the source name.
 */
function extractListingUrl(
  address: string,
  description: string,
  source: string | null,
  citations: string[],
  searchResults: PerplexitySearchResult[],
  usedUrls: Set<string>
): string | null {
  const addressLower = address.toLowerCase();
  // Extract meaningful words from address (no common street words)
  const commonWords = new Set(["street", "avenue", "road", "drive", "lane", "court", "place", "boulevard", "north", "south", "east", "west", "rue", "allée", "chemin", "impasse", "route", "montée", "cité", "résidence", "lot", "square", "passage"]);
  const addressWords = addressLower.split(/[\s,]+/).filter((w) => w.length > 2 && !commonWords.has(w));

  // 1. Try citation markers [N] in description
  const citationRefs = description.match(/\[(\d+)\]/g);
  if (citationRefs) {
    for (const ref of citationRefs) {
      const idx = parseInt(ref.replace(/[[\]]/g, ""), 10) - 1;
      if (idx >= 0 && idx < citations.length && !usedUrls.has(citations[idx])) {
        const url = citations[idx];
        if (looksLikeListingUrl(url)) {
          usedUrls.add(url);
          return url;
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
      const haystack = [sr.title || "", sr.snippet || "", sr.url].join(" ").toLowerCase();
      const score = addressWords.filter((w) => haystack.includes(w)).length;
      if (score > bestScore && score >= 1) {
        bestScore = score;
        bestMatch = sr;
      }
    }

    if (bestMatch && looksLikeListingUrl(bestMatch.url)) {
      usedUrls.add(bestMatch.url);
      return bestMatch.url;
    }
  }

  // 3. Match address keywords against citation URLs
  if (addressWords.length > 0) {
    let bestUrl: string | null = null;
    let bestScore = 0;

    for (const url of citations) {
      if (usedUrls.has(url)) continue;
      const urlLower = url.toLowerCase();
      const score = addressWords.filter((w) => urlLower.includes(w)).length;
      if (score > bestScore && score >= 1) {
        bestScore = score;
        bestUrl = url;
      }
    }

    if (bestUrl && looksLikeListingUrl(bestUrl)) {
      usedUrls.add(bestUrl);
      return bestUrl;
    }
  }

  // 4. Fall back to source domain match
  if (source) {
    const sourceDomain = source.toLowerCase().replace(/\s+/g, "");
    for (const url of citations) {
      if (usedUrls.has(url)) continue;
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes(sourceDomain.split(".")[0]) && looksLikeListingUrl(url)) {
          usedUrls.add(url);
          return url;
        }
      } catch { /* skip invalid urls */ }
    }
  }

  return null;
}

/**
 * Heuristic: does this URL point to a specific listing page (not a search/category page)?
 * Luxembourg portals use numeric IDs for individual listings:
 *   athome.lu: /vente/bureau/city/id-8909236.html
 *   immotop.lu: /annonces/1353427/
 *   wortimmo.lu: /fr/annonce/12345
 * Search/category pages lack numeric IDs:
 *   athome.lu: /vente/bureau/mondorf-les-bains/
 *   immotop.lu: /en/vente-bureaux/mondorf-les-bains/
 */
function looksLikeListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    // Reject bare homepages
    if (path.length <= 1) return false;
    // Reject generic search/index pages
    if (/^\/(search|results|index)\/?$/i.test(path)) return false;
    // For known Luxembourg portals, require a numeric listing ID in the URL
    const hostname = parsed.hostname.toLowerCase();
    const isLuxPortal =
      hostname.includes("athome.lu") ||
      hostname.includes("immotop.lu") ||
      hostname.includes("wortimmo.lu") ||
      hostname.includes("immobilier.lu") ||
      hostname.includes("vivi.lu") ||
      hostname.includes("habiter.lu");
    if (isLuxPortal) {
      // Must contain a numeric ID (at least 4 digits) — listing pages always have one
      return /\d{4,}/.test(path);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse raw Perplexity response into typed Property array.
 */
function parseProperties(
  content: string,
  citations: string[],
  searchResults: PerplexitySearchResult[],
  idPrefix: string
): { properties: Property[]; summary: string; suggestedFollowUps: string[]; marketContext: string } {
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  const objectMatch = content.match(/\{[\s\S]*\}/);

  let rawProperties: unknown[] = [];
  let summary = "";
  let suggestedFollowUps: string[] = [];
  let marketContext = "";

  if (objectMatch) {
    const parsed = JSON.parse(objectMatch[0]);
    if (Array.isArray(parsed.properties)) {
      rawProperties = parsed.properties;
      summary = parsed.summary || "";
      suggestedFollowUps = Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps : [];
      marketContext = parsed.marketContext || "";
    } else if (Array.isArray(parsed)) {
      rawProperties = parsed;
    }
  }

  if (rawProperties.length === 0 && arrayMatch) {
    const parsed = JSON.parse(arrayMatch[0]);
    if (Array.isArray(parsed)) {
      rawProperties = parsed;
    }
  }

  // Track which citation URLs have been assigned to avoid giving same URL to multiple properties
  const usedUrls = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Property[] = rawProperties.map((p: any, i: number) => {
    const address = p.address || p.name || p.location || "Address not available";
    const city = p.city || p.ville || "";
    const description = p.description || "";
    const source =
      typeof p.source === "string"
        ? p.source.replace(/\[\d+\]/g, "").trim() || null
        : p.source || null;

    // Resolve listing URL from citations (real URLs, not model-generated)
    const listingUrl = extractListingUrl(address, description, source, citations, searchResults, usedUrls);

    return {
      id: p.id || `${idPrefix}-${Date.now()}-${i}`,
      address,
      city,
      state: p.state || p.region || p.country || "",
      zipCode: String(p.zipCode || p.postalCode || p.zip || ""),
      price:
        typeof p.price === "number"
          ? p.price
          : parseFloat(String(p.price || "0").replace(/[^0-9.]/g, "")) || 0,
      bedrooms: p.bedrooms || p.rooms || 0,
      bathrooms: p.bathrooms || 0,
      sqft: p.sqft || p.size || p.surface || 0,
      propertyType: p.propertyType || p.type || "Unknown",
      yearBuilt: p.yearBuilt || null,
      description: description.replace(/\[\d+\]/g, "").trim(),
      features: Array.isArray(p.features) ? p.features : [],
      imageUrl: null,
      source,
      listingUrl,
      listingStatus: p.listingStatus || p.status || "Active",
      aiInsight: p.aiInsight || undefined,
      listingMode: p.listingMode === "rent" ? "rent" : "buy",
      pricePerSqm:
        (typeof p.price === "number" ? p.price : parseFloat(String(p.price || "0").replace(/[^0-9.]/g, "")) || 0) > 0 &&
        (p.sqft || p.size || p.surface || 0) > 0
          ? Math.round((typeof p.price === "number" ? p.price : parseFloat(String(p.price || "0").replace(/[^0-9.]/g, "")) || 0) / (p.sqft || p.size || p.surface))
          : undefined,
    };
  });

  return { properties, summary, suggestedFollowUps, marketContext };
}

// ── Search functions ─────────────────────────────────────────────────────────

export async function searchProperties(query: string, mode: "buy" | "rent" = "buy"): Promise<SearchResult> {
  const client = getClient();
  const { enrichedQuery, domains } = analyzeQuery(query);

  const modeInstruction = mode === "rent"
    ? "\n\nIMPORTANT: The user is looking to RENT. Only return RENTAL listings. Do NOT include properties for sale."
    : "\n\nIMPORTANT: The user is looking to BUY. Only return properties for SALE. Do NOT include rental listings.";

  const response = await client.chat.completions.create({
    model: "sonar",
    // @ts-expect-error -- Perplexity-specific params not in OpenAI types
    search_domain_filter: domains.length > 0 ? domains : undefined,
    web_search_options: {
      search_context_size: "high",
    },
    messages: [
      { role: "system", content: SEARCH_SYSTEM_PROMPT + modeInstruction },
      { role: "user", content: enrichedQuery },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const citations = raw.citations || [];
  const searchResults = raw.search_results || [];

  try {
    const { properties, summary, suggestedFollowUps, marketContext } = parseProperties(content, citations, searchResults, "prop");
    return {
      properties,
      summary: summary || `Found ${properties.length} results`,
      citations,
      suggestedFollowUps,
      marketContext,
    };
  } catch {
    return {
      properties: [],
      summary: content,
      citations,
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

Find ADDITIONAL properties in the same commune or nearby communes in Luxembourg that the user might also be interested in. Broaden the search by:
- Looking in nearby communes or neighborhoods
- Slightly expanding the price range (±20-30%)
- Including similar but not identical property types
- Finding properties with different but appealing features

Do NOT repeat the same properties from the original search. Focus on real, currently listed properties only.`;

  if (preferenceHints) {
    expandedPrompt += `\n\nUser preference hints (learned from their browsing behavior): ${preferenceHints}. Use these hints to prioritize which expanded results to show.`;
  }

  const response = await client.chat.completions.create({
    model: "sonar",
    // @ts-expect-error -- Perplexity-specific params not in OpenAI types
    search_domain_filter: domains.length > 0 ? domains : undefined,
    web_search_options: {
      search_context_size: "high",
    },
    messages: [
      { role: "system", content: EXPANDED_SEARCH_SYSTEM_PROMPT },
      { role: "user", content: expandedPrompt },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const citations = raw.citations || [];
  const searchResults = raw.search_results || [];

  try {
    const { properties, summary, suggestedFollowUps, marketContext } = parseProperties(content, citations, searchResults, "expanded");
    return {
      properties,
      summary: summary || `Found ${properties.length} additional results`,
      citations,
      suggestedFollowUps,
      marketContext,
    };
  } catch {
    return {
      properties: [],
      summary: content,
      citations,
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
    ? "The user is looking to RENT. Only show rental listings."
    : "The user is looking to BUY. Only show properties for sale.";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${SEARCH_SYSTEM_PROMPT}\n\n${modeInstruction}\n\nIMPORTANT: This is a follow-up query. The user is refining their previous search. Use the conversation history to understand context. Do NOT repeat properties from earlier turns.` },
  ];

  // Add conversation history
  for (const turn of previousTurns) {
    messages.push({ role: turn.role, content: turn.content });
  }

  // Add the new query
  messages.push({ role: "user", content: enrichedQuery });

  const response = await client.chat.completions.create({
    model: "sonar",
    // @ts-expect-error -- Perplexity-specific params not in OpenAI types
    search_domain_filter: domains.length > 0 ? domains : undefined,
    web_search_options: {
      search_context_size: "high",
    },
    messages,
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "";
  const raw = response as unknown as PerplexityRawResponse;
  const citations = raw.citations || [];
  const searchResults = raw.search_results || [];

  try {
    const { properties, summary, suggestedFollowUps, marketContext } = parseProperties(content, citations, searchResults, "refine");
    return {
      properties,
      summary: summary || `Found ${properties.length} results`,
      citations,
      suggestedFollowUps,
      marketContext,
    };
  } catch {
    return {
      properties: [],
      summary: content,
      citations,
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
    web_search_options: {
      search_context_size: "high",
    },
    messages: [
      {
        role: "system",
        content: `You are a Luxembourg real estate advisor. Compare the given properties and give a clear, opinionated recommendation. Be concise (3-4 sentences max). State which is the best value and why. Consider price per m², location desirability in Luxembourg, and features. Respond in the same language the properties are described in.`,
      },
      {
        role: "user",
        content: `Compare these properties and tell me which is the best choice:\n\n${propertyDescriptions}`,
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

  const response = await client.chat.completions.create({
    model: "sonar-pro",
    web_search_options: {
      search_context_size: "high",
    },
    messages: [
      {
        role: "system",
        content: `You are a Luxembourg neighborhood analyst. Given a property location in Luxembourg, provide detailed neighborhood analysis. Return a JSON object:
{
  "overview": "2-3 sentence overview of the commune/neighborhood, including character and demographics",
  "schoolRating": "nearby schools summary — include international schools, European schools, lycées, and crèches/maisons relais if relevant",
  "walkScore": "walkability assessment — proximity to shops, restaurants, daily necessities on foot",
  "crimeLevel": "safety and quality of life summary for the commune",
  "nearbyAmenities": ["amenity 1", "amenity 2", ...],
  "commuteInfo": "public transport access (bus/tram/train lines), commute to Luxembourg City/Kirchberg/Cloche d'Or, proximity to borders (France/Belgium/Germany) for cross-border workers",
  "medianHomePrice": "median property price in this commune (€/m² for apartments, € for houses)",
  "priceHistory": "recent price trends in the commune/area"
}

Use real, current data specific to Luxembourg. Be specific about the actual commune and neighborhood.`,
      },
      {
        role: "user",
        content: `Provide a detailed neighborhood analysis for: ${location}`,
      },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "";
  const citations =
    (response as unknown as { citations?: string[] }).citations || [];

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
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

    const parsed = JSON.parse(jsonMatch[0]);
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
