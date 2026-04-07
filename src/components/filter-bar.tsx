"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import type { Property } from "@/lib/types";
import type { SortOption } from "@/hooks/use-property-search";

interface Filters {
  minPrice: number | null;
  maxPrice: number | null;
  minBeds: number | null;
  propertyType: string | null;
}

interface FilterBarProps {
  properties: Property[];
  onFilteredChange: (filtered: Property[]) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const priceRanges = [
  { label: "Under €300K", min: null, max: 300_000 },
  { label: "€300K\u2013€500K", min: 300_000, max: 500_000 },
  { label: "€500K\u2013€750K", min: 500_000, max: 750_000 },
  { label: "€750K\u2013€1M", min: 750_000, max: 1_000_000 },
  { label: "€1M+", min: 1_000_000, max: null },
];

const bedOptions = [1, 2, 3, 4];

const typeOptions = ["House", "Condo", "Apartment", "Townhouse"];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "AI Recommended" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "size", label: "Largest first" },
];

function applyFilters(properties: Property[], filters: Filters): Property[] {
  return properties.filter((p) => {
    if (filters.minPrice !== null && p.price < filters.minPrice) return false;
    if (filters.maxPrice !== null && p.price > filters.maxPrice) return false;
    if (filters.minBeds !== null && p.bedrooms < filters.minBeds) return false;
    if (filters.propertyType !== null) {
      const type = p.propertyType.toLowerCase();
      const target = filters.propertyType.toLowerCase();
      if (!type.includes(target)) return false;
    }
    return true;
  });
}

export function FilterBar({ properties, onFilteredChange, sortBy, onSortChange }: FilterBarProps) {
  const t = useTranslations("filter");
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    minPrice: null,
    maxPrice: null,
    minBeds: null,
    propertyType: null,
  });

  const hasActiveFilters =
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.minBeds !== null ||
    filters.propertyType !== null;

  const updateFilters = (next: Filters) => {
    setFilters(next);
    onFilteredChange(applyFilters(properties, next));
  };

  const clearFilters = () => {
    const empty: Filters = {
      minPrice: null,
      maxPrice: null,
      minBeds: null,
      propertyType: null,
    };
    setFilters(empty);
    onFilteredChange(properties);
  };

  return (
    <div className="mb-6">
      {/* Mobile: filter toggle + sort */}
      <div className="flex items-center justify-between sm:hidden mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground
                     transition-colors px-3.5 py-2.5 rounded-xl border"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </button>

        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none text-sm pl-8 pr-6 py-2.5 rounded-xl border bg-card text-muted-foreground
                       hover:text-foreground transition-colors cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter chips + sort */}
      <div
        className={`flex flex-wrap gap-2.5 items-center ${expanded ? "flex" : "hidden sm:flex"}`}
      >
        {/* Price range */}
        {priceRanges.map((range) => {
          const active =
            filters.minPrice === range.min && filters.maxPrice === range.max;
          return (
            <button
              key={range.label}
              onClick={() =>
                updateFilters({
                  ...filters,
                  minPrice: active ? null : range.min,
                  maxPrice: active ? null : range.max,
                })
              }
              className={`text-[0.8125rem] px-3.5 py-1.5 rounded-full border transition-all duration-200
                ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
            >
              {range.label}
            </button>
          );
        })}

        <div className="w-px h-7 bg-border self-center hidden sm:block" />

        {/* Bedrooms */}
        {bedOptions.map((beds) => {
          const active = filters.minBeds === beds;
          return (
            <button
              key={beds}
              onClick={() =>
                updateFilters({ ...filters, minBeds: active ? null : beds })
              }
              className={`text-[0.8125rem] px-3.5 py-1.5 rounded-full border transition-all duration-200
                ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
            >
              {beds}+ bd
            </button>
          );
        })}

        <div className="w-px h-7 bg-border self-center hidden sm:block" />

        {/* Property type */}
        {typeOptions.map((type) => {
          const active = filters.propertyType === type;
          return (
            <button
              key={type}
              onClick={() =>
                updateFilters({
                  ...filters,
                  propertyType: active ? null : type,
                })
              }
              className={`text-[0.8125rem] px-3.5 py-1.5 rounded-full border transition-all duration-200
                ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
            >
              {type}
            </button>
          );
        })}

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[0.8125rem] px-3.5 py-1.5 rounded-full border border-destructive/30 text-destructive
                       hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}

        {/* Sort — desktop */}
        <div className="hidden sm:flex items-center ml-auto">
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="appearance-none text-[0.8125rem] pl-8 pr-8 py-1.5 rounded-full border bg-card text-muted-foreground
                         hover:text-foreground hover:border-primary/40 transition-all duration-200 cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
