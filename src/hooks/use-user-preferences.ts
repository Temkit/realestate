"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Property } from "@/lib/types";

const STORAGE_KEY = "realestate-user-preferences";

export interface UserPreferences {
  // Learned price range from clicks/favorites
  priceMin: number | null;
  priceMax: number | null;
  // Property types the user gravitates toward
  preferredTypes: Record<string, number>;
  // Features the user seems to like
  preferredFeatures: Record<string, number>;
  // Regions/cities the user explores
  preferredRegions: Record<string, number>;
  // Bedroom preferences
  bedroomCounts: Record<number, number>;
  // Total interactions for weighting
  totalInteractions: number;
}

const EMPTY_PREFS: UserPreferences = {
  priceMin: null,
  priceMax: null,
  preferredTypes: {},
  preferredFeatures: {},
  preferredRegions: {},
  bedroomCounts: {},
  totalInteractions: 0,
};

/**
 * Tracks user behavior (clicks, favorites) to build an implicit preference profile.
 * Used to make the "More results" secondary search smarter over time.
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(EMPTY_PREFS);
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const persist = useCallback((prefs: UserPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage not available
    }
  }, []);

  const recordInteraction = useCallback(
    (property: Property, weight: number = 1) => {
      setPreferences((prev) => {
        const next = { ...prev };
        next.totalInteractions += weight;

        // Update price range (rolling window)
        if (property.price > 0) {
          if (next.priceMin === null || property.price < next.priceMin) {
            next.priceMin = property.price;
          }
          if (next.priceMax === null || property.price > next.priceMax) {
            next.priceMax = property.price;
          }
        }

        // Track property type
        if (property.propertyType && property.propertyType !== "Unknown") {
          next.preferredTypes = { ...prev.preferredTypes };
          next.preferredTypes[property.propertyType] =
            (next.preferredTypes[property.propertyType] || 0) + weight;
        }

        // Track features
        next.preferredFeatures = { ...prev.preferredFeatures };
        for (const feature of property.features) {
          next.preferredFeatures[feature] =
            (next.preferredFeatures[feature] || 0) + weight;
        }

        // Track regions
        const region = [property.city, property.state].filter(Boolean).join(", ");
        if (region) {
          next.preferredRegions = { ...prev.preferredRegions };
          next.preferredRegions[region] =
            (next.preferredRegions[region] || 0) + weight;
        }

        // Track bedroom counts
        if (property.bedrooms > 0) {
          next.bedroomCounts = { ...prev.bedroomCounts };
          next.bedroomCounts[property.bedrooms] =
            (next.bedroomCounts[property.bedrooms] || 0) + weight;
        }

        persist(next);
        return next;
      });
    },
    [persist]
  );

  /** Record a click (lighter signal) */
  const recordClick = useCallback(
    (property: Property) => {
      recordInteraction(property, 1);
    },
    [recordInteraction]
  );

  /** Record a favorite (stronger signal) */
  const recordFavorite = useCallback(
    (property: Property) => {
      recordInteraction(property, 3);
    },
    [recordInteraction]
  );

  /** Build a hint string from learned preferences for the expanded search */
  const getPreferenceHints = useCallback((): string | null => {
    const prefs = prefsRef.current;
    if (prefs.totalInteractions < 2) return null;

    const hints: string[] = [];

    // Top property type
    const topType = getTopEntries(prefs.preferredTypes, 1);
    if (topType.length > 0) {
      hints.push(`property type: ${topType[0]}`);
    }

    // Price range with some flexibility
    if (prefs.priceMin !== null && prefs.priceMax !== null) {
      const margin = (prefs.priceMax - prefs.priceMin) * 0.2 || prefs.priceMin * 0.3;
      const low = Math.max(0, Math.round(prefs.priceMin - margin));
      const high = Math.round(prefs.priceMax + margin);
      hints.push(`price range approximately ${low} to ${high}`);
    }

    // Top features
    const topFeatures = getTopEntries(prefs.preferredFeatures, 3);
    if (topFeatures.length > 0) {
      hints.push(`features like ${topFeatures.join(", ")}`);
    }

    // Bedroom preference
    const topBedrooms = getTopEntries(prefs.bedroomCounts, 1);
    if (topBedrooms.length > 0) {
      hints.push(`around ${topBedrooms[0]} bedrooms`);
    }

    if (hints.length === 0) return null;
    return `The user tends to prefer: ${hints.join("; ")}`;
  }, []);

  const clearPreferences = useCallback(() => {
    setPreferences(EMPTY_PREFS);
    persist(EMPTY_PREFS);
  }, [persist]);

  return {
    preferences,
    recordClick,
    recordFavorite,
    getPreferenceHints,
    clearPreferences,
  };
}

function getTopEntries(record: Record<string | number, number>, n: number): string[] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => String(key));
}
