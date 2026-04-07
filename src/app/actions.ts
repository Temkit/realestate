"use server";

import { searchProperties, searchExpandedProperties, searchWithContext, compareProperties, getNeighborhoodAnalysis } from "@/lib/perplexity";
import type { SearchResult, NeighborhoodData, ConversationTurn } from "@/lib/types";

export async function searchAction(query: string): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  return searchProperties(query);
}

export async function expandedSearchAction(
  query: string,
  preferenceHints: string | null
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  return searchExpandedProperties(query, preferenceHints);
}

/**
 * Extract the first usable image from a listing page.
 * Strategy (in priority order):
 *   1. JSON-LD structured data (most Luxembourg portals embed this)
 *   2. og:image meta tag
 *   3. twitter:image meta tag
 */
export async function fetchListingImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,de;q=0.7",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    const maxBytes = 100_000; // 100KB — JSON-LD can appear deeper in the page

    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // 1. Try JSON-LD — most reliable on Luxembourg portals
    const imageFromJsonLd = extractImageFromJsonLd(html);
    if (imageFromJsonLd) return imageFromJsonLd;

    // 2. Try og:image
    const imageFromOg = extractMetaImage(html, "og:image");
    if (imageFromOg) return imageFromOg;

    // 3. Try twitter:image
    const imageFromTwitter = extractMetaImage(html, "twitter:image");
    if (imageFromTwitter) return imageFromTwitter;

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse all JSON-LD blocks and look for image fields.
 * Handles RealEstateListing, Product, Residence, Apartment, SingleFamilyResidence,
 * and generic schema.org types with image properties.
 */
function extractImageFromJsonLd(html: string): string | null {
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const image = findImageInJsonLd(data);
      if (image) return image;
    } catch {
      // Malformed JSON-LD — skip
    }
  }

  return null;
}

function findImageInJsonLd(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  // Handle arrays (e.g. @graph)
  if (Array.isArray(data)) {
    for (const item of data) {
      const img = findImageInJsonLd(item);
      if (img) return img;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check @graph
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const img = findImageInJsonLd(item);
      if (img) return img;
    }
  }

  // Extract image from this object
  const imageField = obj.image || obj.photo || obj.photos || obj.thumbnailUrl;

  if (typeof imageField === "string" && imageField.startsWith("http")) {
    return imageField;
  }

  if (Array.isArray(imageField)) {
    for (const item of imageField) {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (typeof item === "object" && item !== null) {
        const nested = item as Record<string, unknown>;
        const url = nested.url || nested.contentUrl || nested.thumbnailUrl;
        if (typeof url === "string" && url.startsWith("http")) return url;
      }
    }
  }

  if (typeof imageField === "object" && imageField !== null) {
    const nested = imageField as Record<string, unknown>;
    const url = nested.url || nested.contentUrl || nested.thumbnailUrl;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  return null;
}

/**
 * Extract image URL from meta tags (og:image, twitter:image, etc.)
 * Handles both attribute orderings: property-then-content and content-then-property.
 */
function extractMetaImage(html: string, property: string): string | null {
  // property="og:image" content="..."
  const pattern1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  // content="..." property="og:image"
  const pattern2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );

  const match = html.match(pattern1) || html.match(pattern2);
  if (match?.[1] && match[1].startsWith("http")) {
    return match[1];
  }

  return null;
}

export async function fetchListingImages(
  urls: { id: string; url: string }[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Fetch in parallel, max 6 concurrent
  const batches: { id: string; url: string }[][] = [];
  for (let i = 0; i < urls.length; i += 6) {
    batches.push(urls.slice(i, i + 6));
  }

  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map(async ({ id, url }) => {
        const imageUrl = await fetchListingImage(url);
        if (imageUrl) results[id] = imageUrl;
      })
    );
    // settled is used implicitly — results are populated via closure
    void settled;
  }

  return results;
}

export async function refineSearchAction(
  query: string,
  previousTurns: ConversationTurn[],
  mode: "rent" | "buy"
): Promise<SearchResult> {
  if (!query.trim()) {
    return { properties: [], summary: "", citations: [] };
  }
  return searchWithContext(query, previousTurns, mode);
}

export async function compareAction(
  properties: { address: string; city: string; price: number; sqft: number; bedrooms: number; bathrooms: number; propertyType: string; features: string[] }[]
): Promise<string> {
  return compareProperties(properties);
}

export async function neighborhoodAction(
  address: string,
  city: string,
  state: string
): Promise<NeighborhoodData> {
  return getNeighborhoodAnalysis(address, city, state);
}
