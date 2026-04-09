import type { ScrapedListing, SearchResult } from "./types";

// ── Keyword Cache (24 hours TTL) ─────────────────────────────────────────────
const KEYWORD_CACHE_TTL = 24 * 60 * 60 * 1000;

const keywordCache = new Map<
  string,
  { result: SearchResult; timestamp: number }
>();

// ── URL Scrape Cache (7 days TTL) ────────────────────────────────────────────
const SCRAPE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const scrapeCache = new Map<
  string,
  { listing: ScrapedListing; timestamp: number }
>();

// ── Keyword cache operations ─────────────────────────────────────────────────

export function buildSearchCacheKey(query: string, mode: string): string {
  const normalized = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .sort()
    .join("|");
  return `${normalized}|${mode}`;
}

export function getSearchCache(key: string): SearchResult | null {
  const entry = keywordCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > KEYWORD_CACHE_TTL) {
    keywordCache.delete(key);
    return null;
  }
  return entry.result;
}

export function setSearchCache(key: string, result: SearchResult): void {
  keywordCache.set(key, { result, timestamp: Date.now() });
}

// ── Scrape cache operations ──────────────────────────────────────────────────

export function getScrapeCache(url: string): ScrapedListing | null {
  const entry = scrapeCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SCRAPE_CACHE_TTL) {
    scrapeCache.delete(url);
    return null;
  }
  return entry.listing;
}

export function setScrapeCache(url: string, listing: ScrapedListing): void {
  scrapeCache.set(url, { listing, timestamp: Date.now() });
}

/**
 * Partition listing URLs into cached and uncached.
 */
export function checkScrapeCache(urls: string[]): {
  cached: ScrapedListing[];
  uncached: string[];
} {
  const cached: ScrapedListing[] = [];
  const uncached: string[] = [];

  for (const url of urls) {
    const entry = getScrapeCache(url);
    if (entry) {
      cached.push(entry);
    } else {
      uncached.push(url);
    }
  }

  return { cached, uncached };
}
