/**
 * Brave Search — discovers listing URLs from 4 Luxembourg real estate portals.
 * Returns raw URLs + titles, no data extraction.
 */

const PORTALS = ["athome.lu", "immotop.lu", "wortimmo.lu", "vivi.lu"] as const;

export interface BraveResult {
  url: string;
  title: string;
  description: string;
}

// URL patterns that identify individual listing pages (not search/category pages)
const LISTING_PATTERNS: Record<string, RegExp> = {
  "athome.lu": /id-\d+/,
  "immotop.lu": /\/annonces\/\d+/,
  "wortimmo.lu": /id_\d+/,
  "vivi.lu": /\/\d{4,}\/?$/,
};

async function braveSearch(query: string): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error("BRAVE_API_KEY is not configured");

  const params = new URLSearchParams({
    q: query,
    count: "10",
    search_lang: "fr",
    country: "ALL",
    result_filter: "web",
  });

  const resp = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.web?.results || []).map(
    (item: { url?: string; title?: string; description?: string }) => ({
      url: item.url || "",
      title: item.title || "",
      description: item.description || "",
    })
  );
}

/**
 * Search all 4 Luxembourg portals in parallel.
 * Deduplicates by URL across portals.
 */
export async function discoverUrls(query: string): Promise<BraveResult[]> {
  const searches = PORTALS.map((portal) =>
    braveSearch(`site:${portal} ${query} Luxembourg`)
  );

  const results = await Promise.allSettled(searches);
  const allResults: BraveResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const r of result.value) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          allResults.push(r);
        }
      }
    }
  }

  return allResults;
}

export function isListingUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [portal, pattern] of Object.entries(LISTING_PATTERNS)) {
      if (hostname.includes(portal))
        return pattern.test(url) && !/agences/.test(url);
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function isImmotopCategoryUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    const p = new URL(url).pathname;
    return (
      h.includes("immotop.lu") &&
      !isListingUrl(url) &&
      !/agences|prix-immobilier|communes|search/.test(p) &&
      p.length > 5
    );
  } catch {
    return false;
  }
}

/**
 * Filter Brave results to only individual listing URLs (not category/search pages).
 * Deduplicates and caps at 15 URLs.
 */
export function filterListingUrls(results: BraveResult[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const result of results) {
    if (!result.url || seen.has(result.url)) continue;
    if (isListingUrl(result.url)) {
      seen.add(result.url);
      urls.push(result.url);
    }
  }
  return urls.slice(0, 15);
}
