"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { formatPrice, formatNumber } from "@/lib/format";
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
  X,
  Bed,
  Bath,
  Ruler,
  Calendar,
  ShieldCheck,
  Home,
} from "lucide-react";
// Calendar, Bed, Bath, Ruler used in stats row
// ShieldCheck, Home used in image section
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

  useEffect(() => {
    if (!isOpen || !property || neighborhood || loadingNeighborhood) return;
    const timer = setTimeout(() => loadNeighborhood(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, property?.id]);

  useEffect(() => {
    if (!isOpen) {
      setNeighborhood(null);
      setNeighborhoodError(null);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!property || !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Modal — full screen mobile, centered large modal desktop */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 md:p-8">
        <div
          className="relative bg-background w-full sm:max-w-3xl sm:rounded-2xl overflow-hidden
                     h-full sm:h-auto sm:max-h-[90vh] flex flex-col
                     animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60
                       text-white transition-colors backdrop-blur-sm"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Hero Image */}
            <div className="relative w-full aspect-[16/9] sm:aspect-[16/8] bg-muted">
              {property.imageUrl ? (
                <Image
                  src={getProxiedImageUrl(property.imageUrl)}
                  alt={property.address}
                  fill
                  sizes="(max-width: 640px) 100vw, 48rem"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-secondary to-muted">
                  <Home className="h-12 w-12 text-muted-foreground/25 mb-2" strokeWidth={1} />
                  <span className="text-xs text-muted-foreground/40">No photo</span>
                </div>
              )}
              {/* Price overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 sm:p-6">
                <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
                  {property.price > 0 ? formatPrice(property.price, property.listingMode) : "Prix sur demande"}
                </span>
                {property.trueCost?.totalCost && property.trueCost.totalCost > property.price && (
                  <span className="text-sm text-white/70 ml-2 tabular-nums">
                    (Total: €{formatNumber(property.trueCost.totalCost)})
                  </span>
                )}
              </div>
              {/* Badges */}
              <div className="absolute top-3 left-3 flex gap-2">
                {property.priceVerified && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/90 text-white inline-flex items-center gap-1 backdrop-blur-sm">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                )}
                {property.fairPrice && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm text-white ${
                    property.fairPrice.rating === "good" ? "bg-emerald-500/90" :
                    property.fairPrice.rating === "fair" ? "bg-blue-500/90" :
                    "bg-amber-500/90"
                  }`}>
                    {property.fairPrice.label}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-5">
              {/* Title + Actions */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight">{property.address}</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {property.city}, {property.state} {property.zipCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => navigator.clipboard.writeText(window.location.href)}
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
              </div>

              {/* Key Stats — compact inline row */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {property.bedrooms > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Bed className="h-3.5 w-3.5" />
                    <strong className="text-foreground">{property.bedrooms}</strong> bd
                  </span>
                )}
                {property.bathrooms > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Bath className="h-3.5 w-3.5" />
                    <strong className="text-foreground">{property.bathrooms}</strong> ba
                  </span>
                )}
                {property.sqft > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5" />
                    <strong className="text-foreground">{formatNumber(property.sqft)}</strong> m²
                  </span>
                )}
                {property.yearBuilt && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {property.yearBuilt}
                  </span>
                )}
                {property.pricePerSqm && property.pricePerSqm > 0 && (
                  <span className="tabular-nums ml-auto">€{formatNumber(property.pricePerSqm)}/m²</span>
                )}
              </div>

              {/* Status + Type */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="rounded-lg">{property.listingStatus}</Badge>
                <Badge variant="secondary" className="rounded-lg">{property.propertyType}</Badge>
                {property.rentalYield && property.rentalYield.grossPercent > 0 && (
                  <Badge variant="secondary" className="rounded-lg tabular-nums">
                    Yield {property.rentalYield.grossPercent}%
                  </Badge>
                )}
              </div>

              {/* Tabbed content */}
              <Tabs defaultValue="overview">
                <TabsList variant="line" className="w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="costs">Costs</TabsTrigger>
                  <TabsTrigger value="neighborhood" onClick={loadNeighborhood}>Neighborhood</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="pt-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold mb-2.5">About this property</h3>
                    <p className="text-[0.9375rem] text-muted-foreground leading-relaxed">
                      {property.description || "No description available."}
                    </p>
                  </div>
                  {/* Portal links */}
                  {(property.listingUrls && property.listingUrls.length > 0 ? property.listingUrls : property.listingUrl ? [property.listingUrl] : []).map((url, i) => {
                    const host = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return "Portal"; } })();
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
                        <div>
                          <p className="text-sm font-medium">View on {host}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Original listing</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </a>
                    );
                  })}
                </TabsContent>

                <TabsContent value="costs" className="pt-5 space-y-5">
                  {property.trueCost ? (
                    <div>
                      <h3 className="text-sm font-semibold mb-2.5">
                        {property.listingMode === "rent" ? "Move-in costs" : "Total acquisition cost"}
                      </h3>
                      <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                        {property.listingMode === "buy" ? (
                          <>
                            <CostRow label="Purchase price" value={property.price} />
                            {property.trueCost.registrationTax && <CostRow label="Registration tax (6%)" value={property.trueCost.registrationTax} />}
                            {property.trueCost.notaryFees && <CostRow label="Notary fees (~1.5%)" value={property.trueCost.notaryFees} />}
                            {property.trueCost.bankFees && <CostRow label="Bank fees (~0.75%)" value={property.trueCost.bankFees} />}
                            {property.trueCost.totalCost && <CostRow label="Total cost" value={property.trueCost.totalCost} bold />}
                          </>
                        ) : (
                          <>
                            <CostRow label="Monthly rent" value={property.price} suffix="/mo" />
                            {property.chargesEstimate && <CostRow label="Est. charges" value={property.chargesEstimate} suffix="/mo" />}
                            {property.trueCost.monthlyTotal && <CostRow label="Monthly total" value={property.trueCost.monthlyTotal} suffix="/mo" bold />}
                            <div className="border-t my-2" />
                            {property.trueCost.securityDeposit && <CostRow label="Deposit (3 months)" value={property.trueCost.securityDeposit} />}
                            {property.trueCost.agencyFee && <CostRow label="Agency fee" value={property.trueCost.agencyFee} />}
                            <CostRow label="First month" value={property.price} />
                            {property.trueCost.moveInCost && <CostRow label="Total move-in" value={property.trueCost.moveInCost} bold />}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Cost data not available.</p>
                  )}

                  {property.rentalYield && property.rentalYield.grossPercent > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2.5">Investment yield</h3>
                      <div className="rounded-xl bg-muted/50 p-4 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gross yield</span>
                          <span className="font-bold tabular-nums">{property.rentalYield.grossPercent}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Est. rent</span>
                          <span className="tabular-nums">€{formatNumber(property.rentalYield.estimatedMonthlyRent)}/mo</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Based on {property.rentalYield.source === "turso" ? "local data" : "market averages"}
                        </p>
                      </div>
                    </div>
                  )}

                  {property.fairPrice && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2.5">Price context</h3>
                      <div className="rounded-xl bg-muted/50 p-4">
                        <p className="text-sm">
                          This property is{" "}
                          <span className={`font-semibold ${
                            property.fairPrice.rating === "good" ? "text-emerald-600 dark:text-emerald-400" :
                            property.fairPrice.rating === "high" ? "text-amber-600 dark:text-amber-400" :
                            "text-foreground"
                          }`}>{property.fairPrice.label.toLowerCase()}</span>{" "}
                          at €{formatNumber(property.pricePerSqm || 0)}/m².
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="neighborhood" className="pt-5">
                  {loadingNeighborhood && (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-5/6" />
                      <p className="text-xs text-muted-foreground mt-3">Analyzing neighborhood...</p>
                    </div>
                  )}
                  {neighborhoodError && (
                    <div className="rounded-xl bg-destructive/10 p-4">
                      <p className="text-sm text-destructive">{neighborhoodError}</p>
                      <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={loadNeighborhood}>Retry</Button>
                    </div>
                  )}
                  {neighborhood && (
                    <div className="space-y-5">
                      <p className="text-[0.9375rem] text-muted-foreground leading-relaxed">{neighborhood.overview}</p>
                      <div className="grid gap-2.5">
                        {neighborhood.schoolRating && <InfoRow icon="Schools" label="Schools" value={neighborhood.schoolRating} />}
                        {neighborhood.walkScore && <InfoRow icon="Walkability" label="Walkability" value={neighborhood.walkScore} />}
                        {neighborhood.crimeLevel && <InfoRow icon="Safety" label="Safety" value={neighborhood.crimeLevel} />}
                        {neighborhood.commuteInfo && <InfoRow icon="Commute" label="Commute" value={neighborhood.commuteInfo} />}
                        {neighborhood.medianHomePrice && <InfoRow icon="Median Price" label="Median Price" value={neighborhood.medianHomePrice} />}
                        {neighborhood.priceHistory && <InfoRow icon="Trends" label="Trends" value={neighborhood.priceHistory} />}
                      </div>
                      {neighborhood.nearbyAmenities.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-2">Nearby amenities</p>
                          <div className="flex flex-wrap gap-2">
                            {neighborhood.nearbyAmenities.map((a) => (
                              <span key={a} className="text-[0.8125rem] px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {neighborhood.citations.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <span className="text-xs font-medium text-muted-foreground">Sources</span>
                          {neighborhood.citations.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary/70 hover:text-primary hover:underline">[{i + 1}]</a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!neighborhood && !loadingNeighborhood && !neighborhoodError && (
                    <div className="space-y-3 py-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CostRow({ label, value, suffix, bold }: { label: string; value: number; suffix?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-bold border-t pt-2" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">€{formatNumber(value)}{suffix || ""}</span>
    </div>
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
