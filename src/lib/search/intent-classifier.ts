/**
 * Intent classifier — routes user messages to the cheapest handler.
 * Uses Gemini to classify: filter, sort, expand, compare, detail, question.
 * ~200ms per call, ~$0.0001 cost.
 */

export type Intent = "filter" | "sort" | "expand" | "compare" | "detail" | "question";

export interface FilterParams {
  intent: "filter";
  field?: "price" | "sqft" | "bedrooms" | "bathrooms" | "pricePerSqm";
  operator?: "min" | "max" | "eq" | "gt" | "lt";
  value?: number;
  excludeTypes?: string[];
  sourceFilter?: string;
}

export interface SortParams {
  intent: "sort";
  field: "price" | "sqft" | "bedrooms" | "pricePerSqm";
  direction: "asc" | "desc";
}

export interface ExpandParams {
  intent: "expand";
  query: string;
}

export interface CompareParams {
  intent: "compare";
  indices: number[];
}

export interface DetailParams {
  intent: "detail";
  index?: number;
  identifier?: string;
}

export interface QuestionParams {
  intent: "question";
  questionType: "count" | "cheapest" | "expensive" | "average" | "yield" | "cost" | "general";
}

export type IntentParams =
  | FilterParams
  | SortParams
  | ExpandParams
  | CompareParams
  | DetailParams
  | QuestionParams;

export interface ClassificationResult {
  intent: Intent;
  confidence: number;
  params: IntentParams;
  aiResponse: string;
  expandQuery?: string;
}

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

export async function classifyIntent(
  message: string,
  conversationHistory: { role: string; content: string }[],
  context: {
    propertyCount: number;
    activeFilters: string[];
    lastAiSuggestion: string | null;
    searchMode: "buy" | "rent";
    originalQuery: string;
  }
): Promise<ClassificationResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return fallbackExpand(message, context);
  }

  const historyText = conversationHistory
    .slice(-6)
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  const prompt = `You classify user messages for a Luxembourg real estate search app. Users speak French, English, German, or mix all three.

Current state:
- ${context.propertyCount} properties displayed
- Active filters: ${context.activeFilters.join(", ") || "none"}
- Mode: ${context.searchMode}
- Original search: "${context.originalQuery}"
- Last AI suggestion: "${context.lastAiSuggestion || "none"}"

Recent conversation:
${historyText}

New message: "${message}"

Classify into ONE intent:
- "filter": narrow existing results (price limit, min size, rooms, exclude type, only specific portal)
- "sort": reorder results (by price, size, €/m², rooms)
- "expand": need NEW data (new location, new type, "more results", "oui/yes" to a search suggestion)
- "compare": compare specific properties
- "detail": focus on one property (more info, where is it)
- "question": answer from existing data (counts, averages, cheapest, yield)

Rules:
- "oui/yes/ja" after a search suggestion → expand with that suggested query
- "non/no/nein" → filter with no change, just acknowledge
- "plus grand/bigger" without threshold → sort by size desc
- "maximum X€/moins de X€" → filter max price
- "trie par/sort by" → sort
- "cherche aussi/et à/search also" → expand
- "compare" → compare
- "détails/plus d'info/c'est où" → detail
- "combien/prix moyen/le moins cher/how many" → question
- If uncertain → expand (safest)

Return JSON only:
{"intent":"...","confidence":0.0-1.0,"params":{...},"aiResponse":"short 1-sentence response in same language as user","expandQuery":"search query if expand, else null"}

For filter params: {"intent":"filter","field":"price|sqft|bedrooms","operator":"min|max|eq","value":number,"excludeTypes":["studio"]}
For sort params: {"intent":"sort","field":"price|sqft|pricePerSqm","direction":"asc|desc"}
For expand params: {"intent":"expand","query":"the search query"}
For compare: {"intent":"compare","indices":[0,1]}
For detail: {"intent":"detail","index":0}
For question: {"intent":"question","questionType":"count|cheapest|average"}`;

  try {
    const resp = await fetch(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!resp.ok) return fallbackExpand(message, context);

    const data = await resp.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);

    const intent = (parsed.intent || "expand") as Intent;
    const confidence = parsed.confidence || 0.5;

    // If low confidence, default to expand
    if (confidence < 0.7 && intent !== "expand") {
      return fallbackExpand(message, context);
    }

    return {
      intent,
      confidence,
      params: { intent, ...parsed.params } as IntentParams,
      aiResponse: parsed.aiResponse || "",
      expandQuery: parsed.expandQuery || undefined,
    };
  } catch {
    return fallbackExpand(message, context);
  }
}

function fallbackExpand(
  message: string,
  context: { originalQuery: string; searchMode: string }
): ClassificationResult {
  return {
    intent: "expand",
    confidence: 0.5,
    params: { intent: "expand", query: message },
    aiResponse: "",
    expandQuery: message,
  };
}
