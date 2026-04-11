"use client";

import { useState, useCallback, useMemo } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { expandedSearchAction } from "@/app/actions";
import { applyFilter, applySort, answerQuestion, selectProperty, describeFilter } from "@/lib/search/client-actions";
import type { FilterParams } from "@/lib/search/intent-classifier";
import type { ConversationMessage } from "@/components/conversation-thread";
import type { Property, SearchResult, ConversationTurn } from "@/lib/types";

export type SortOption = "recommended" | "price-asc" | "price-desc" | "size";
export type SearchMode = "buy" | "rent";

function sortProperties(properties: Property[], sortBy: SortOption): Property[] {
  if (sortBy === "recommended") return properties;
  const sorted = [...properties];
  switch (sortBy) {
    case "price-asc":
      return sorted.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    case "price-desc":
      return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    case "size":
      return sorted.sort((a, b) => (b.sqft || 0) - (a.sqft || 0));
    default:
      return sorted;
  }
}

export function usePropertySearch() {
  // Core state
  const [results, setResults] = useState<SearchResult | null>(null);
  const [expandedResults, setExpandedResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpandedLoading, setIsExpandedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  // Streaming state
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Conversation state
  const [aiMessages, setAiMessages] = useState<ConversationMessage[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterParams[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [lastAiSuggestion, setLastAiSuggestion] = useState<string | null>(null);

  // UI state
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("buy");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [marketContext, setMarketContext] = useState<string>("");
  const [filteredPrimary, setFilteredPrimary] = useState<Property[]>([]);

  const { favorites, addFavorite, removeFavorite, isFavorite, clearFavorites } = useFavorites();
  const { recordClick, recordFavorite, getPreferenceHints } = useUserPreferences();

  const addMessage = useCallback((role: "user" | "ai", content: string) => {
    setAiMessages((prev) => [...prev, { role, content }]);
  }, []);

  // ── Stream search via SSE ───────────────────────────────────────────────

  const streamSearch = useCallback(async (query: string, mode: SearchMode, options?: { merge?: boolean }) => {
    setIsLoading(true);
    setError(null);
    setStatusMessage("Starting search...");
    if (!options?.merge) {
      setResults(null);
      setAllProperties([]);
      setActiveFilters([]);
      setFilteredPrimary([]);
    }
    setExpandedResults(null);
    setSortBy("recommended");

    try {
      const params = new URLSearchParams({ q: query, mode });
      const resp = await fetch(`/api/search/stream?${params}`);
      if (!resp.ok || !resp.body) throw new Error("Search failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "status":
                setStatusMessage(event.data as string);
                break;
              case "properties":
                if (options?.merge) {
                  // Merge with existing, dedup by id
                  setAllProperties((prev) => {
                    const existing = new Set(prev.map((p) => p.listingUrl || p.id));
                    const newProps = (event.data as Property[]).filter(
                      (p) => !existing.has(p.listingUrl || p.id)
                    );
                    return [...prev, ...newProps];
                  });
                  setResults((prev) => {
                    const prevProps = prev?.properties || [];
                    const existing = new Set(prevProps.map((p) => p.listingUrl || p.id));
                    const newProps = (event.data as Property[]).filter(
                      (p) => !existing.has(p.listingUrl || p.id)
                    );
                    return { ...(prev || { summary: "", citations: [] }), properties: [...prevProps, ...newProps] };
                  });
                } else {
                  const props = event.data as Property[];
                  setResults((prev) => ({ ...(prev || { summary: "", citations: [] }), properties: props }));
                  setAllProperties(props);
                }
                break;
              case "analytics":
                setResults((prev) => prev ? { ...prev, marketAnalytics: event.data } : prev);
                break;
              case "enrichment": {
                const e = event.data as { summary: string; marketContext: string; suggestedFollowUps: string[] };
                setSuggestedChips(e.suggestedFollowUps || []);
                setMarketContext(e.marketContext || "");
                setResults((prev) => prev ? { ...prev, summary: e.summary, marketContext: e.marketContext, suggestedFollowUps: e.suggestedFollowUps } : prev);
                if (e.summary) addMessage("ai", e.summary);
                break;
              }
              case "done": {
                const result = event.data as SearchResult;
                if (options?.merge) {
                  setResults((prev) => {
                    const prevProps = prev?.properties || [];
                    const existing = new Set(prevProps.map((p) => p.listingUrl || p.id));
                    const newProps = result.properties.filter((p) => !existing.has(p.listingUrl || p.id));
                    const merged = [...prevProps, ...newProps];
                    return { ...result, properties: merged };
                  });
                  setAllProperties((prev) => {
                    const existing = new Set(prev.map((p) => p.listingUrl || p.id));
                    const newProps = result.properties.filter((p) => !existing.has(p.listingUrl || p.id));
                    return [...prev, ...newProps];
                  });
                  addMessage("ai", `+${result.properties.length} résultats ajoutés.`);
                } else {
                  setResults(result);
                  setAllProperties(result.properties);
                }
                setStatusMessage("");
                break;
              }
              case "error":
                setError((event.data as { message: string }).message);
                setStatusMessage("");
                break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  }, [addMessage]);

  // ── Conversational refine ───────────────────────────────────────────────

  const handleRefine = useCallback(async (message: string) => {
    addMessage("user", message);
    setIsClassifying(true);
    setError(null);

    try {
      // Classify intent
      const resp = await fetch("/api/search/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationHistory: aiMessages.slice(-8).map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })),
          currentPropertyCount: allProperties.length,
          currentFilters: activeFilters.map((f) => describeFilter(f)),
          lastAiSuggestion,
          searchMode,
          originalQuery: lastQuery,
        }),
      });

      const classification = await resp.json();
      setIsClassifying(false);

      switch (classification.intent) {
        case "filter": {
          const filtered = applyFilter(allProperties, classification.params);
          setResults((prev) => prev ? { ...prev, properties: filtered } : prev);
          setActiveFilters((prev) => [...prev, classification.params]);
          const response = classification.aiResponse || `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} après filtre.`;
          addMessage("ai", response);
          // Suggest removing filter or expanding
          if (filtered.length < 3) {
            setLastAiSuggestion(`Chercher dans d'autres communes ?`);
            setSuggestedChips(["Voir tout", "Chercher plus loin", "Enlever le filtre"]);
          }
          break;
        }

        case "sort": {
          const sorted = applySort(allProperties.length > 0 ? allProperties : (results?.properties || []), classification.params);
          setResults((prev) => prev ? { ...prev, properties: sorted } : prev);
          addMessage("ai", classification.aiResponse || "Résultats triés.");
          break;
        }

        case "expand": {
          const query = classification.expandQuery || message;
          addMessage("ai", classification.aiResponse || "Recherche en cours...");
          setLastQuery(query);
          await streamSearch(query, searchMode, { merge: true });
          break;
        }

        case "compare": {
          const indices = classification.params?.indices || [0, 1];
          setShowCompare(true);
          addMessage("ai", classification.aiResponse || "Comparaison ouverte.");
          void indices;
          break;
        }

        case "detail": {
          const prop = selectProperty(
            results?.properties || [],
            classification.params
          );
          if (prop) {
            setSelectedProperty(prop);
            addMessage("ai", classification.aiResponse || `Détails de ${prop.address}.`);
          } else {
            addMessage("ai", "Propriété non trouvée.");
          }
          break;
        }

        case "question": {
          const answer = answerQuestion(
            allProperties,
            results?.marketAnalytics || null,
            classification.params
          );
          addMessage("ai", answer);
          break;
        }

        default: {
          // Unknown intent → full search
          await streamSearch(message, searchMode);
          break;
        }
      }
    } catch {
      setIsClassifying(false);
      // Fallback: run as full search
      await streamSearch(message, searchMode);
    }
  }, [aiMessages, allProperties, activeFilters, lastAiSuggestion, searchMode, lastQuery, results, addMessage, streamSearch]);

  // ── Initial search ──────────────────────────────────────────────────────

  const handleSearch = useCallback(async (query: string) => {
    setLastQuery(query);
    setAiMessages([{ role: "user", content: query }]);
    setConversationTurns([{ role: "user", content: query }]);
    setActiveFilters([]);
    setLastAiSuggestion(null);
    await streamSearch(query, searchMode);
  }, [searchMode, streamSearch]);

  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    if (lastQuery) {
      setAiMessages([{ role: "user", content: lastQuery }]);
      streamSearch(lastQuery, mode);
    }
  }, [lastQuery, streamSearch]);

  const resetConversation = useCallback(() => {
    setResults(null);
    setExpandedResults(null);
    setError(null);
    setLastQuery("");
    setConversationTurns([]);
    setAiMessages([]);
    setSuggestedChips([]);
    setMarketContext("");
    setStatusMessage("");
    setAllProperties([]);
    setActiveFilters([]);
    setLastAiSuggestion(null);
    setFilteredPrimary([]);
  }, []);

  // ── Expanded search ─────────────────────────────────────────────────────

  const loadExpanded = useCallback(async () => {
    if (!lastQuery || isExpandedLoading || expandedResults) return;
    setIsExpandedLoading(true);
    try {
      const primaryUrls = results?.properties?.flatMap((p) => p.listingUrls || (p.listingUrl ? [p.listingUrl] : [])) || [];
      const data = await expandedSearchAction(lastQuery, getPreferenceHints(), searchMode, primaryUrls);
      setExpandedResults(data);
    } catch {
      setExpandedResults(null);
    } finally {
      setIsExpandedLoading(false);
    }
  }, [lastQuery, isExpandedLoading, expandedResults, getPreferenceHints, results, searchMode]);

  // ── Property interactions ───────────────────────────────────────────────

  const handlePropertyClick = useCallback((property: Property) => {
    recordClick(property);
    setSelectedProperty(property);
  }, [recordClick]);

  const toggleFavorite = useCallback((property: Property): "added" | "removed" => {
    if (isFavorite(property.id)) {
      removeFavorite(property.id);
      return "removed";
    } else {
      addFavorite(property);
      recordFavorite(property);
      return "added";
    }
  }, [isFavorite, removeFavorite, addFavorite, recordFavorite]);

  // ── Computed values ─────────────────────────────────────────────────────

  const primaryIds = new Set(results?.properties.map((p) => p.id) || []);
  const primaryAddresses = new Set(
    results?.properties.map((p) => (p.address || "").toLowerCase().trim()) || []
  );
  const filteredExpanded = expandedResults?.properties.filter(
    (p) => !primaryIds.has(p.id) && !primaryAddresses.has((p.address || "").toLowerCase().trim())
  ) || [];

  const sortedPrimary = useMemo(
    () => (results ? sortProperties(results.properties, sortBy) : []),
    [results, sortBy]
  );
  const sortedExpanded = useMemo(
    () => sortProperties(filteredExpanded, sortBy),
    [filteredExpanded, sortBy]
  );

  const displayPrimary = filteredPrimary.length > 0 ? filteredPrimary : sortedPrimary;
  const displayExpanded = sortedExpanded;

  return {
    results,
    expandedResults,
    isLoading,
    isExpandedLoading,
    error,
    lastQuery,
    selectedProperty,
    showCompare,
    showFavorites,
    sortedPrimary,
    sortedExpanded,
    displayPrimary,
    displayExpanded,
    filteredExpanded: sortedExpanded,
    statusMessage,
    aiMessages,
    isClassifying,

    conversationTurns,
    searchMode,
    sortBy,
    suggestedChips,
    marketContext,

    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,

    handleSearch,
    handleRefine,
    loadExpanded,
    resetConversation,
    handlePropertyClick,
    toggleFavorite,
    setSelectedProperty,
    setShowCompare,
    setShowFavorites,
    handleModeChange,
    setSortBy,
    setFilteredPrimary,
  };
}
