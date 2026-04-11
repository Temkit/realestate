"use client";

import { useState, useCallback, useMemo } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { searchAction, expandedSearchAction, refineSearchAction } from "@/app/actions";
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
  const [results, setResults] = useState<SearchResult | null>(null);
  const [expandedResults, setExpandedResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpandedLoading, setIsExpandedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  // New AI-native state
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("buy");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [marketContext, setMarketContext] = useState<string>("");

  const { favorites, addFavorite, removeFavorite, isFavorite, clearFavorites } = useFavorites();
  const { recordClick, recordFavorite, getPreferenceHints } = useUserPreferences();

  // When mode changes and we have results, re-search with the new mode
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    if (lastQuery) {
      // Re-trigger search with new mode (will use the updated searchMode via closure on next render)
      // We need to call searchAction directly with the new mode since setState is async
      setIsLoading(true);
      setExpandedResults(null);
      setSortBy("recommended");
      searchAction(lastQuery, mode).then((data) => {
        setResults(data);
        setSuggestedChips(data.suggestedFollowUps || []);
        setMarketContext(data.marketContext || "");
      }).catch(() => {
        setError("Search failed. Please try again.");
      }).finally(() => {
        setIsLoading(false);
      });
    }
  };

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setIsExpandedLoading(false);
    setError(null);
    setLastQuery(query);
    setExpandedResults(null);
    setSortBy("recommended");

    // Fresh search — reset conversation
    setConversationTurns([{ role: "user", content: query }]);

    try {
      const data = await searchAction(query, searchMode);
      setResults(data);
      setSuggestedChips(data.suggestedFollowUps || []);
      setMarketContext(data.marketContext || "");
      setConversationTurns((prev) => [
        ...prev,
        { role: "assistant", content: data.summary },
      ]);
    } catch {
      setError("Search failed. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
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
  }, [lastQuery, isExpandedLoading, expandedResults, getPreferenceHints]);

  const handleRefine = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setExpandedResults(null);
    setIsExpandedLoading(false);
    setSortBy("recommended");

    const newTurns: ConversationTurn[] = [...conversationTurns, { role: "user", content: query }];
    setConversationTurns(newTurns);
    setLastQuery(query);

    try {
      const data = await refineSearchAction(query, conversationTurns, searchMode);
      setResults(data);
      setSuggestedChips(data.suggestedFollowUps || []);
      setMarketContext(data.marketContext || "");
      setConversationTurns([
        ...newTurns,
        { role: "assistant", content: data.summary },
      ]);
    } catch {
      setError("Refinement failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetConversation = () => {
    setResults(null);
    setExpandedResults(null);
    setConversationTurns([]);
    setSuggestedChips([]);
    setMarketContext("");
    setLastQuery("");
    setSortBy("recommended");
    setError(null);
  };

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
    // Keep filteredExpanded for backward compat
    filteredExpanded: sortedExpanded,

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
  };
}
