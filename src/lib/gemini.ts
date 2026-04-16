/**
 * Gemini Flash Lite — used for query parsing and AI enrichment.
 * Replaces Perplexity for non-search tasks (no web search needed).
 */

export interface ParsedQuery {
  commune: string | null;
  neighborhood: string | null;
  propertyType: string | null;
  transactionType: "buy" | "rent" | "any";
  cleanedQuery: string;
}

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

async function geminiJSON<T>(prompt: string, maxTokens: number = 300): Promise<T> {
  const key = getGeminiKey();
  const resp = await fetch(
    `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.1-flash-lite-preview:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Gemini API error: ${resp.status}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text) as T;
}

/**
 * Parse a user's search query to extract commune, type, mode, and cleaned query.
 * Handles French, English, German, misspellings, abbreviations.
 */
export async function parseQuery(rawQuery: string): Promise<ParsedQuery> {
  try {
    return await geminiJSON<ParsedQuery>(
      `Extract from this Luxembourg real estate search query:
- commune: the FULL official Luxembourg commune name, properly spelled. Examples: "Mondorf-les-Bains" (not "Mondorf"), "Esch-sur-Alzette" (not "Esch"), "Luxembourg" for the city. null if not identifiable.
- neighborhood: neighborhood within Luxembourg City (Kirchberg, Bonnevoie, Gasperich, Belair, Limpertsberg, etc.) if applicable. null otherwise.
- propertyType: apartment, house, office, studio, land, commercial, or null
- transactionType: buy, rent, or any if unclear
- cleanedQuery: rewrite with the FULL commune name for Luxembourg real estate portals. Example: "bureau mondorf" → "bureau Mondorf-les-Bains Luxembourg"

Query: "${rawQuery}"

Return JSON only.`,
      200
    );
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
 * Analyze a raw query: parse it, build enriched query string.
 */
export async function analyzeQuery(
  rawQuery: string
): Promise<{ enrichedQuery: string; parsed: ParsedQuery }> {
  const parsed = await parseQuery(rawQuery);
  let enrichedQuery = parsed.cleanedQuery;
  if (!/luxemb/i.test(enrichedQuery)) {
    enrichedQuery += " Luxembourg";
  }
  return { enrichedQuery, parsed };
}
