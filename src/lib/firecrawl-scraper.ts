import Firecrawl from "firecrawl";
import type { ScrapedListing } from "./types";

let firecrawlInstance: Firecrawl | null = null;

function getFirecrawl(): Firecrawl {
  if (firecrawlInstance) return firecrawlInstance;
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }
  firecrawlInstance = new Firecrawl({ apiKey });
  return firecrawlInstance;
}

// ── Price parsing ────────────────────────────────────────────────────────────

function parsePrice(markdown: string): number {
  // Try labeled price patterns first
  const labeledPatterns = [
    /(?:loyer|prix|price|rent|miete)[:\s]*([\d\s.]+)\s*€/i,
    /(?:loyer|prix|price|rent|miete)[:\s]*€\s*([\d\s.,]+)/i,
  ];

  for (const pattern of labeledPatterns) {
    const m = markdown.match(pattern);
    if (m) {
      const val = cleanPriceString(m[1]);
      if (val > 0) return val;
    }
  }

  // General price patterns — pick the first significant one
  const generalPatterns = [
    /([\d\s.]+)\s*€\s*(?:\/\s*mois)?/g,
    /€\s*([\d\s.,]+)/g,
  ];

  for (const pattern of generalPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const val = cleanPriceString(match[1]);
      // Skip tiny numbers (likely not prices) and huge ones (likely phone numbers)
      if (val >= 100 && val <= 50_000_000) return val;
    }
  }

  return 0;
}

function cleanPriceString(raw: string): number {
  // Remove spaces, then handle European number format
  // "2 600" -> 2600, "899.000" -> 899000, "2,600" -> 2600
  const cleaned = raw.replace(/\s/g, "");

  // If it has a dot followed by exactly 3 digits at end, it's a thousands separator
  if (/^\d+\.\d{3}$/.test(cleaned)) {
    return parseInt(cleaned.replace(/\./g, "")) || 0;
  }
  // If it has a comma followed by exactly 3 digits at end, thousands separator
  if (/^\d+,\d{3}$/.test(cleaned)) {
    return parseInt(cleaned.replace(/,/g, "")) || 0;
  }

  return parseInt(cleaned.replace(/[.,]/g, "")) || 0;
}

// ── Surface parsing ──────────────────────────────────────────────────────────

function parseSurface(markdown: string): number {
  const patterns = [
    /(?:surface\s*(?:habitable)?|superficie|living\s*area)[:\s]*([\d.,]+)\s*m[²2]/i,
    /(\d{2,5})\s*m[²2]/,  // Require at least 2 digits to avoid matching single digits
  ];

  for (const pattern of patterns) {
    const m = markdown.match(pattern);
    if (m) {
      const val = parseFloat(m[1].replace(",", "."));
      if (val >= 5 && val < 100_000) return val;  // min 5m² for a real property
    }
  }

  return 0;
}

// ── Property type detection ──────────────────────────────────────────────────

function detectPropertyType(text: string): string {
  const lower = text.toLowerCase();
  if (/bureau|office|cabinet/i.test(lower)) return "Office";
  if (/appartement|apartment|flat/i.test(lower)) return "Apartment";
  if (/maison|house|villa/i.test(lower)) return "House";
  if (/studio/i.test(lower)) return "Studio";
  if (/terrain|land/i.test(lower)) return "Land";
  if (/commerce|commercial|retail|magasin/i.test(lower)) return "Commercial";
  if (/duplex/i.test(lower)) return "Duplex";
  if (/penthouse/i.test(lower)) return "Penthouse";
  if (/loft/i.test(lower)) return "Loft";
  if (/garage|parking/i.test(lower)) return "Parking";
  return "Property";
}

// ── Contract type detection ──────────────────────────────────────────────────

function detectContractType(text: string): "rent" | "buy" {
  const lower = text.toLowerCase();
  if (/\b(louer|location|rent|à louer|en location|for rent|mieten|\/mois|\/month)\b/.test(lower)) {
    return "rent";
  }
  return "buy";
}

// ── City extraction from URL ─────────────────────────────────────────────────

function extractCityFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    // athome.lu pattern: /en/rent/office/mondorf-les-bains/...
    // immotop.lu pattern: /en/annonces/location/bureau/mondorf-les-bains/...
    const segments = path.split("/").filter(Boolean);
    for (const segment of segments) {
      // Skip common path segments
      if (
        /^(en|fr|de|rent|buy|sale|location|vente|achat|louer|vendre|annonces|office|bureau|apartment|appartement|maison|house|studio|terrain|land|commercial|commerce|id[-_]?\d+|\d+)$/i.test(
          segment
        )
      ) {
        continue;
      }
      // City names typically have letters and hyphens, no digits
      if (/^[a-z-]+$/.test(segment) && segment.length > 2 && !segment.startsWith("id")) {
        // Capitalize each word
        return segment
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("-");
      }
    }
  } catch {
    // ignore
  }
  return "";
}

// ── Rooms parsing ────────────────────────────────────────────────────────────

function parseRooms(markdown: string): number {
  const patterns = [
    /(\d+)\s*(?:rooms?|chambres?|pièces?|ch\b|bedrooms?)/i,
    /(?:rooms?|chambres?|pièces?|bedrooms?)[:\s]*(\d+)/i,
  ];
  for (const pattern of patterns) {
    const m = markdown.match(pattern);
    if (m) {
      const val = parseInt(m[1]);
      if (val > 0 && val < 100) return val;
    }
  }
  return 0;
}

function parseBathrooms(markdown: string): number {
  const patterns = [
    /(\d+)\s*(?:bathrooms?|salle[s]?\s*de\s*bain|bains?|sdb)/i,
    /(?:bathrooms?|salle[s]?\s*de\s*bain|bains?|sdb)[:\s]*(\d+)/i,
  ];
  for (const pattern of patterns) {
    const m = markdown.match(pattern);
    if (m) {
      const val = parseInt(m[1]);
      if (val > 0 && val < 50) return val;
    }
  }
  return 0;
}

// ── Description extraction ───────────────────────────────────────────────────

function extractDescription(markdown: string): string {
  // Get the first meaningful paragraph (skip short lines, headers, nav items)
  const lines = markdown.split("\n").map((l) => l.trim());
  for (const line of lines) {
    // Skip empty lines, headers, short lines, links-only lines
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith(")")) continue;
    if (line.startsWith("!")) continue;
    if (line.length < 40) continue;
    // This looks like a content paragraph
    return line.slice(0, 300);
  }
  return "";
}

// ── Main scraping function ───────────────────────────────────────────────────

export async function scrapeListingUrl(
  url: string
): Promise<ScrapedListing | null> {
  try {
    const app = getFirecrawl();
    const result = await app.scrape(url, {
      formats: ["markdown"],
      timeout: 15000,
    });

    const markdown = result.markdown || "";
    const metadata = result.metadata || {};

    if (!markdown && !metadata.title) return null;

    const fullText = `${metadata.title || ""} ${metadata.ogTitle || ""} ${markdown}`;

    const price = parsePrice(fullText);
    // Parse surface from title first (more reliable), then markdown
    const titleSurface = parseSurface(metadata.title || metadata.ogTitle || "");
    const surface = titleSurface > 0 ? titleSurface : parseSurface(markdown);
    const propertyType = detectPropertyType(
      metadata.title || metadata.ogTitle || markdown.slice(0, 500)
    );
    const contractType = detectContractType(
      metadata.title || metadata.ogTitle || markdown.slice(0, 1000)
    );
    const rooms = parseRooms(markdown);
    const bathrooms = parseBathrooms(markdown);
    const imageUrl = (metadata.ogImage as string) || null;
    const description =
      (metadata.ogDescription as string) ||
      extractDescription(markdown);

    // City: try metadata, then URL path
    let city = "";
    // Some portals put city in the title like "Bureau | Mondorf-Les-Bains"
    const titleParts = (metadata.title || "").split(/[|•–—]/);
    if (titleParts.length >= 2) {
      const candidate = titleParts[1].trim();
      if (candidate && !/athome|immotop|wortimmo|vivi/i.test(candidate)) {
        city = candidate;
      }
    }
    if (!city) {
      city = extractCityFromUrl(url);
    }

    const hostname = new URL(url).hostname.replace("www.", "");

    return {
      url,
      source: hostname,
      price,
      surface,
      rooms,
      bathrooms,
      propertyType,
      city,
      address: city,
      imageUrl,
      contractType,
      description,
    };
  } catch {
    return null;
  }
}

// ── Batch scraping ───────────────────────────────────────────────────────────

const BATCH_SIZE = 4;

export async function scrapeMultipleUrls(
  urls: string[]
): Promise<ScrapedListing[]> {
  const results: ScrapedListing[] = [];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((url) => scrapeListingUrl(url))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}
