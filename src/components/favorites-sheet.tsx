"use client";

import Image from "next/image";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { formatPrice, formatNumber } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { X, Heart, Home } from "lucide-react";
import type { Property } from "@/lib/types";

interface FavoritesSheetProps {
  favorites: Property[];
  isOpen: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onSelect: (property: Property) => void;
  onClearAll: () => void;
}

export function FavoritesSheet({
  favorites,
  isOpen,
  onClose,
  onRemove,
  onSelect,
  onClearAll,
}: FavoritesSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Saved Properties ({favorites.length})</SheetTitle>
            {favorites.length > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onClearAll}>
                Clear All
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          {favorites.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No saved properties"
              description="Click the heart icon on any listing to save it here."
            />
          ) : (
            favorites.map((property) => (
              <div
                key={property.id}
                className="flex items-start gap-4 p-3.5 rounded-xl border hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => {
                  onClose();
                  onSelect(property);
                }}
              >
                {/* Thumbnail */}
                <div className="relative h-16 w-20 rounded-xl overflow-hidden bg-muted shrink-0">
                  {property.imageUrl ? (
                    <Image
                      src={getProxiedImageUrl(property.imageUrl)}
                      alt={property.address}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                      <Home className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg tabular-nums">
                    {formatPrice(property.price, property.listingMode)}
                  </p>
                  <p className="text-sm truncate mt-0.5">{property.address}</p>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {property.city}, {property.state} {property.zipCode}
                  </p>
                  <p className="text-[0.8125rem] text-muted-foreground mt-1.5">
                    {property.bedrooms} ch &middot; {property.bathrooms} sdb &middot; {formatNumber(property.sqft)} m²
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(property.id);
                  }}
                  aria-label={`Remove ${property.address} from favorites`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
