/**
 * Rental yield calculator — estimates gross yield for buy listings.
 *
 * Fallback chain for rent estimates:
 *   1. Turso price_snapshots (real historical data from past rent searches)
 *   2. Luxembourg national averages by property type (hardcoded)
 *
 * yield = (estimated monthly rent × 12) / purchase price × 100
 */

import type { Property } from "@/lib/types";
import { getRentEstimate } from "@/lib/tracking";

// Luxembourg average rent per m²/month (conservative estimates, 2024-2025 data)
const NATIONAL_RENT_RATES: Record<string, number> = {
  apartment: 22,
  appartement: 22,
  flat: 22,
  studio: 25,
  house: 18,
  maison: 18,
  villa: 16,
  office: 20,
  bureau: 20,
  duplex: 22,
  penthouse: 28,
  loft: 24,
};

const DEFAULT_RENT_RATE = 20; // €/m²/month

function getNationalRentRate(propertyType: string): number {
  const lower = propertyType.toLowerCase();
  for (const [key, rate] of Object.entries(NATIONAL_RENT_RATES)) {
    if (lower.includes(key)) return rate;
  }
  return DEFAULT_RENT_RATE;
}

/**
 * Compute rental yield for buy-mode properties. Mutates properties in place.
 * Only runs for buy mode — rent listings don't have yields.
 */
export async function computeRentalYields(
  properties: Property[],
  mode: "buy" | "rent"
): Promise<void> {
  if (mode !== "buy") return;

  for (const p of properties) {
    try {
      if (p.price <= 0 || p.sqft <= 0 || !p.city) continue;

      // Try Turso historical data first
      let rentPerSqm: number | null = null;
      let source: "cache" | "turso" | "estimate" = "estimate";

      try {
        rentPerSqm = await getRentEstimate(p.city, p.propertyType);
        if (rentPerSqm) source = "turso";
      } catch {
        /* fall through to estimate */
      }

      // Fall back to national averages
      if (!rentPerSqm) {
        rentPerSqm = getNationalRentRate(p.propertyType);
        source = "estimate";
      }

      const estimatedMonthlyRent = Math.round(rentPerSqm * p.sqft);
      const annualRent = estimatedMonthlyRent * 12;
      const grossPercent =
        Math.round((annualRent / p.price) * 1000) / 10; // one decimal

      p.rentalYield = {
        grossPercent,
        estimatedMonthlyRent,
        source,
      };
    } catch {
      /* skip this property */
    }
  }
}
