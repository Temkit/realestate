import { NextRequest } from "next/server";
import { classifyIntent } from "@/lib/search/intent-classifier";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      conversationHistory = [],
      currentPropertyCount = 0,
      currentFilters = [],
      lastAiSuggestion = null,
      searchMode = "buy",
      originalQuery = "",
    } = body;

    if (!message?.trim()) {
      return Response.json({ error: "Empty message" }, { status: 400 });
    }

    const result = await classifyIntent(message, conversationHistory, {
      propertyCount: currentPropertyCount,
      activeFilters: currentFilters,
      lastAiSuggestion,
      searchMode,
      originalQuery,
    });

    return Response.json(result);
  } catch {
    return Response.json(
      {
        intent: "expand",
        confidence: 0.5,
        params: { intent: "expand", query: "" },
        aiResponse: "",
      },
      { status: 200 }
    );
  }
}
