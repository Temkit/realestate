import { Redis } from "@upstash/redis";
import type { ScrapedListing, SearchResult } from "./types";

// ── Redis client (persistent across cold starts) ────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ── TTLs ────────────────────────────────────────────────────────────────────

const SEARCH_TTL = 24 * 60 * 60;       // 24 hours (seconds)
const SCRAPE_TTL = 7 * 24 * 60 * 60;   // 7 days
const OG_TTL = 7 * 24 * 60 * 60;       // 7 days
const IMAGE_TTL = 7 * 24 * 60 * 60;    // 7 days
const PARSE_TTL = 24 * 60 * 60;        // 24 hours

// ── In-memory fallback (same process only) ──────────────────────────────────

const memSearch = new Map<string, { result: SearchResult; ts: number }>();
const memScrape = new Map<string, { listing: ScrapedListing; ts: number }>();
const memOg = new Map<string, { data: OgData; ts: number }>();
const memImage = new Map<string, { url: string; ts: number }>();
const memParse = new Map<string, { data: ParsedQuery; ts: number }>();

function memExpired(ts: number, ttlMs: number): boolean {
  return Date.now() - ts > ttlMs;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface OgData {
  ogImage: string | null;
  ogTitle: string | null;
  price: number;
  surface: number;
}

export interface ParsedQuery {
  enrichedQuery: string;
  parsed: {
    commune: string | null;
    neighborhood: string | null;
    propertyType: string | null;
    transactionType: "buy" | "rent" | "any";
    cleanedQuery: string;
  };
}

// ── Key builders ────────────────────────────────────────────────────────────

export function buildSearchCacheKey(query: string, mode: string): string {
  const normalized = query.toLowerCase().trim().split(/\s+/).sort().join("|");
  return `search:${normalized}:${mode}`;
}

function scrapeKey(url: string): string { return `scrape:${url}`; }
function ogKey(url: string): string { return `og:${url}`; }
function imageKey(url: string): string { return `img:${url}`; }
function parseKey(query: string): string { return `parse:${query.toLowerCase().trim()}`; }

// ── Search cache (full results, 24h) ────────────────────────────────────────

export async function getSearchCache(key: string): Promise<SearchResult | null> {
  const r = getRedis();
  if (r) {
    try {
      const data = await r.get<SearchResult>(key);
      if (data) return data;
    } catch { /* fall through to memory */ }
  }
  const mem = memSearch.get(key);
  if (mem && !memExpired(mem.ts, SEARCH_TTL * 1000)) return mem.result;
  if (mem) memSearch.delete(key);
  return null;
}

export async function setSearchCache(key: string, result: SearchResult): Promise<void> {
  memSearch.set(key, { result, ts: Date.now() });
  const r = getRedis();
  if (r) {
    try { await r.set(key, result, { ex: SEARCH_TTL }); } catch { /* ignore */ }
  }
}

// ── Scrape cache (individual listings, 7d) ──────────────────────────────────

export async function getScrapeCache(url: string): Promise<ScrapedListing | null> {
  const k = scrapeKey(url);
  const r = getRedis();
  if (r) {
    try {
      const data = await r.get<ScrapedListing>(k);
      if (data) return data;
    } catch { /* fall through */ }
  }
  const mem = memScrape.get(url);
  if (mem && !memExpired(mem.ts, SCRAPE_TTL * 1000)) return mem.listing;
  if (mem) memScrape.delete(url);
  return null;
}

export async function setScrapeCache(url: string, listing: ScrapedListing): Promise<void> {
  memScrape.set(url, { listing, ts: Date.now() });
  const r = getRedis();
  if (r) {
    try { await r.set(scrapeKey(url), listing, { ex: SCRAPE_TTL }); } catch { /* ignore */ }
  }
}

export async function checkScrapeCache(urls: string[]): Promise<{
  cached: ScrapedListing[];
  uncached: string[];
}> {
  const cached: ScrapedListing[] = [];
  const uncached: string[] = [];
  for (const url of urls) {
    const entry = await getScrapeCache(url);
    if (entry) cached.push(entry);
    else uncached.push(url);
  }
  return { cached, uncached };
}

// ── OG cache (og:image + title data, 7d) ───────────────────────────────────

export async function getOgCache(url: string): Promise<OgData | null> {
  const k = ogKey(url);
  const r = getRedis();
  if (r) {
    try {
      const data = await r.get<OgData>(k);
      if (data) return data;
    } catch { /* fall through */ }
  }
  const mem = memOg.get(url);
  if (mem && !memExpired(mem.ts, OG_TTL * 1000)) return mem.data;
  if (mem) memOg.delete(url);
  return null;
}

export async function setOgCache(url: string, data: OgData): Promise<void> {
  memOg.set(url, { data, ts: Date.now() });
  const r = getRedis();
  if (r) {
    try { await r.set(ogKey(url), data, { ex: OG_TTL }); } catch { /* ignore */ }
  }
}

// ── Image cache (Firecrawl image URLs, 7d) ──────────────────────────────────

export async function getImageCache(url: string): Promise<string | null> {
  const k = imageKey(url);
  const r = getRedis();
  if (r) {
    try {
      const data = await r.get<string>(k);
      if (data) return data;
    } catch { /* fall through */ }
  }
  const mem = memImage.get(url);
  if (mem && !memExpired(mem.ts, IMAGE_TTL * 1000)) return mem.url;
  if (mem) memImage.delete(url);
  return null;
}

export async function setImageCache(url: string, imageUrl: string): Promise<void> {
  memImage.set(url, { url: imageUrl, ts: Date.now() });
  const r = getRedis();
  if (r) {
    try { await r.set(imageKey(url), imageUrl, { ex: IMAGE_TTL }); } catch { /* ignore */ }
  }
}

// ── Parse cache (Gemini query parsing, 24h) ─────────────────────────────────

export async function getParseCache(query: string): Promise<ParsedQuery | null> {
  const k = parseKey(query);
  const r = getRedis();
  if (r) {
    try {
      const data = await r.get<ParsedQuery>(k);
      if (data) return data;
    } catch { /* fall through */ }
  }
  const mem = memParse.get(query);
  if (mem && !memExpired(mem.ts, PARSE_TTL * 1000)) return mem.data;
  if (mem) memParse.delete(query);
  return null;
}

export async function setParseCache(query: string, data: ParsedQuery): Promise<void> {
  memParse.set(query, { data, ts: Date.now() });
  const r = getRedis();
  if (r) {
    try { await r.set(parseKey(query), data, { ex: PARSE_TTL }); } catch { /* ignore */ }
  }
}
