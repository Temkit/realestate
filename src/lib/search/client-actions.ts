/**
 * Client-side actions — pure functions that transform properties without API calls.
 * Used for filter, sort, question intents. Instant response.
 */

import type { Property, MarketAnalytics } from "@/lib/types";
import type { FilterParams, SortParams, QuestionParams, DetailParams } from "./intent-classifier";
import { formatNumber } from "@/lib/format";

/**
 * Apply a filter to properties. Returns a new filtered array.
 */
export function applyFilter(
  properties: Property[],
  params: FilterParams
): Property[] {
  let result = [...properties];

  // Field + operator filter
  if (params.field && params.operator && params.value != null) {
    result = result.filter((p) => {
      const val = getFieldValue(p, params.field!);
      if (val == null) return true; // keep properties without data
      switch (params.operator) {
        case "max": return val <= params.value!;
        case "min": return val >= params.value!;
        case "eq": return val === params.value!;
        case "gt": return val > params.value!;
        case "lt": return val < params.value!;
        default: return true;
      }
    });
  }

  // Exclude types
  if (params.excludeTypes && params.excludeTypes.length > 0) {
    const excluded = new Set(params.excludeTypes.map((t) => t.toLowerCase()));
    result = result.filter(
      (p) => !excluded.has((p.propertyType || "").toLowerCase())
    );
  }

  // Source filter
  if (params.sourceFilter) {
    const src = params.sourceFilter.toLowerCase();
    result = result.filter((p) => {
      const sources = p.sources || (p.source ? [p.source] : []);
      return sources.some((s) => (s || "").toLowerCase().includes(src));
    });
  }

  return result;
}

/**
 * Sort properties by a field.
 */
export function applySort(
  properties: Property[],
  params: SortParams
): Property[] {
  const sorted = [...properties];
  const dir = params.direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    const va = getFieldValue(a, params.field) || 0;
    const vb = getFieldValue(b, params.field) || 0;
    return (va - vb) * dir;
  });

  return sorted;
}

/**
 * Answer a question from existing data. Returns a human-readable string.
 */
export function answerQuestion(
  properties: Property[],
  analytics: MarketAnalytics | null,
  params: QuestionParams,
  locale: string = "fr"
): string {
  const withPrice = properties.filter((p) => p.price > 0);

  switch (params.questionType) {
    case "count": {
      const count = properties.length;
      return locale === "fr"
        ? `Il y a ${count} propri\u00e9t\u00e9${count > 1 ? "s" : ""} affich\u00e9e${count > 1 ? "s" : ""}.`
        : `There are ${count} propert${count > 1 ? "ies" : "y"} displayed.`;
    }

    case "cheapest": {
      if (withPrice.length === 0) return locale === "fr" ? "Aucun prix disponible." : "No prices available.";
      const cheapest = withPrice.reduce((min, p) => p.price < min.price ? p : min);
      return locale === "fr"
        ? `Le moins cher : \u20ac${formatNumber(cheapest.price)} \u00e0 ${cheapest.city || cheapest.address} (${cheapest.sqft}m\u00b2).`
        : `Cheapest: \u20ac${formatNumber(cheapest.price)} in ${cheapest.city || cheapest.address} (${cheapest.sqft}m\u00b2).`;
    }

    case "expensive": {
      if (withPrice.length === 0) return locale === "fr" ? "Aucun prix disponible." : "No prices available.";
      const expensive = withPrice.reduce((max, p) => p.price > max.price ? p : max);
      return locale === "fr"
        ? `Le plus cher : \u20ac${formatNumber(expensive.price)} \u00e0 ${expensive.city || expensive.address} (${expensive.sqft}m\u00b2).`
        : `Most expensive: \u20ac${formatNumber(expensive.price)} in ${expensive.city || expensive.address} (${expensive.sqft}m\u00b2).`;
    }

    case "average": {
      if (!analytics?.priceRange) return locale === "fr" ? "Pas assez de donn\u00e9es." : "Not enough data.";
      const avg = analytics.priceRange.avg;
      const ppsqm = analytics.pricePerSqm?.avg;
      return locale === "fr"
        ? `Prix moyen : \u20ac${formatNumber(avg)}${ppsqm ? ` (\u20ac${formatNumber(ppsqm)}/m\u00b2)` : ""}.`
        : `Average price: \u20ac${formatNumber(avg)}${ppsqm ? ` (\u20ac${formatNumber(ppsqm)}/m\u00b2)` : ""}.`;
    }

    case "yield": {
      const withYield = properties.filter((p) => p.rentalYield?.grossPercent);
      if (withYield.length === 0) return locale === "fr" ? "Rendement non disponible." : "Yield not available.";
      const avgYield = withYield.reduce((s, p) => s + (p.rentalYield?.grossPercent || 0), 0) / withYield.length;
      return locale === "fr"
        ? `Rendement brut moyen : ${avgYield.toFixed(1)}%.`
        : `Average gross yield: ${avgYield.toFixed(1)}%.`;
    }

    case "cost": {
      const withCost = properties.filter((p) => p.trueCost?.totalCost || p.trueCost?.moveInCost);
      if (withCost.length === 0) return locale === "fr" ? "Co\u00fbt total non disponible." : "Total cost not available.";
      const p = withCost[0];
      const cost = p.trueCost?.totalCost || p.trueCost?.moveInCost || 0;
      return locale === "fr"
        ? `Co\u00fbt total : \u20ac${formatNumber(cost)} (frais inclus).`
        : `Total cost: \u20ac${formatNumber(cost)} (fees included).`;
    }

    default:
      return locale === "fr"
        ? `${properties.length} propri\u00e9t\u00e9s trouv\u00e9es.`
        : `${properties.length} properties found.`;
  }
}

