"use client";

import { useState, useCallback } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { searchAction, expandedSearchAction } from "@/app/actions";
import {
  applyFilter,
  applySort,
  answerQuestion,
  selectProperty,
  describeFilter,
} from "@/lib/search/client-actions";
import type { FilterParams } from "@/lib/search/intent-classifier";
import type { ConversationTurn } from "@/components/conversation-thread";
import type { Property, SearchResult } from "@/lib/types";

export type SortOption = "recommended" | "price-asc" | "price-desc" | "size";
export type SearchMode = "buy" | "rent";

export function usePropertySearch() {
  // ── Conversation turns (the core state) ─────────────────────────────
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  // ── Search state ────────────────────────────────────────────────────
  const [lastQuery, setLastQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("buy");
  const [isLoading, setIsLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── All accumulated properties (across all turns) ───────────────────
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [allResults, setAllResults] = useState<SearchResult | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterParams[]>([]);
  const [lastAiSuggestion, setLastAiSuggestion] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  // ── Expanded search ─────────────────────────────────────────────────
  const [expandedResults, setExpandedResults] = useState<SearchResult | null>(null);
  const [isExpandedLoading, setIsExpandedLoading] = useState(false);

  const { favorites, addFavorite, removeFavorite, isFavorite, clearFavorites } = useFavorites();
  const { recordClick, recordFavorite, getPreferenceHints } = useUserPreferences();

  // ── Helper: update the current (last) turn ──────────────────────────
  const updateLastTurn = useCallback((update: Partial<ConversationTurn>) => {
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const last = { ...prev[prev.length - 1], ...update };
      return [...prev.slice(0, -1), last];
    });
  }, []);

  // ── SSE streaming search ────────────────────────────────────────────
  const streamSearch = useCallback(
    async (query: string, mode: SearchMode, options?: { merge?: boolean }) => {
      setIsLoading(true);
      setError(null);

      // Create a new turn
      const newTurn: ConversationTurn = {
        userMessage: query,
        isStreaming: true,
        statusMessage: "Starting search...",
      };
      setTurns((prev) => [...prev, newTurn]);

      if (!options?.merge) {
        setAllProperties([]);
        setActiveFilters([]);
        setExpandedResults(null);
      }

      try {
        const params = new URLSearchParams({ q: query, mode });
        const resp = await fetch(`/api/search/stream?${params}`);

        if (!resp.ok || !resp.body) {
          // Fallback to server action
          updateLastTurn({ statusMessage: "Searching..." });
          const result = await searchAction(query, mode);
          setAllResults(result);
          const props = result.properties;
          if (options?.merge) {
            setAllProperties((prev) => {
              const ids = new Set(prev.map((p) => p.listingUrl || p.id));
              return [...prev, ...props.filter((p) => !ids.has(p.listingUrl || p.id))];
            });
          } else {
            setAllProperties(props);
          }
          updateLastTurn({
            isStreaming: false,
            statusMessage: undefined,
            aiMessage: result.summary || `${props.length} results found.`,
            properties: props,
            analytics: result.marketAnalytics,
            chips: result.suggestedFollowUps,
          });
          setIsLoading(false);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentProps: Property[] = [];

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
                  updateLastTurn({ statusMessage: event.data as string });
                  break;

                case "properties": {
                  currentProps = event.data as Property[];
                  if (options?.merge) {
                    setAllProperties((prev) => {
                      const ids = new Set(prev.map((p) => p.listingUrl || p.id));
                      return [...prev, ...currentProps.filter((p) => !ids.has(p.listingUrl || p.id))];
                    });
                  } else {
                    setAllProperties(currentProps);
                  }
                  updateLastTurn({ properties: currentProps });
                  break;
                }

                case "analytics":
                  updateLastTurn({ analytics: event.data });
                  break;

                case "enrichment": {
                  const e = event.data as { summary: string; suggestedFollowUps: string[] };
                  updateLastTurn({
                    aiMessage: e.summary,
                    chips: e.suggestedFollowUps,
                  });
                  break;
                }

                case "done": {
                  const result = event.data as SearchResult;
                  setAllResults(result);
                  const props = result.properties;
                  if (options?.merge) {
                    setAllProperties((prev) => {
                      const ids = new Set(prev.map((p) => p.listingUrl || p.id));
                      return [...prev, ...props.filter((p) => !ids.has(p.listingUrl || p.id))];
                    });
                  } else {
                    setAllProperties(props);
                  }
                  updateLastTurn({
                    isStreaming: false,
                    statusMessage: undefined,
                    properties: props,
                    analytics: result.marketAnalytics,
                    aiMessage: result.summary || `${props.length} results found.`,
                    chips: result.suggestedFollowUps,
                  });
                  break;
                }

                case "error":
                  setError((event.data as { message: string }).message);
                  updateLastTurn({ isStreaming: false, statusMessage: undefined });
                  break;
              }
            } catch { /* skip malformed */ }
          }
        }

        // If stream ended without a "done" event, finalize
        updateLastTurn({ isStreaming: false, statusMessage: undefined });
      } catch {
        // Fallback to server action on any stream failure
        try {
          updateLastTurn({ statusMessage: "Retrying..." });
          const result = await searchAction(query, mode);
          setAllResults(result);
          setAllProperties(options?.merge
            ? [...allProperties, ...result.properties]
            : result.properties
          );
          updateLastTurn({
            isStreaming: false,
            statusMessage: undefined,
            aiMessage: result.summary || `${result.properties.length} results found.`,
            properties: result.properties,
            analytics: result.marketAnalytics,
            chips: result.suggestedFollowUps,
          });
        } catch {
          setError("Search failed. Please try again.");
          updateLastTurn({ isStreaming: false, statusMessage: undefined });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [updateLastTurn, allProperties]
  );

  // ── Initial search ──────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (query: string) => {
      setLastQuery(query);
      setTurns([]);
      setAllProperties([]);
      setActiveFilters([]);
      setLastAiSuggestion(null);
      setExpandedResults(null);
      setAllResults(null);
      await streamSearch(query, searchMode);
    },
    [searchMode, streamSearch]
  );

  // ── Conversational refine ───────────────────────────────────────────
  const handleRefine = useCallback(
    async (message: string) => {
      setIsClassifying(true);
      setError(null);

      try {
        const resp = await fetch("/api/search/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            conversationHistory: turns.slice(-4).flatMap((t) => [
              { role: "user", content: t.userMessage },
              ...(t.aiMessage ? [{ role: "assistant", content: t.aiMessage }] : []),
            ]),
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
            const source = allProperties.length > 0 ? allProperties : [];
            const filtered = applyFilter(source, classification.params);
            if (classification.params) {
              setActiveFilters((prev) => [...prev, classification.params]);
            }
            const msg = classification.aiResponse || `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}.`;
            setTurns((prev) => [...prev, {
              userMessage: message,
              aiMessage: msg,
              properties: filtered,
            }]);
            if (filtered.length < 3 && source.length > filtered.length) {
              setLastAiSuggestion("Chercher dans d'autres communes ?");
              setTurns((prev) => {
                const last = prev[prev.length - 1];
                return [...prev.slice(0, -1), { ...last, chips: ["Voir tout", "Chercher plus loin"] }];
              });
            }
            break;
          }

          case "sort": {
            const sorted = applySort(allProperties, classification.params);
            setTurns((prev) => [...prev, {
              userMessage: message,
              aiMessage: classification.aiResponse || "Résultats triés.",
              properties: sorted,
            }]);
            break;
          }

          case "expand": {
            const query = classification.expandQuery || message;
            setLastQuery(query);
            // The turn is created inside streamSearch
            setTurns((prev) => [...prev]); // force re-render
            await streamSearch(query, searchMode, { merge: true });
            // Update the last turn's user message
            setTurns((prev) => {
              const last = prev[prev.length - 1];
              return [...prev.slice(0, -1), { ...last, userMessage: message }];
            });
            break;
          }

          case "compare": {
            setShowCompare(true);
            setTurns((prev) => [...prev, {
              userMessage: message,
              aiMessage: classification.aiResponse || "Comparaison ouverte.",
            }]);
            break;
          }

          case "detail": {
            const prop = selectProperty(allProperties, classification.params);
            if (prop) {
              setSelectedProperty(prop);
              setTurns((prev) => [...prev, {
                userMessage: message,
                aiMessage: classification.aiResponse || `Détails de ${prop.address || prop.city}.`,
              }]);
            } else {
              setTurns((prev) => [...prev, {
                userMessage: message,
                aiMessage: "Propriété non trouvée.",
              }]);
            }
            break;
          }

          case "question": {
            const answer = answerQuestion(allProperties, allResults?.marketAnalytics || null, classification.params);
            setTurns((prev) => [...prev, {
              userMessage: message,
              aiMessage: answer,
            }]);
            break;
          }

          default:
            await streamSearch(message, searchMode);
            break;
        }
      } catch {
        setIsClassifying(false);
        // Fallback: run as new search
        await streamSearch(message, searchMode);
      }
    },
    [turns, allProperties, activeFilters, lastAiSuggestion, searchMode, lastQuery, allResults, streamSearch]
  );

  // ── Mode change ─────────────────────────────────────────────────────
  const handleModeChange = useCallback(
    (mode: SearchMode) => {
      setSearchMode(mode);
      if (lastQuery) {
        setTurns([]);
        streamSearch(lastQuery, mode);
      }
    },
    [lastQuery, streamSearch]
  );

  // ── Reset ───────────────────────────────────────────────────────────
  const resetConversation = useCallback(() => {
    setTurns([]);
    setAllProperties([]);
    setAllResults(null);
    setActiveFilters([]);
    setLastAiSuggestion(null);
    setExpandedResults(null);
    setError(null);
    setLastQuery("");
  }, []);

  // ── Expanded search (scroll-triggered) ──────────────────────────────
  const loadExpanded = useCallback(async () => {
    if (!lastQuery || isExpandedLoading || expandedResults) return;
    setIsExpandedLoading(true);
    try {
      const primaryUrls = allProperties.flatMap(
        (p) => p.listingUrls || (p.listingUrl ? [p.listingUrl] : [])
      );
      const data = await expandedSearchAction(lastQuery, getPreferenceHints(), searchMode, primaryUrls);
      setExpandedResults(data);
    } catch {
      setExpandedResults(null);
    } finally {
      setIsExpandedLoading(false);
    }
  }, [lastQuery, isExpandedLoading, expandedResults, allProperties, getPreferenceHints, searchMode]);

  // ── Property interactions ───────────────────────────────────────────
  const handlePropertyClick = useCallback(
    (property: Property) => { recordClick(property); setSelectedProperty(property); },
    [recordClick]
  );

  const toggleFavorite = useCallback(
    (property: Property): "added" | "removed" => {
      if (isFavorite(property.id)) { removeFavorite(property.id); return "removed"; }
      addFavorite(property); recordFavorite(property); return "added";
    },
    [isFavorite, removeFavorite, addFavorite, recordFavorite]
  );

  return {
    turns,
    lastQuery,
    searchMode,
    isLoading,
    isClassifying,
    error,
    selectedProperty,
    showCompare,
    showFavorites,
    expandedResults,
    isExpandedLoading,
    allProperties,

    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,

    handleSearch,
    handleRefine,
    handleModeChange,
    resetConversation,
    loadExpanded,
    handlePropertyClick,
    toggleFavorite,
    setSelectedProperty,
    setShowCompare,
    setShowFavorites,
  };
}
