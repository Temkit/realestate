/**
 * Cross-portal deduplication — merges listings of the same property from different portals.
 *
 * Strategy:
 * - Tier 1 (exact match): same price + same surface + same normalized city + same type → auto-merge
 * - Tier 2 (fuzzy match): price ±5%, surface ±10%, same city → link only ("Also on portal.lu")
 *
 * When merging, the best data from each portal is kept:
 * - Best image (first non-null)
 * - Longest description
 * - Most rooms/bathrooms (max)
 * - Most specific address (longest)
 * - All portal URLs collected as sources
 */

import type { ScrapedListing } from "@/lib/types";

export interface DedupedListing extends ScrapedListing {
  /** All portal hostnames where this property was found */
  sources: string[];
  /** All listing URLs across portals */
  listingUrls: string[];
  /** True if 2+ portals report the same price */
  priceVerified: boolean;
  /** Portals with fuzzy match (not merged, just linked) */
  alsoOnPortals: { name: string; url: string }[];
}

function normalizeCity(city: string): string {
  return (city || "")
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .replace(/^commune de /, "")
    .replace(/^ville de /, "")
    .trim();
}

function normalizeType(type: string): string {
  const t = (type || "").toLowerCase();
  if (/bureau|office|cabinet/.test(t)) return "office";
  if (/appartement|apartment|flat/.test(t)) return "apartment";
  if (/maison|house|villa/.test(t)) return "house";
  if (/studio/.test(t)) return "studio";
  return t;
}

/**
 * Build a fingerprint for exact matching.
 * Uses price + surface + normalized city + normalized type.
 */
function fingerprint(l: ScrapedListing): string {
  return `${l.price}_${l.surface}_${normalizeCity(l.city)}_${normalizeType(l.propertyType)}`;
}

/**
 * Merge a group of listings from different portals into one DedupedListing.
 * Picks the best data from each source.
 */
function mergeGroup(group: ScrapedListing[]): DedupedListing {
  const base = { ...group[0] };

  const sources: string[] = [];
  const listingUrls: string[] = [];
  const seenSources = new Set<string>();

  for (const l of group) {
    if (!seenSources.has(l.source)) {
      seenSources.add(l.source);
      sources.push(l.source);
    }
    listingUrls.push(l.url);

    // Best image: first non-null
    if (!base.imageUrl && l.imageUrl) base.imageUrl = l.imageUrl;

    // Longest description
    if (l.description.length > base.description.length)
      base.description = l.description;

    // Most rooms/bathrooms
    if (l.rooms > base.rooms) base.rooms = l.rooms;
    if (l.bathrooms > base.bathrooms) base.bathrooms = l.bathrooms;

    // Most specific address (longest)
    if (l.address.length > base.address.length) base.address = l.address;

    // Most specific city (longest)
    if (l.city.length > base.city.length) base.city = l.city;
  }

  return {
    ...base,
    sources,
    listingUrls,
    priceVerified: sources.length >= 2,
    alsoOnPortals: [],
  };
}

/**
 * Check if two listings are a fuzzy match (probable same property).
 * Price within 5%, surface within 10%, same city.
 */
function isFuzzyMatch(a: ScrapedListing, b: ScrapedListing): boolean {
  if (a.price === 0 || b.price === 0) return false;
  if (a.source === b.source) return false;

  const priceDiff =
    Math.abs(a.price - b.price) / Math.max(a.price, b.price);
  const surfDiff =
    a.surface > 0 && b.surface > 0
      ? Math.abs(a.surface - b.surface) / Math.max(a.surface, b.surface)
      : 1;
  const cityA = normalizeCity(a.city);
  const cityB = normalizeCity(b.city);
  const cityMatch =
    cityA === cityB || cityA.includes(cityB) || cityB.includes(cityA);

  return priceDiff <= 0.05 && surfDiff <= 0.1 && cityMatch;
}

/**
 * Deduplicate listings across portals.
 *
 * 1. Filter out junk (price=0 AND surface=0)
 * 2. Group by exact fingerprint → merge into single DedupedListing
 * 3. Find fuzzy matches between remaining listings → add "also on" links
 */
export function deduplicateListings(
  listings: ScrapedListing[]
): DedupedListing[] {
  // Step 1: Filter junk
  const valid = listings.filter((l) => l.price > 0 || l.surface > 0);

  // Step 2: Group by exact fingerprint
  const groups = new Map<string, ScrapedListing[]>();
  for (const l of valid) {
    const fp = fingerprint(l);
    const group = groups.get(fp) || [];
    group.push(l);
    groups.set(fp, group);
  }

  // Merge each group
  const deduped: DedupedListing[] = [];
  for (const group of groups.values()) {
    deduped.push(mergeGroup(group));
  }

  // Step 3: Find fuzzy matches (link only, don't merge)
  for (let i = 0; i < deduped.length; i++) {
    for (let j = i + 1; j < deduped.length; j++) {
      if (isFuzzyMatch(deduped[i], deduped[j])) {
        // Add cross-references
        for (const url of deduped[j].listingUrls) {
          deduped[i].alsoOnPortals.push({
            name: deduped[j].sources[0] || "",
            url,
          });
        }
        for (const url of deduped[i].listingUrls) {
          deduped[j].alsoOnPortals.push({
            name: deduped[i].sources[0] || "",
            url,
          });
        }
      }
    }
  }

  return deduped;
}

/**
 * Remove listings from expanded search that already appear in primary results.
 * Matches by exact URL or by exact fingerprint.
 */
export function excludePrimaryResults(
  expandedListings: ScrapedListing[],
  primaryListings: ScrapedListing[]
): ScrapedListing[] {
  const primaryUrls = new Set(primaryListings.map((l) => l.url));
  const primaryFingerprints = new Set(primaryListings.map(fingerprint));

  return expandedListings.filter(
    (l) => !primaryUrls.has(l.url) && !primaryFingerprints.has(fingerprint(l))
  );
}
