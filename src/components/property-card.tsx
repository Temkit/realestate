"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Heart, Home, Bed, Bath, Ruler, ExternalLink, Sparkles } from "lucide-react";
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
              alt={property.address}
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
        {/* AI Insight */}
        {property.aiInsight && (
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3 w-3 text-primary shrink-0" />
            <span className="text-xs text-primary font-medium truncate">
              {property.aiInsight}
            </span>
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

        {/* Footer — pinned to bottom */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground font-medium truncate max-w-[45%]">
            {property.propertyType}
          </span>
          {(property.listingUrl || property.source) && (
            <span className="text-xs text-muted-foreground truncate max-w-[50%]">
              {property.listingUrl ? (
                <a
                  href={property.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-1 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {property.source || "View listing"}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                property.source
              )}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
