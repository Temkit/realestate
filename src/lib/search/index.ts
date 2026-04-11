/**
 * Search engine — Luxembourg real estate search pipeline.
 *
 * Architecture:
 *   pipeline.ts      → orchestration (steps 1-9)
 *   brave.ts         → URL discovery from 4 portals
 *   og-fetch.ts      → free og:image/title extraction
 *   gemini-reader.ts → batch page reading via Gemini URL Context
 *   firecrawl-images.ts → image fallback for JS-rendered pages
 *   dedup.ts         → cross-portal deduplication
 *   insights.ts      ��� data-driven badges
 *   enrichment.ts    → AI summary + per-property insights
 *   converter.ts     → ScrapedListing → Property
 */

export { runPipeline } from "./pipeline";
export { deduplicateListings, excludePrimaryResults } from "./dedup";
export type { DedupedListing } from "./dedup";
export type { AIEnrichment } from "./enrichment";
