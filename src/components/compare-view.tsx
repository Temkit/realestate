"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  Bed,
  Bath,
  Ruler,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Home,
  Award,
  Sparkles,
} from "lucide-react";
import { compareAction } from "@/app/actions";
import { formatPrice, formatNumber } from "@/lib/format";
import type { Property } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

interface CompareViewProps {
  properties: Property[];
  isOpen: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}

interface CompareField {
  label: string;
  icon: LucideIcon;
  getValue: (p: Property) => string;
  isBest?: (values: string[], current: string) => boolean;
}

export function CompareView({ properties, isOpen, onClose, onRemove }: CompareViewProps) {
  const [aiOpinion, setAiOpinion] = useState<string | null>(null);
  const [loadingOpinion, setLoadingOpinion] = useState(false);

  useEffect(() => {
    if (!isOpen || properties.length < 2) {
      setAiOpinion(null);
      return;
    }
    setLoadingOpinion(true);
    compareAction(
      properties.map((p) => ({
        address: p.address,
        city: p.city,
        price: p.price,
        sqft: p.sqft,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        propertyType: p.propertyType,
        features: p.features,
      }))
    )
      .then(setAiOpinion)
      .catch(() => setAiOpinion(null))
      .finally(() => setLoadingOpinion(false));
  }, [isOpen, properties]);

  if (properties.length < 2) return null;

  const compareFields: CompareField[] = [
    {
      label: "Price",
      icon: DollarSign,
      getValue: (p) => formatPrice(p.price, p.listingMode),
      isBest: (vals, cur) => {
        const nums = vals.map((v) => parseInt(v.replace(/[^0-9]/g, "")));
        const curNum = parseInt(cur.replace(/[^0-9]/g, ""));
        return curNum === Math.min(...nums);
      },
    },
    {
      label: "Bedrooms",
      icon: Bed,
      getValue: (p) => String(p.bedrooms),
    },
    {
      label: "Bathrooms",
      icon: Bath,
      getValue: (p) => String(p.bathrooms),
    },
    {
      label: "m²",
      icon: Ruler,
      getValue: (p) => formatNumber(p.sqft),
      isBest: (vals, cur) => {
        const nums = vals.map((v) => parseInt(v.replace(/,/g, "")) || 0);
        const curNum = parseInt(cur.replace(/,/g, "")) || 0;
        return curNum === Math.max(...nums) && curNum > 0;
      },
    },
    {
      label: "€/m²",
      icon: TrendingUp,
      getValue: (p) => (p.sqft > 0 ? `${formatNumber(Math.round(p.price / p.sqft))} €/m²` : "N/A"),
      isBest: (vals, cur) => {
        const nums = vals.filter((v) => v !== "N/A").map((v) => parseInt(v.replace(/[^0-9]/g, "")));
        const curNum = parseInt(cur.replace(/[^0-9]/g, ""));
        return cur !== "N/A" && curNum === Math.min(...nums);
      },
    },
    {
      label: "Type",
      icon: Building2,
      getValue: (p) => p.propertyType,
    },
    {
      label: "Year Built",
      icon: Calendar,
      getValue: (p) => (p.yearBuilt ? String(p.yearBuilt) : "N/A"),
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
          <DialogTitle>Compare Properties ({properties.length})</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-4 sm:px-6 pb-4 sm:pb-6">
          {/* AI Opinion */}
          {(loadingOpinion || aiOpinion) && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4 mt-4 mb-2">
              <div className="flex gap-2.5">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {loadingOpinion ? (
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                  </div>
                ) : (
                  <p className="text-sm text-foreground leading-relaxed">{aiOpinion}</p>
                )}
              </div>
            </div>
          )}

          {/* Property columns */}
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 mt-4">
            {properties.map((p) => {
              const allValues = compareFields.map((f) => f.getValue(p));
              return (
                <div
                  key={p.id}
                  className="min-w-[70vw] sm:min-w-[200px] flex-1 snap-center rounded-xl border bg-card overflow-hidden"
                >
                  {/* Image */}
                  <div className="relative aspect-[16/10] bg-muted">
                    {p.imageUrl ? (
                      <Image
                        src={getProxiedImageUrl(p.imageUrl)}
                        alt={p.address}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                        <Home className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <button
                      onClick={() => onRemove(p.id)}
                      className="absolute top-2 right-2 p-2.5 sm:p-1.5 rounded-full bg-white/90 dark:bg-black/60
                                 backdrop-blur-sm hover:bg-white dark:hover:bg-black/80 transition-colors"
                      aria-label={`Remove ${p.address} from comparison`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Header */}
                  <div className="p-3 border-b">
                    <p className="font-semibold text-sm truncate">{p.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.city}, {p.state}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="divide-y">
                    {compareFields.map((field) => {
                      const value = field.getValue(p);
                      const allVals = properties.map((prop) => field.getValue(prop));
                      const best = field.isBest?.(allVals, value) ?? false;

                      return (
                        <div key={field.label} className="flex items-center gap-2 px-3 py-2.5">
                          <field.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground flex-1">{field.label}</span>
                          <span className={`text-sm font-medium flex items-center gap-1
                            ${best ? "text-primary" : ""}`}>
                            {value}
                            {best && <Award className="h-3 w-3 text-primary" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Features */}
                  {p.features.length > 0 && (
                    <div className="p-3 border-t">
                      <div className="flex flex-wrap gap-1">
                        {p.features.slice(0, 4).map((f) => (
                          <span key={f} className="text-[11px] sm:text-[10px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
