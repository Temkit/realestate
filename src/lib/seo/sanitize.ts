/**
 * Sanitize property data for public-facing static HTML.
 * Strips sensitive fields that reveal scraping patterns.
 */

import type { Property } from "@/lib/types";
import { createHash } from "crypto";
import { createClient } from "@libsql/client";

/**
 * Generate a short hash for a URL (used for /api/go/[hash] redirects).
 */
export function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 12);
}

/**
 * Strip sensitive fields from properties before rendering in static HTML.
 * - Replaces real listing URLs with /api/go/{hash} redirects
 * - Removes portal hostnames from sources
 * - Keeps all display data (price, address, images, analytics)
 */
export function sanitizeForClient(properties: Property[]): Property[] {
  return properties.map((p) => {
    const primaryUrl = p.listingUrl || p.listingUrls?.[0] || null;
    const safeUrl = primaryUrl ? `/api/go/${hashUrl(primaryUrl)}` : null;

    const safeUrls = (p.listingUrls || []).map(
      (url) => `/api/go/${hashUrl(url)}`
    );

    return {
      ...p,
      // Replace real URLs with hashed redirects
      listingUrl: safeUrl,
      listingUrls: safeUrls.length > 0 ? safeUrls : undefined,
      // Replace portal hostnames with generic labels
      source: p.sources && p.sources.length > 1 ? `${p.sources.length} portals` : "Portal",
      sources: undefined,
      // Remove fuzzy match portal links
      alsoOnPortals: undefined,
    };
  });
}

/**
 * Save URL-to-hash redirects to Turso so /api/go/{hash} can resolve them.
 * Fire-and-forget — never blocks page rendering.
 */
export async function saveRedirects(properties: Property[]): Promise<void> {
  try {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) return;

    const db = createClient({ url, authToken });
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS url_redirects (
        hash TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    });

    const statements = [];
    for (const p of properties) {
      const urls = p.listingUrls || (p.listingUrl ? [p.listingUrl] : []);
      for (const u of urls) {
        if (u && u.startsWith("http")) {
          statements.push({
            sql: "INSERT OR IGNORE INTO url_redirects (hash, url) VALUES (?, ?)",
            args: [hashUrl(u), u],
          });
        }
      }
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }
  } catch {
    /* redirects are optional */
  }
}
