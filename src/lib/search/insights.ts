/**
 * Computed insights — data-driven badges for each property.
 * Pure computation, no API calls. Never fails.
 */

import type { Property } from "@/lib/types";

/**
 * Compute data-driven insight badges for each property.
 * Mutates the properties in place (sets aiInsight field).
 *
 * Badges: "Lowest price", "Best €/m²", "Largest", "X% below avg",
 * "Compact", "Spacious", "Only listing in {city}", "Verified price"
 */
export function computeInsights(properties: Property[]): void {
  if (properties.length === 0) return;

  const withPrice = properties.filter((p) => p.price > 0);
  const withPpsqm = properties.filter(
    (p) => p.pricePerSqm && p.pricePerSqm > 0
  );
  const withSqft = properties.filter((p) => p.sqft > 0);

  const avgPrice =
    withPrice.length > 0
      ? withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length
      : 0;
  const avgPpsqm =
    withPpsqm.length > 0
      ? withPpsqm.reduce((s, p) => s + (p.pricePerSqm || 0), 0) /
        withPpsqm.length
      : 0;
  const lowestPrice =
    withPrice.length > 0
      ? withPrice.reduce((min, p) => (p.price < min.price ? p : min))
      : null;
  const bestPpsqm =
    withPpsqm.length > 0
      ? withPpsqm.reduce((min, p) =>
          (p.pricePerSqm || Infinity) < (min.pricePerSqm || Infinity) ? p : min
        )
      : null;
  const largestSurface =
    withSqft.length > 0
      ? withSqft.reduce((max, p) => (p.sqft > max.sqft ? p : max))
      : null;

  const cityCount: Record<string, number> = {};
  for (const p of properties)
    if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1;

  for (const p of properties) {
    const insights: string[] = [];

    // Price verified badge
    if (p.priceVerified) insights.push("Verified price");

    if (lowestPrice && p.id === lowestPrice.id && withPrice.length > 2)
      insights.push("Lowest price");
    if (bestPpsqm && p.id === bestPpsqm.id && withPpsqm.length > 2)
      insights.push("Best €/m²");
    if (largestSurface && p.id === largestSurface.id && withSqft.length > 2)
      insights.push("Largest");

    if (p.price > 0 && avgPrice > 0 && withPrice.length > 2) {
      const diff = ((p.price - avgPrice) / avgPrice) * 100;
      if (diff <= -20)
        insights.push(`${Math.abs(Math.round(diff))}% below avg`);
      else if (diff >= 20) insights.push(`${Math.round(diff)}% above avg`);
    }

    if (p.pricePerSqm && avgPpsqm > 0 && withPpsqm.length > 2) {
      const diff = ((p.pricePerSqm - avgPpsqm) / avgPpsqm) * 100;
      if (diff <= -15 && !insights.includes("Best €/m²"))
        insights.push("€/m² below avg");
    }

    if (p.sqft > 0) {
      if (p.sqft <= 30) insights.push("Compact");
      else if (p.sqft >= 150) insights.push("Spacious");
    }

    if (
      p.city &&
      cityCount[p.city] === 1 &&
      Object.keys(cityCount).length > 1
    )
      insights.push(`Only listing in ${p.city}`);

    if (insights.length > 0) p.aiInsight = insights.slice(0, 3).join(" · ");
  }
}
