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

// ── Compare properties (needs web search — stays on Perplexity) ─────────────

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
