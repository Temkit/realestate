"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, Building2, Globe, ChevronDown } from "lucide-react";
import type { MarketAnalytics } from "@/lib/types";
import { formatNumber } from "@/lib/format";

interface MarketStatsProps {
  analytics: MarketAnalytics;
  mode: "buy" | "rent";
  propertyCount?: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 sm:p-3.5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function PriceBar({
  label,
  count,
  maxCount,
}: {
  label: string;
  count: number;
  maxCount: number;
}) {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 sm:w-32 text-muted-foreground truncate tabular-nums text-right">
        {label}
      </span>
      <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded bg-primary/20 flex items-center justify-end pr-1.5 transition-all duration-500"
          style={{ width: `${width}%` }}
        >
          <span className="text-[10px] font-semibold text-primary tabular-nums">
            {count}
          </span>
        </div>
      </div>
    </div>
  );
}

function SupplyBadge({ level }: { level: MarketAnalytics["supplyLevel"] }) {
  const config = {
    low: { label: "Low", style: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    medium: { label: "Medium", style: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    high: { label: "High", style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  };
  const { label, style } = config[level];
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${style}`}>
      {label} supply
    </span>
  );
}

export function MarketStats({ analytics, mode, propertyCount }: MarketStatsProps) {
  const { priceRange, pricePerSqm, priceDistribution, supplyLevel, portalCoverage } = analytics;
  const [expanded, setExpanded] = useState(false);

  if (!priceRange) return null;

  const suffix = mode === "rent" ? "/mo" : "";
  const maxBucket = Math.max(...priceDistribution.map((b) => b.count), 1);
  const count = propertyCount ?? 0;

  // Compact summary for collapsed state
  const summaryParts = [
    count > 0 ? `${count} listings` : null,
    `€${formatNumber(priceRange.min)}–€${formatNumber(priceRange.max)}${suffix}`,
    pricePerSqm ? `avg €${formatNumber(pricePerSqm.avg)}/m²` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden animate-fade-in-up">
      {/* Compact summary button — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left
                   hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[56px]"
        aria-expanded={expanded}
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate tabular-nums">
            {summaryParts.join(" · ")}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <SupplyBadge level={supplyLevel} />
            <span className="text-[11px] text-muted-foreground">
              {portalCoverage.length} {portalCoverage.length === 1 ? "portal" : "portals"}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t animate-fade-in-up">
          <div className="pt-4 grid grid-cols-2 gap-2.5">
            <StatCard
              icon={TrendingUp}
              label="Price range"
              value={`€${formatNumber(priceRange.min)}${suffix}`}
              sub={`to €${formatNumber(priceRange.max)}${suffix}`}
            />
            <StatCard
              icon={TrendingUp}
              label="Average"
              value={`€${formatNumber(priceRange.avg)}${suffix}`}
              sub={`Median €${formatNumber(priceRange.median)}${suffix}`}
            />
            {pricePerSqm && (
              <StatCard
                icon={Building2}
                label="Avg €/m²"
                value={`€${formatNumber(pricePerSqm.avg)}`}
                sub={`${formatNumber(pricePerSqm.min)}–${formatNumber(pricePerSqm.max)}`}
              />
            )}
            <StatCard
              icon={Globe}
              label="Portals"
              value={`${portalCoverage.length} ${portalCoverage.length === 1 ? "source" : "sources"}`}
              sub={portalCoverage.map((p) => p.portal.replace(".lu", "")).join(", ")}
            />
          </div>

          {priceDistribution.length >= 2 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Price distribution</p>
              {priceDistribution.map((bucket) => (
                <PriceBar
                  key={bucket.label}
                  label={bucket.label}
                  count={bucket.count}
                  maxCount={maxBucket}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
