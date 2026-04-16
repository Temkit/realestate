/**
 * AI enrichment — Gemini generates summary, market context, follow-ups,
 * and per-property insights. Called once per search after all data is merged.
 */

import type { Property } from "@/lib/types";

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

export interface AIEnrichment {
  summary: string;
  marketContext: string;
  suggestedFollowUps: string[];
}

/**
 * Generate AI-powered summary, market context, and per-property insights.
 * Mutates properties in place (appends to aiInsight field).
 * Returns fallback data if Gemini is unavailable.
 */
export async function enrichWithAI(
  properties: Property[],
  userQuery: string,
  mode: "buy" | "rent"
): Promise<AIEnrichment> {
  const fallback: AIEnrichment = {
    summary:
      properties.length > 0
        ? `Found ${properties.length} ${mode === "rent" ? "rental" : ""} properties.`
        : "No properties found. Try broadening your search.",
    marketContext: "",
    suggestedFollowUps: [],
  };

  if (properties.length === 0) return fallback;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return fallback;

  try {
    const propList = properties
      .slice(0, 12)
      .map(
        (p, i) =>
          `${i + 1}. ${p.address}, ${p.city} — €${p.price.toLocaleString()}${mode === "rent" ? "/mo" : ""}, ${p.sqft}m², ${p.propertyType} [${p.sources?.join(", ") || p.source}]${p.aiInsight ? ` (${p.aiInsight})` : ""}`
      )
      .join("\n");

    const resp = await fetch(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Enrich Luxembourg real estate results. Return JSON:\n{"summary":"1-2 sentences: count, price range, best value. Same language as user query.","marketContext":"One short market insight, max 15 words.","suggestedFollowUps":["3-4 follow-up queries"],"insights":{"1":"short insight","2":"..."}}\n\nFor insights: location advantages, value context. Max 8 words each.\n\nUser: "${userQuery}" (${mode})\n\n${propList}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!resp.ok) return fallback;
    const data = await resp.json();
    const parsed = JSON.parse(
      data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    );

    // Merge AI insights with existing data-driven ones
    if (parsed.insights && typeof parsed.insights === "object") {
      for (const [key, insight] of Object.entries(parsed.insights)) {
        const idx = parseInt(key) - 1;
        if (
          idx >= 0 &&
          idx < properties.length &&
          typeof insight === "string" &&
          insight.trim()
        ) {
          const p = properties[idx];
          if (p.aiInsight) {
            const existing = p.aiInsight.split(" · ");
            if (existing.length < 3)
              p.aiInsight = [...existing, insight.trim()].join(" · ");
          } else {
            p.aiInsight = insight.trim();
          }
        }
      }
    }

    return {
      summary: parsed.summary || fallback.summary,
      marketContext: parsed.marketContext || "",
      suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps)
        ? parsed.suggestedFollowUps
        : [],
    };
  } catch {
    return fallback;
  }
}
