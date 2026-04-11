"use client";

import { useState, useCallback, useMemo } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { expandedSearchAction } from "@/app/actions";
import type { Property, SearchResult, ConversationTurn, MarketAnalytics } from "@/lib/types";

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

  // AI-native state
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("buy");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [marketContext, setMarketContext] = useState<string>("");

  // Keep track of filteredPrimary via callback from FilterBar
  const [filteredPrimary, setFilteredPrimary] = useState<Property[]>([]);

  const { favorites, addFavorite, removeFavorite, isFavorite, clearFavorites } = useFavorites();
  const { recordClick, recordFavorite, getPreferenceHints } = useUserPreferences();

  /** Stream search results via SSE */
  const streamSearch = useCallback(async (query: string, mode: SearchMode) => {
    setIsLoading(true);
    setError(null);
    setStatusMessage("Starting search...");
    setResults(null);
    setExpandedResults(null);
    setFilteredPrimary([]);
    setSortBy("recommended");

    try {
      const params = new URLSearchParams({ q: query, mode });
      const resp = await fetch(`/api/search/stream?${params}`);

      if (!resp.ok || !resp.body) {
        throw new Error("Search failed");
      }

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
                setResults((prev) => ({
                  ...(prev || { summary: "", citations: [] }),
                  properties: event.data as Property[],
                }));
                break;

              case "analytics":
                setResults((prev) => prev ? { ...prev, marketAnalytics: event.data as MarketAnalytics } : prev);
                break;

              case "enrichment": {
                const enrichment = event.data as { summary: string; marketContext: string; suggestedFollowUps: string[] };
                setSuggestedChips(enrichment.suggestedFollowUps || []);
                setMarketContext(enrichment.marketContext || "");
                setResults((prev) => prev ? {
                  ...prev,
                  summary: enrichment.summary,
                  marketContext: enrichment.marketContext,
                  suggestedFollowUps: enrichment.suggestedFollowUps,
                } : prev);
                break;
              }

              case "done":
                setResults(event.data as SearchResult);
                setStatusMessage("");
                break;

              case "error":
                setError((event.data as { message: string }).message);
                setStatusMessage("");
                break;
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  }, []);

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    if (lastQuery) {
      streamSearch(lastQuery, mode);
    }
  };

  const handleSearch = async (query: string) => {
    setLastQuery(query);
    setConversationTurns([{ role: "user", content: query }]);
    await streamSearch(query, searchMode);
  };

  const handleRefine = async (query: string) => {
    setLastQuery(query);
    setExpandedResults(null);
    setConversationTurns((prev) => [...prev, { role: "user", content: query }]);
    await streamSearch(query, searchMode);
  };

  const resetConversation = () => {
    setResults(null);
    setExpandedResults(null);
    setError(null);
    setLastQuery("");
    setConversationTurns([]);
    setSuggestedChips([]);
    setMarketContext("");
    setStatusMessage("");
  };

  /** Load expanded results on demand (triggered by scroll). */
  const loadExpanded = useCallback(async () => {
    if (!lastQuery || isExpandedLoading || expandedResults) return;
    setIsExpandedLoading(true);
    const preferenceHints = getPreferenceHints();
    try {
      const primaryUrls = results?.properties?.flatMap((p) => p.listingUrls || (p.listingUrl ? [p.listingUrl] : [])) || [];
      const data = await expandedSearchAction(lastQuery, preferenceHints, searchMode, primaryUrls);
      setExpandedResults(data);
    } catch {
      setExpandedResults(null);
    } finally {
      setIsExpandedLoading(false);
    }
  }, [lastQuery, isExpandedLoading, expandedResults, getPreferenceHints, results, searchMode]);

  const handlePropertyClick = (property: Property) => {
    recordClick(property);
    setSelectedProperty(property);
  };

  const toggleFavorite = (property: Property): "added" | "removed" => {
    if (isFavorite(property.id)) {
      removeFavorite(property.id);
      return "removed";
    } else {
      addFavorite(property);
      recordFavorite(property);
      return "added";
    }
  };

  const primaryIds = new Set(results?.properties.map((p) => p.id) || []);
  const primaryAddresses = new Set(
    results?.properties.map((p) => (p.address || "").toLowerCase().trim()) || []
  );
  const filteredExpanded =
    expandedResults?.properties.filter(
      (p) => !primaryIds.has(p.id) && !primaryAddresses.has((p.address || "").toLowerCase().trim())
    ) || [];

  // Apply sorting
  const sortedPrimary = useMemo(
    () => (results ? sortProperties(results.properties, sortBy) : []),
    [results, sortBy]
  );
  const sortedExpanded = useMemo(
    () => sortProperties(filteredExpanded, sortBy),
    [filteredExpanded, sortBy]
  );

  // displayPrimary uses filteredPrimary from FilterBar if it has results,
  // otherwise falls back to sortedPrimary (all results, no filter applied)
  const displayPrimary = filteredPrimary.length > 0
    ? filteredPrimary
    : sortedPrimary;
  const displayExpanded = sortedExpanded;

  return {
    // State
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

    // AI-native state
    conversationTurns,
    searchMode,
    sortBy,
    suggestedChips,
    marketContext,

    // Favorites
    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,

    // Actions
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
