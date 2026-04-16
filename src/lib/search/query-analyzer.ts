/**
 * Query analyzer — uses Claude Haiku to identify what's missing from a search query.
 * ~100ms, ~$0.00003 per call. Only asks what's needed.
 */

export interface QueryAnalysis {
  complete: boolean;
  missing: "type" | "location" | "mode" | null;
  parsed: {
    type: string | null;
    location: string | null;
    mode: "buy" | "rent" | null;
  };
  options: string[];
  summary: string;
}

/**
 * Analyze a query and identify what's missing.
 * Returns immediately if query is complete.
 */
export async function analyzeQueryCompleteness(
  query: string
): Promise<QueryAnalysis> {
  // Quick local check first — if query clearly has all parts, skip API
  const local = localAnalysis(query);
  if (local.complete) return local;

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return local;

    const resp = await fetch(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `Analyze this Luxembourg real estate search query. Identify what's present and what's missing.

Query: "${query}"

Return JSON only:
{
  "type": "apartment|house|office|studio|land|commercial" or null if missing,
  "location": "exact commune/neighborhood name" or null if missing,
  "mode": "buy" or "rent" or null if unclear,
  "summary": "short description of what was understood, in same language as query"
}

Rules:
- "bureau" = office, "appartement" = apartment, "maison" = house
- "louer/location/rent" = rent, "acheter/vente/buy" = buy
- "mondorf" = "Mondorf-les-Bains", "esch" = "Esch-sur-Alzette", "lux/luxembourg" = "Luxembourg"
- If all 3 (type + location + mode) are present, that's complete
- If mode is ambiguous but type and location are clear, mode is missing` }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: "application/json" },
        }),
      }
    );

    if (!resp.ok) return local;

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);

    const hasType = !!parsed.type;
    const hasLocation = !!parsed.location;
    const hasMode = !!parsed.mode;

    if (hasType && hasLocation && hasMode) {
      return {
        complete: true,
        missing: null,
        parsed: {
          type: parsed.type,
          location: parsed.location,
          mode: parsed.mode,
        },
        options: [],
        summary: parsed.summary || query,
      };
    }

    // Determine what to ask
    if (!hasType) {
      return {
        complete: false,
        missing: "type",
        parsed: { type: null, location: parsed.location, mode: parsed.mode },
        options: ["Appartement", "Maison", "Bureau", "Studio"],
        summary: parsed.summary || `À ${parsed.location || "Luxembourg"}`,
      };
    }

    if (!hasLocation) {
      return {
        complete: false,
        missing: "location",
        parsed: { type: parsed.type, location: null, mode: parsed.mode },
        options: ["Luxembourg", "Kirchberg", "Esch-sur-Alzette", "Mondorf-les-Bains"],
        summary: parsed.summary || parsed.type,
      };
    }

    // Missing mode
    return {
      complete: false,
      missing: "mode",
      parsed: { type: parsed.type, location: parsed.location, mode: null },
      options: ["Louer", "Acheter"],
      summary: parsed.summary || `${parsed.type} à ${parsed.location}`,
    };
  } catch {
    return local;
  }
}

// ── Fast local analysis (no API, regex-based) ───────────────────────────────

function localAnalysis(query: string): QueryAnalysis {
  const q = query.toLowerCase().trim();

  // Detect type
  let type: string | null = null;
  if (/bureau|office|cabinet/.test(q)) type = "office";
  else if (/appartement|apartment|appart/.test(q)) type = "apartment";
  else if (/maison|house|villa/.test(q)) type = "house";
  else if (/studio/.test(q)) type = "studio";
  else if (/terrain|land/.test(q)) type = "land";

  // Detect mode
  let mode: "buy" | "rent" | null = null;
  if (/louer|location|rent|mieten|à louer|en location|\/mois/.test(q)) mode = "rent";
  else if (/acheter|achat|vente|buy|kaufen|à vendre/.test(q)) mode = "buy";

  // Detect location (simple: any word that's not type/mode)
  const typeWords = /bureau|office|cabinet|appartement|apartment|appart|maison|house|villa|studio|terrain|land/g;
  const modeWords = /louer|location|rent|mieten|acheter|achat|vente|buy|kaufen/g;
  const cleaned = q.replace(typeWords, "").replace(modeWords, "").replace(/\s+/g, " ").trim();
  const location = cleaned.length > 1 ? cleaned : null;

  const complete = !!type && !!location && !!mode;

  if (complete) {
    return {
      complete: true,
      missing: null,
      parsed: { type, location, mode },
      options: [],
      summary: query,
    };
  }

  if (!type) {
    return {
      complete: false,
      missing: "type",
      parsed: { type, location, mode },
      options: ["Appartement", "Maison", "Bureau", "Studio"],
      summary: location ? `À ${location}` : "Recherche",
    };
  }

  if (!location) {
    return {
      complete: false,
      missing: "location",
      parsed: { type, location, mode },
      options: ["Luxembourg", "Kirchberg", "Esch-sur-Alzette", "Mondorf-les-Bains"],
      summary: type,
    };
  }

  return {
    complete: false,
    missing: "mode",
    parsed: { type, location, mode },
    options: ["Louer", "Acheter"],
    summary: `${type} à ${location}`,
  };
}
