"use client";

import Image from "next/image";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { Button } from "@/components/ui/button";
import { Eye, GitCompareArrows, Home } from "lucide-react";
import type { Property } from "@/lib/types";

interface FavoritesBarProps {
  favorites: Property[];
  onOpenCompare: () => void;
  onViewFavorites: () => void;
}

export function FavoritesBar({ favorites, onOpenCompare, onViewFavorites }: FavoritesBarProps) {
  if (favorites.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50
                    bg-background/80 backdrop-blur-xl border-t shadow-lg
                    animate-slide-up">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mini thumbnails */}
          <div className="hidden sm:flex -space-x-2">
            {favorites.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="relative h-9 w-9 rounded-full border-2 border-background overflow-hidden bg-muted"
              >
                {p.imageUrl ? (
                  <Image
                    src={getProxiedImageUrl(p.imageUrl)}
                    alt={p.address}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                    <Home className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
            {favorites.length > 4 && (
              <div className="h-9 w-9 rounded-full border-2 border-background bg-muted
                              flex items-center justify-center">
                <span className="text-[11px] font-medium text-muted-foreground">
                  +{favorites.length - 4}
                </span>
              </div>
            )}
          </div>

          <div>
            <span className="text-sm font-semibold">
              {favorites.length} saved {favorites.length === 1 ? "property" : "properties"}
            </span>
            <div className="hidden sm:flex gap-1.5 mt-1">
              {favorites.slice(0, 3).map((p) => (
                <span
                  key={p.id}
                  className="text-[11px] bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-md truncate max-w-[110px]"
                >
                  {p.city} - €{(p.price / 1000).toFixed(0)}K
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" onClick={onViewFavorites} className="rounded-xl">
            <Eye className="h-4 w-4 mr-1.5 hidden sm:inline" />
            View All
          </Button>
          {favorites.length >= 2 && (
            <Button size="sm" onClick={onOpenCompare} className="rounded-xl">
              <GitCompareArrows className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Compare ({favorites.length})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
