/**
 * Computed property features — Luxembourg-specific calculations.
 *
 * Pure math, zero API cost. Mutates properties in place.
 *
 * Features:
 *   1. True cost calculator (buy: notary+registration+bank. Rent: deposit+agency+charges)
 *   2. Fair price indicator (vs search average €/m²)
 *   3. Charges estimate (€/m²/month by property type)
 *   5. Commune price comparison (vs commune average from current results)
 */

import type { Property, MarketAnalytics } from "@/lib/types";

// ── Luxembourg fee rates (fixed by law) ─────────────────────────────────────

const BUY_RATES = {
  registrationTax: 0.06, // 6% (primary residence, "bëllegen akt" credit may apply)
  notaryFees: 0.015, // ~1.5%
  bankFees: 0.0075, // ~0.75% mortgage-related
};

const RENT_RATES = {
  securityDepositMonths: 3,
  agencyFeeMonths: 1,
};

// ── Charges estimate rates (€/m²/month) ────────────────────────────────────

const CHARGES_RATES: Record<string, number> = {
  apartment: 4,
  appartement: 4,
  flat: 4,
  studio: 4.5,
  house: 2.5,
  maison: 2.5,
  villa: 2.5,
  office: 5,
  bureau: 5,
  cabinet: 5,
  duplex: 4,
  penthouse: 4.5,
  loft: 3.5,
};

const DEFAULT_CHARGES_RATE = 3.5;

function getChargesRate(propertyType: string): number {
  const lower = (propertyType || "").toLowerCase();
  for (const [key, rate] of Object.entries(CHARGES_RATES)) {
    if (lower.includes(key)) return rate;
  }
  return DEFAULT_CHARGES_RATE;
}

// ── Main computation ────────────────────────────────────────────────────────

/**
 * Compute all property features in one pass. Mutates properties in place.
 * Never throws — each property is wrapped in try/catch.
 */
export function computePropertyFeatures(
  properties: Property[],
  mode: "buy" | "rent",
  analytics: MarketAnalytics
): void {
  if (properties.length === 0) return;

  // Pre-compute commune averages for feature 5
  const communeStats = new Map<
    string,
    { totalPpsqm: number; count: number }
  >();
  for (const p of properties) {
    if (p.city && p.pricePerSqm && p.pricePerSqm > 0) {
      const stats = communeStats.get(p.city) || {
        totalPpsqm: 0,
        count: 0,
      };
      stats.totalPpsqm += p.pricePerSqm;
      stats.count += 1;
      communeStats.set(p.city, stats);
    }
  }

  const avgPpsqm = analytics.pricePerSqm?.avg || 0;

  for (const p of properties) {
    try {
      // ── Feature 1: True cost calculator ───────────────────────────
      if (p.price > 0) {
        if (mode === "buy") {
          const registrationTax = Math.round(
            p.price * BUY_RATES.registrationTax
          );
          const notaryFees = Math.round(p.price * BUY_RATES.notaryFees);
          const bankFees = Math.round(p.price * BUY_RATES.bankFees);
          p.trueCost = {
            registrationTax,
            notaryFees,
            bankFees,
            totalCost: p.price + registrationTax + notaryFees + bankFees,
          };
        } else {
          const chargesRate = getChargesRate(p.propertyType);
          const estimatedCharges =
            p.sqft > 0 ? Math.round(chargesRate * p.sqft) : 0;
          const securityDeposit =
            p.price * RENT_RATES.securityDepositMonths;
          const agencyFee = p.price * RENT_RATES.agencyFeeMonths;

          p.trueCost = {
            estimatedCharges,
            securityDeposit,
            agencyFee,
            moveInCost: securityDeposit + agencyFee + p.price,
            monthlyTotal: p.price + estimatedCharges,
          };
        }
      }

      // ── Feature 3: Charges estimate ───────────────────────────────
      if (p.sqft > 0) {
        const rate = getChargesRate(p.propertyType);
        p.chargesEstimate = Math.round(rate * p.sqft);
      }

      // ── Feature 2: Fair price indicator ───────────────────────────
      if (p.pricePerSqm && p.pricePerSqm > 0 && avgPpsqm > 0) {
        const diffPercent = ((p.pricePerSqm - avgPpsqm) / avgPpsqm) * 100;
        const absDiff = Math.abs(Math.round(diffPercent));
        const direction = diffPercent < 0 ? "below" : "above";
        const rating: "good" | "fair" | "high" =
          diffPercent <= -10 ? "good" : diffPercent <= 10 ? "fair" : "high";

        p.fairPrice = {
          diffPercent: Math.round(diffPercent),
          label:
            absDiff < 3
              ? "At market average"
              : `${absDiff}% ${direction} average`,
          rating,
        };
      }

      // ── Feature 5: Commune price comparison ───────────────────────
      if (p.city && p.pricePerSqm && p.pricePerSqm > 0) {
        const stats = communeStats.get(p.city);
        if (stats && stats.count >= 2) {
          const communeAvg = Math.round(stats.totalPpsqm / stats.count);
          const diffPercent =
            ((p.pricePerSqm - communeAvg) / communeAvg) * 100;
          const absDiff = Math.abs(Math.round(diffPercent));
          const direction = diffPercent < 0 ? "below" : "above";

          p.communePriceComparison = {
            communeAvgPpsqm: communeAvg,
            diffPercent: Math.round(diffPercent),
            label:
              absDiff < 3
                ? `At ${p.city} average`
                : `${absDiff}% ${direction} ${p.city} avg`,
          };
        }
      }
    } catch {
      /* skip this property, continue with others */
    }
  }
}
