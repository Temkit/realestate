import OpenAI from "openai";
import type { NeighborhoodData } from "./types";

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

// ── Query parsing via Perplexity ─────────────────────────────────────────────

export interface ParsedQuery {
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

export async function parseQuery(rawQuery: string): Promise<ParsedQuery> {
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

export async function analyzeQuery(rawQuery: string): Promise<{ enrichedQuery: string; parsed: ParsedQuery }> {
  const parsed = await parseQuery(rawQuery);

  let enrichedQuery = parsed.cleanedQuery;
  if (!/luxemb/i.test(enrichedQuery)) {
    enrichedQuery += " Luxembourg";
  }

  return { enrichedQuery, parsed };
}

// ── Compare properties ───────────────────────────────────────────────────────

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

// ── Neighborhood analysis ────────────────────────────────────────────────────

interface PerplexitySearchResult {
  url: string;
  title?: string;
  snippet?: string;
}

interface PerplexityRawResponse {
  citations?: string[];
  search_results?: PerplexitySearchResult[];
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