/**
 * Select a property by index or identifier.
 */
export function selectProperty(
  properties: Property[],
  params: DetailParams
): Property | null {
  if (params.index != null && params.index >= 0 && params.index < properties.length) {
    return properties[params.index];
  }
  if (params.identifier) {
    const id = params.identifier.toLowerCase();
    return (
      properties.find(
        (p) =>
          (p.city || "").toLowerCase().includes(id) ||
          (p.address || "").toLowerCase().includes(id)
      ) || null
    );
  }
  return properties[0] || null;
}

/**
 * Get properties for comparison.
 */
export function getCompareProperties(
  properties: Property[],
  indices: number[]
): Property[] {
  return indices
    .filter((i) => i >= 0 && i < properties.length)
    .map((i) => properties[i]);
}

/**
 * Describe a filter in human-readable form.
 */
export function describeFilter(params: FilterParams, locale: string = "fr"): string {
  const parts: string[] = [];
  if (params.field && params.operator && params.value != null) {
    const fieldName = locale === "fr"
      ? { price: "prix", sqft: "surface", bedrooms: "chambres", bathrooms: "sdb", pricePerSqm: "\u20ac/m\u00b2" }[params.field] || params.field
      : params.field;
    const opName = { min: "\u2265", max: "\u2264", eq: "=", gt: ">", lt: "<" }[params.operator] || params.operator;
    parts.push(`${fieldName} ${opName} ${params.value}`);
  }
  if (params.excludeTypes?.length) parts.push(`sans ${params.excludeTypes.join(", ")}`);
  if (params.sourceFilter) parts.push(`source: ${params.sourceFilter}`);
  return parts.join(", ") || "filtre actif";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getFieldValue(
  p: Property,
  field?: string
): number | null {
  switch (field) {
    case "price": return p.price > 0 ? p.price : null;
    case "sqft": return p.sqft > 0 ? p.sqft : null;
    case "bedrooms": return p.bedrooms > 0 ? p.bedrooms : null;
    case "bathrooms": return p.bathrooms > 0 ? p.bathrooms : null;
    case "pricePerSqm": return p.pricePerSqm && p.pricePerSqm > 0 ? p.pricePerSqm : null;
    default: return null;
  }
}
