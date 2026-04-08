"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { formatPrice, formatNumber } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Heart,
  Share2,
  ExternalLink,
  School,
  Footprints,
  Shield,
  Car,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { neighborhoodAction } from "@/app/actions";
import type { Property, NeighborhoodData } from "@/lib/types";

interface PropertyDetailProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const neighborhoodIcons: Record<string, typeof School> = {
  Schools: School,
  Walkability: Footprints,
  Safety: Shield,
  Commute: Car,
  "Median Price": DollarSign,
  Trends: TrendingUp,
};

export function PropertyDetail({
  property,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
}: PropertyDetailProps) {
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [loadingNeighborhood, setLoadingNeighborhood] = useState(false);
  const [neighborhoodError, setNeighborhoodError] = useState<string | null>(null);

  const loadNeighborhood = async () => {
    if (!property || loadingNeighborhood || neighborhood) return;
    setLoadingNeighborhood(true);
    setNeighborhoodError(null);
    try {
      const data = await neighborhoodAction(property.address, property.city, property.state);
      setNeighborhood(data);
    } catch {
      setNeighborhoodError("Failed to load neighborhood data");
    } finally {
      setLoadingNeighborhood(false);
    }
  };

  // Auto-load neighborhood when sheet opens (debounced)
  useEffect(() => {
    if (!isOpen || !property || neighborhood || loadingNeighborhood) return;
    const timer = setTimeout(() => {
      loadNeighborhood();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, property?.id]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setNeighborhood(null);
      setNeighborhoodError(null);
    }
  };

  if (!property) return null;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {/* Image */}
        {property.imageUrl && (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
            <Image
              src={getProxiedImageUrl(property.imageUrl)}
              alt={property.address}
              fill
              sizes="(max-width: 640px) 100vw, 36rem"
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-7">
          <SheetHeader className="space-y-1.5 p-0">
            <SheetTitle className="text-left text-xl font-bold tracking-tight">
              {property.address}
            </SheetTitle>
            <p className="text-muted-foreground text-[0.9375rem] text-left">
              {property.city}, {property.state} {property.zipCode}
            </p>
          </SheetHeader>

          {/* Price & Actions */}
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {property.price > 0 ? formatPrice(property.price, property.listingMode) : "Prix sur demande"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
                aria-label="Share property"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant={isFavorite ? "destructive" : "outline"}
                size="sm"
                onClick={onToggleFavorite}
                className="rounded-xl"
              >
                <Heart className={`h-4 w-4 mr-1.5 ${isFavorite ? "fill-current" : ""}`} />
                {isFavorite ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { value: property.bedrooms, label: "Beds" },
              { value: property.bathrooms, label: "Baths" },
              { value: property.sqft > 0 ? formatNumber(property.sqft) : "\u2014", label: "m²" },
              { value: property.yearBuilt || "\u2014", label: "Built" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center rounded-2xl bg-muted/50 p-3.5">
                <p className="text-xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Status + Type */}
          <div className="flex items-center gap-2.5">
            <Badge variant="default" className="rounded-lg">
              {property.listingStatus}
            </Badge>
            <Badge variant="secondary" className="rounded-lg">
              {property.propertyType}
            </Badge>
            {property.sqft > 0 && property.price > 0 && (
              <span className="text-sm text-muted-foreground ml-auto tabular-nums">
                {formatNumber(Math.round(property.price / property.sqft))} €/m²
              </span>
            )}
          </div>

          {/* Tabbed content */}
          <Tabs defaultValue="overview">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="neighborhood" onClick={loadNeighborhood}>
                Neighborhood
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-2.5">About this property</h3>
                <p className="text-[0.9375rem] text-muted-foreground leading-relaxed">
                  {property.description || "No description available."}
                </p>
              </div>

              {property.listingUrl && (
                <a
                  href={property.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 hover:bg-muted
                             transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium">View original listing</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {property.source || new URL(property.listingUrl).hostname}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </a>
              )}
            </TabsContent>

            <TabsContent value="features" className="pt-5">
              {property.features.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {property.features.map((f) => (
                    <span key={f} className="text-[0.8125rem] px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground">
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No feature details available.</p>
              )}
            </TabsContent>

            <TabsContent value="neighborhood" className="pt-5">
              {loadingNeighborhood && (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <p className="text-xs text-muted-foreground mt-3">Analyzing neighborhood...</p>
                </div>
              )}

              {neighborhoodError && (
                <div className="rounded-2xl bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{neighborhoodError}</p>
                  <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={loadNeighborhood}>
                    Retry
                  </Button>
                </div>
              )}

              {neighborhood && (
                <div className="space-y-5">
                  <p className="text-[0.9375rem] text-muted-foreground leading-relaxed">
                    {neighborhood.overview}
                  </p>

                  <div className="grid gap-2.5">
                    {neighborhood.schoolRating && (
                      <InfoRow icon="Schools" label="Schools" value={neighborhood.schoolRating} />
                    )}
                    {neighborhood.walkScore && (
                      <InfoRow icon="Walkability" label="Walkability" value={neighborhood.walkScore} />
                    )}
                    {neighborhood.crimeLevel && (
                      <InfoRow icon="Safety" label="Safety" value={neighborhood.crimeLevel} />
                    )}
                    {neighborhood.commuteInfo && (
                      <InfoRow icon="Commute" label="Commute" value={neighborhood.commuteInfo} />
                    )}
                    {neighborhood.medianHomePrice && (
                      <InfoRow icon="Median Price" label="Median Price" value={neighborhood.medianHomePrice} />
                    )}
                    {neighborhood.priceHistory && (
                      <InfoRow icon="Trends" label="Trends" value={neighborhood.priceHistory} />
                    )}
                  </div>

                  {neighborhood.nearbyAmenities.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-2">Nearby amenities</p>
                      <div className="flex flex-wrap gap-2">
                        {neighborhood.nearbyAmenities.map((a) => (
                          <span key={a} className="text-[0.8125rem] px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {neighborhood.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="text-xs font-medium text-muted-foreground">Sources</span>
                      {neighborhood.citations.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary/70 hover:text-primary hover:underline transition-colors"
                        >
                          [{i + 1}]
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!neighborhood && !loadingNeighborhood && !neighborhoodError && (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const IconComponent = neighborhoodIcons[icon] || DollarSign;
  return (
    <div className="flex gap-3.5 text-sm rounded-xl bg-muted/50 p-3.5">
      <IconComponent className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div>
        <span className="font-medium">{label} </span>
        <span className="text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}
