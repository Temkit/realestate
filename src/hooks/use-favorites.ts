"use client";

import { useState, useEffect, useCallback } from "react";
import type { Property } from "@/lib/types";

const STORAGE_KEY = "olu-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Property[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const persist = useCallback((items: Property[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage not available
    }
  }, []);

  const addFavorite = useCallback(
    (property: Property) => {
      setFavorites((prev) => {
        if (prev.some((p) => p.id === property.id)) return prev;
        const next = [...prev, property];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeFavorite = useCallback(
    (propertyId: string) => {
      setFavorites((prev) => {
        const next = prev.filter((p) => p.id !== propertyId);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isFavorite = useCallback(
    (propertyId: string) => {
      return favorites.some((p) => p.id === propertyId);
    },
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    persist([]);
  }, [persist]);

  return { favorites, addFavorite, removeFavorite, isFavorite, clearFavorites };
}
