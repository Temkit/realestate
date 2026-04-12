"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Heart, Home, Bed, Bath, Ruler, ExternalLink, ShieldCheck, TrendingDown, Percent } from "lucide-react";
import type { Property } from "@/lib/types";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { formatPriceCompact, formatNumber } from "@/lib/format";

interface PropertyCardProps {
  property: Property;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
  index?: number;
}

function getInsightStyle(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("lowest") || t.includes("best") || t.includes("below avg") || t.includes("verified"))
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (t.includes("spacious") || t.includes("largest"))
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  if (t.includes("above avg"))
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (t.includes("only listing"))
    return "bg-violet-500/10 text-violet-700 dark:text-violet-400";
  if (t.includes("compact"))
    return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
  return "bg-primary/8 text-primary";
}

function getFairPriceStyle(rating: "good" | "fair" | "high"): string {
  if (rating === "good") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (rating === "fair") return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function InsightBadge({ text }: { text: string }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${getInsightStyle(text)}`}>
      {text}
    </span>
  );
}

function getStatusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("sale")) {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  }
  if (s.includes("pending")) {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
  if (s.includes("sold")) {
    return "bg-red-500/15 text-red-700 dark:text-red-400";
  }
  if (s.includes("rental") || s.includes("rent")) {
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
  }
  return "bg-muted text-muted-foreground";
}

export function PropertyCard({
  property,
  isFavorite,
  onToggleFavorite,
  onSelect,
  index = 0,
}: PropertyCardProps) {
  const t = useTranslations("property");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [heartBounce, setHeartBounce] = useState(false);

  return (
    <article
      className="group cursor-pointer rounded-xl sm:rounded-2xl border bg-card overflow-hidden
                 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5
                 animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onSelect}
      role="article"
      aria-label={`${property.address}, ${formatPriceCompact(property.price, property.listingMode) || t("priceOnRequest")}`}
    >
      {/* Image — fixed height, not aspect ratio, so all cards match */}
      <div
        className="relative overflow-hidden bg-muted h-[180px] sm:h-[200px]"
      >
        {property.imageUrl && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 z-10 shimmer">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Home className="h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
                </div>
              </div>
            )}
            <Image
              src={getProxiedImageUrl(property.imageUrl)}
              alt={`${property.propertyType}${property.sqft > 0 ? ` ${property.sqft}m²` : ""}${property.city ? ` in ${property.city}` : ""}${property.price > 0 ? ` — €${formatNumber(property.price)}` : ""}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={index < 2}
              loading={index < 2 ? "eager" : "lazy"}
              className={`object-cover transition-all duration-500 group-hover:scale-105 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center
                          bg-gradient-to-br from-secondary to-muted"
          >
            <Home
              className="h-10 w-10 text-muted-foreground/25 mb-2"
              strokeWidth={1}
            />
            <span className="text-xs text-muted-foreground/40 font-medium">
              {t("noPhoto")}
            </span>
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Price */}
        <div className="absolute bottom-3.5 left-3.5">
          <span
            className="bg-white/95 dark:bg-card/95 backdrop-blur-sm text-foreground
                           px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-base sm:text-xl font-bold shadow-sm tabular-nums tracking-tight"
          >
            {formatPriceCompact(property.price, property.listingMode) || t("priceOnRequest")}
          </span>
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setHeartBounce(true);
            setTimeout(() => setHeartBounce(false), 350);
            onToggleFavorite();
          }}
          className="absolute top-2.5 right-2.5 p-3 sm:p-2.5 rounded-full bg-white/90 dark:bg-black/60
                     backdrop-blur-sm hover:bg-white dark:hover:bg-black/80
                     transition-all duration-200 active:scale-90 shadow-sm"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={`h-[18px] w-[18px] transition-all duration-200
              ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-600 dark:text-gray-300"}
              ${heartBounce ? "animate-heart-bounce" : ""}`}
          />
        </button>

        {/* Status */}
        <div className="absolute top-3.5 left-3.5">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${getStatusStyle(property.listingStatus)}`}
          >
            {property.listingStatus}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-5 min-h-[140px] sm:min-h-[160px] flex flex-col">
        {/* Context Insights */}
        {(property.aiInsight || property.fairPrice || property.priceVerified) && (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {property.priceVerified && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
            {property.fairPrice && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${getFairPriceStyle(property.fairPrice.rating)}`}>
                {property.fairPrice.label}
              </span>
            )}
            {property.aiInsight?.split(" · ").map((insight) => (
              <InsightBadge key={insight} text={insight} />
            ))}
          </div>
        )}

        {/* Address + location */}
        <h3 className="font-semibold text-[0.9375rem] leading-snug truncate">
          {property.address}
        </h3>
        <p className="text-muted-foreground text-sm mt-1 truncate">
          {property.city}{property.zipCode ? ` ${property.zipCode}` : ""}
        </p>

        {/* Stats */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1.5">
              <Bed className="h-4 w-4 text-muted-foreground/60" />
              <span>
                <strong className="text-foreground font-medium">
                  {property.bedrooms}
                </strong>{" "}
                bd
              </span>
            </span>
          )}
          {property.bathrooms > 0 && (
            <span className="flex items-center gap-1.5">
              <Bath className="h-4 w-4 text-muted-foreground/60" />
              <span>
                <strong className="text-foreground font-medium">
                  {property.bathrooms}
                </strong>{" "}
                ba
              </span>
            </span>
          )}
          {property.sqft > 0 && (
            <span className="flex items-center gap-1.5">
              <Ruler className="h-4 w-4 text-muted-foreground/60" />
              <span>
                <strong className="text-foreground font-medium">
                  {formatNumber(property.sqft)}
                </strong>{" "}
                m²
              </span>
            </span>
          )}
          {property.pricePerSqm && property.pricePerSqm > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              €{formatNumber(property.pricePerSqm)}/m²
            </span>
          )}
        </div>

        {/* True cost + yield hints */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {property.trueCost?.totalCost && property.trueCost.totalCost > property.price && (
            <span className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Total: €{formatNumber(property.trueCost.totalCost)}
            </span>
          )}
          {property.trueCost?.monthlyTotal && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Total: €{formatNumber(property.trueCost.monthlyTotal)}/mo
            </span>
          )}
          {property.rentalYield && property.rentalYield.grossPercent > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1">
              <Percent className="h-3 w-3" />
              Yield: {property.rentalYield.grossPercent}%
            </span>
          )}
        </div>

        {/* Footer — pinned to bottom */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground font-medium truncate max-w-[45%]">
            {property.propertyType}
          </span>
          <div className="flex items-center gap-1.5 max-w-[55%]" onClick={(e) => e.stopPropagation()}>
            {(property.listingUrls && property.listingUrls.length > 1 ? property.listingUrls : [property.listingUrl]).filter(Boolean).slice(0, 3).map((url, i) => {
              const host = (() => { try { return new URL(url!).hostname.replace("www.", ""); } catch { return ""; } })();
              return (
                <a
                  key={i}
                  href={url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5 transition-colors"
                  title={url!}
                >
                  {host.replace(".lu", "")}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
