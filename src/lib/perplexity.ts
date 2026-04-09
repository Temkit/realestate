import OpenAI from "openai";
import type { NeighborhoodData, ConversationTurn, DiscoveryResult } from "./types";
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

async function analyzeQuery(rawQuery: string): Promise<QueryContext & { parsed: ParsedQuery }> {
  const parsed = await parseQuery(rawQuery);

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

// ── Discovery schema (simple — no property extraction) ──────────────────────

const DISCOVERY_SCHEMA = {
  type: "object" as const,
  required: ["summary", "marketContext", "suggestedFollowUps"],
  additionalProperties: false,
  properties: {
    summary: { type: "string" as const, description: "1-2 sentence summary of what was found." },
    marketContext: { type: ["string", "null"] as const, description: "One short market stat, max 15 words." },
    suggestedFollowUps: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "3-4 follow-up queries the user might try.",
    },
  },
};

// ── System prompts ───────────────────────────────────────────────────────────

const DISCOVERY_SYSTEM_PROMPT = `You are a Luxembourg real estate search assistant. Search Luxembourg real estate portals (athome.lu, immotop.lu, wortimmo.lu, vivi.lu) for the user's query.

Your job is to FIND listing URLs — not to extract property details. Provide a brief summary of what you found and any market context.

Focus on finding as many relevant listing pages as possible from Luxembourg real estate portals.`;

// ── Shared API call options ─────────────────────────────────────────────────

function buildApiOptions(domains: string[]) {
  return {
    search_domain_filter: domains.length > 0 ? domains : undefined,
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
        name: "discovery_results",
        schema: DISCOVERY_SCHEMA,
        strict: true,
      },
    },
    max_tokens: 2048,
    temperature: 0,
  };
}

function extractSearchResults(response: unknown): PerplexitySearchResult[] {
  const raw = response as PerplexityRawResponse;
  const searchResults = raw.search_results || [];
  if (searchResults.length === 0 && raw.citations) {
    for (const url of raw.citations) {
      searchResults.push({ url });
    }
  }
  return searchResults;
}

// ── Search functions ─────────────────────────────────────────────────────────

export async function searchProperties(query: string, mode: "buy" | "rent" = "buy"): Promise<DiscoveryResult> {
  const client = getClient();
  const { enrichedQuery, domains, parsed } = await analyzeQuery(query);

  const effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;
  const modeInstruction = effectiveMode === "rent"
    ? "\n\nThe user is looking to RENT. Focus on rental listings."
    : "\n\nThe user is looking to BUY. Focus on properties for sale.";

  // @ts-expect-error -- Perplexity-specific params not in OpenAI types
  const response = await client.chat.completions.create({
    model: "sonar",
    ...buildApiOptions(domains),
    messages: [
      { role: "system", content: DISCOVERY_SYSTEM_PROMPT + modeInstruction },
      { role: "user", content: `Search Luxembourg real estate portals for: ${enrichedQuery}. Provide a summary of what you found.` },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  const searchResults = extractSearchResults(response);

  try {
    const parsed_response = JSON.parse(content);
    return {
      searchResults: searchResults.map((sr) => ({
        url: sr.url,
        title: sr.title,
        snippet: sr.snippet,
      })),
      summary: parsed_response.summary || "",
      suggestedFollowUps: Array.isArray(parsed_response.suggestedFollowUps) ? parsed_response.suggestedFollowUps : [],
      marketContext: parsed_response.marketContext || "",
    };
  } catch {
    return {
      searchResults: searchResults.map((sr) => ({
        url: sr.url,
        title: sr.title,
        snippet: sr.snippet,
      })),
      summary: "",
      suggestedFollowUps: [],
      marketContext: "",
    };
  }
}

export async function searchExpandedProperties(
  originalQuery: string,
  preferenceHints: string | null,
  mode: "buy" | "rent" = "buy"
): Promise<DiscoveryResult> {
  const client = getClient();
  const { enrichedQuery, domains, parsed } = await analyzeQuery(originalQuery);

  const commune = parsed.neighborhood || parsed.commune || "";
  const nearby = getNearbyCommunes(commune);
  const nearbyText = nearby.length > 0
    ? `Search specifically in these nearby communes: ${nearby.join(", ")}.`
    : "Search in nearby communes.";

  const effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;
  const modeInstruction = effectiveMode === "rent"
    ? "Focus on rental listings."
    : "Focus on properties for sale.";

  let expandedPrompt = `Based on this original search: "${enrichedQuery}"

Find ADDITIONAL properties in the area. ${nearbyText} ${modeInstruction}`;

  if (preferenceHints) {
    expandedPrompt += `\n\nUser preferences: ${preferenceHints}`;
  }

  // @ts-expect-error -- Perplexity-specific params not in OpenAI types
  const response = await client.chat.completions.create({
    model: "sonar",
    ...buildApiOptions(domains),
    messages: [
      { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
      { role: "user", content: expandedPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  const searchResults = extractSearchResults(response);

  try {
    const parsed_response = JSON.parse(content);
    return {
      searchResults: searchResults.map((sr) => ({
        url: sr.url,
        title: sr.title,
        snippet: sr.snippet,
      })),
      summary: parsed_response.summary || "",
      suggestedFollowUps: Array.isArray(parsed_response.suggestedFollowUps) ? parsed_response.suggestedFollowUps : [],
      marketContext: parsed_response.marketContext || "",
    };
  } catch {
    return {
      searchResults: searchResults.map((sr) => ({
        url: sr.url,
        title: sr.title,
        snippet: sr.snippet,
      })),
      summary: "",
      suggestedFollowUps: [],
      marketContext: "",
    };
  }
}

export async function searchWithContext(
  query: string,
  previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<DiscoveryResult> {
  const client = getClient();
  const { enrichedQuery, domains, parsed } = await analyzeQuery(query);

  const effectiveMode = parsed.transactionType !== "any" ? parsed.transactionType : mode;
  const modeInstruction = effectiveMode === "rent"
    ? "Focus on rental listings."
    : "Focus on properties for sale.";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${DISCOVERY_SYSTEM_PROMPT}\n\n${modeInstruction}\n\nThis is a follow-up query. Use conversation history for context.` },
  ];

  for (const turn of previousTurns) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: `Search Luxembourg real estate portals for: ${enrichedQuery}. Provide a summary of what you found.` });

  // @ts-expect-error -- Perplexity-specific params not in OpenAI types
  const response = await client.chat.completions.create({
    model: "sonar",
    ...buildApiOptions(domains),
    messages,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const searchResults = extractSearchResults(response);

  try {
    const parsed_response = JSON.parse(content);
    return {
      searchResults: searchResults.map((sr) => ({
        url: sr.url,
        title: sr.title,
        snippet: sr.snippet,
      })),
      summary: parsed_response.summary || "",
      suggestedFollowUps: Array.isArray(parsed_response.suggestedFollowUps) ? parsed_response.suggestedFollowUps : [],
      marketContext: parsed_response.marketContext || "",
    };
  } catch {
    return {
      searchResults: searchResults.map((sr) => ({
        url: sr.url,
        title: sr.title,
        snippet: sr.snippet,
      })),
      summary: "",
      suggestedFollowUps: [],
      marketContext: "",
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
  const srList = raw.search_results || [];
  const citations = srList.map((sr: PerplexitySearchResult) => sr.url);
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
