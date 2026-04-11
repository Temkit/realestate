"use client";

import { BarChart3, TrendingUp, Building2, Globe } from "lucide-react";
import type { MarketAnalytics } from "@/lib/types";
import { formatNumber } from "@/lib/format";

interface MarketStatsProps {
  analytics: MarketAnalytics;
  mode: "buy" | "rent";
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
    low: { label: "Low supply", style: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    medium: { label: "Moderate supply", style: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    high: { label: "High supply", style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  };
  const { label, style } = config[level];
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${style}`}>
      {label}
    </span>
  );
}

export function MarketStats({ analytics, mode }: MarketStatsProps) {
  const { priceRange, pricePerSqm, priceDistribution, supplyLevel, portalCoverage } = analytics;
  if (!priceRange) return null;

  const suffix = mode === "rent" ? "/mo" : "";
  const maxBucket = Math.max(...priceDistribution.map((b) => b.count), 1);

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Market overview</h3>
        </div>
        <SupplyBadge level={supplyLevel} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          icon={TrendingUp}
          label="Price range"
          value={`€${formatNumber(priceRange.min)}${suffix}`}
          sub={`to €${formatNumber(priceRange.max)}${suffix}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg price"
          value={`€${formatNumber(priceRange.avg)}${suffix}`}
          sub={`Median €${formatNumber(priceRange.median)}${suffix}`}
        />
        {pricePerSqm && (
          <StatCard
            icon={Building2}
            label="Avg €/m²"
            value={`€${formatNumber(pricePerSqm.avg)}`}
            sub={`${formatNumber(pricePerSqm.min)} – ${formatNumber(pricePerSqm.max)}`}
          />
        )}
        <StatCard
          icon={Globe}
          label="Portals"
          value={`${portalCoverage.length} sources`}
          sub={portalCoverage.map((p) => p.portal.replace(".lu", "")).join(", ")}
        />
      </div>

      {/* Price distribution */}
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
  );
}
