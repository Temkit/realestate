"use client";

import { useState, useCallback } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { searchAction, expandedSearchAction, fetchListingImages } from "@/app/actions";
import type { Property, SearchResult } from "@/lib/types";

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

  const { favorites, addFavorite, removeFavorite, isFavorite, clearFavorites } = useFavorites();
  const { recordClick, recordFavorite, getPreferenceHints } = useUserPreferences();

  const enrichWithListingImages = useCallback(
    (
      searchResult: SearchResult,
      setter: (updater: (prev: SearchResult | null) => SearchResult | null) => void
    ) => {
      const needImages = searchResult.properties
        .filter((p) => !p.imageUrl && p.listingUrl)
        .map((p) => ({ id: p.id, url: p.listingUrl! }));

      if (needImages.length === 0) return;

      fetchListingImages(needImages).then((imageMap) => {
        if (Object.keys(imageMap).length === 0) return;
        setter((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            properties: prev.properties.map((p) =>
              imageMap[p.id] ? { ...p, imageUrl: imageMap[p.id] } : p
            ),
          };
        });
      });
    },
    []
  );

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setIsExpandedLoading(true);
    setError(null);
    setLastQuery(query);
    setExpandedResults(null);

    const preferenceHints = getPreferenceHints();

    const primaryPromise = searchAction(query);
    const expandedPromise = expandedSearchAction(query, preferenceHints);

    primaryPromise
      .then((data) => {
        setResults(data);
        enrichWithListingImages(data, setResults);
      })
      .catch(() => {
        setError("Search failed. Please check your API key and try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });

    expandedPromise
      .then((data) => {
        setExpandedResults(data);
        enrichWithListingImages(data, setExpandedResults);
      })
      .catch(() => {
        setExpandedResults(null);
      })
      .finally(() => {
        setIsExpandedLoading(false);
      });
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
    results?.properties.map((p) => p.address.toLowerCase().trim()) || []
  );
  const filteredExpanded =
    expandedResults?.properties.filter(
      (p) => !primaryIds.has(p.id) && !primaryAddresses.has(p.address.toLowerCase().trim())
    ) || [];

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
    filteredExpanded,

    // Favorites
    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,

    // Actions
    handleSearch,
    handlePropertyClick,
    toggleFavorite,
    setSelectedProperty,
    setShowCompare,
    setShowFavorites,
  };
}
