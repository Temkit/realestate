/**
 * Public (unauthenticated) marketplace reads — active records only.
 * Used by the SEO pages; every function is safe to expose.
 */

import { getMarketplaceDb } from "./db";
import type { Category, Offer, Provider, Vertical } from "./types";
import {
  listCategories,
  listOffers,
  listVerticals,
} from "./queries";
import { getRatingSummaries, type RatingSummary } from "./reviews";

export async function listActiveVerticals(): Promise<Vertical[]> {
  if (!getMarketplaceDb()) return [];
  const all = await listVerticals();
  return all.filter((v) => v.active);
}

export async function getActiveVerticalBySlug(slug: string): Promise<Vertical | null> {
  const verticals = await listActiveVerticals();
  return verticals.find((v) => v.slug === slug) ?? null;
}

export async function listActiveCategories(verticalId: number): Promise<Category[]> {
  if (!getMarketplaceDb()) return [];
  const all = await listCategories();
  return all.filter((c) => c.vertical_id === verticalId && c.active);
}

export async function getActiveCategoryBySlug(
  verticalId: number,
  slug: string
): Promise<Category | null> {
  const cats = await listActiveCategories(verticalId);
  return cats.find((c) => c.slug === slug) ?? null;
}

export interface PublicProvider extends Provider {
  offers: Offer[];
  rating: RatingSummary;
}

const PLAN_WEIGHT: Record<string, number> = { pro: 2, starter: 1, free: 0 };
// Claimed (active) providers always rank above unclaimed directory listings.
const STATUS_WEIGHT: Record<string, number> = { active: 1, listed: 0 };

/**
 * Active providers serving a category (optionally restricted to a commune),
 * ranked by plan weight then name. Offers are filtered to the category.
 */
export async function listProvidersForCategory(
  categoryId: number,
  communeSlug?: string
): Promise<PublicProvider[]> {
  const db = getMarketplaceDb();
  if (!db) return [];

  const args: (string | number)[] = [categoryId];
  let coverageClause = "";
  if (communeSlug) {
    coverageClause = `AND p.id IN (
      SELECT provider_id FROM provider_coverage
      WHERE commune_slug = '*' OR commune_slug = ?
    )`;
    args.push(communeSlug);
  }

  const res = await db.execute({
    sql: `SELECT p.* FROM providers p
          JOIN provider_categories pc ON pc.provider_id = p.id
          WHERE pc.category_id = ? AND p.status IN ('active', 'listed') ${coverageClause}
          ORDER BY p.name`,
    args,
  });

  const ids = res.rows.map((r) => Number(r.id));
  const ratings = await getRatingSummaries(ids);

  const providers: PublicProvider[] = [];
  for (const row of res.rows) {
    const id = Number(row.id);
    const offers = (await listOffers(id)).filter(
      (o) => o.active && o.category_id === categoryId
    );
    providers.push({
      ...rowToPublicProvider(row as Record<string, unknown>),
      offers,
      rating: ratings.get(id) ?? { avg: null, count: 0 },
    });
  }
  // Rank: claimed(active) over listed → plan weight → higher rating → name.
  providers.sort(
    (a, b) =>
      (STATUS_WEIGHT[b.status] ?? 0) - (STATUS_WEIGHT[a.status] ?? 0) ||
      (PLAN_WEIGHT[b.plan] ?? 0) - (PLAN_WEIGHT[a.plan] ?? 0) ||
      (b.rating.avg ?? -1) - (a.rating.avg ?? -1) ||
      a.name.localeCompare(b.name)
  );
  return providers;
}

/**
 * Browse a whole vertical in one query — optional category + commune filters.
 * Offers are omitted (avoids N+1); the card shows contact/hours/rating.
 */
export async function listProvidersForVertical(
  verticalId: number,
  opts: { categoryId?: number; communeSlug?: string; limit?: number } = {}
): Promise<{ providers: PublicProvider[]; total: number }> {
  const db = getMarketplaceDb();
  if (!db) return { providers: [], total: 0 };

  const where: string[] = ["c.vertical_id = ?", "p.status IN ('active', 'listed')"];
  const args: (string | number)[] = [verticalId];
  if (opts.categoryId) {
    where.push("pc.category_id = ?");
    args.push(opts.categoryId);
  }
  if (opts.communeSlug) {
    where.push(`p.id IN (SELECT provider_id FROM provider_coverage
      WHERE commune_slug = '*' OR commune_slug = ?)`);
    args.push(opts.communeSlug);
  }

  const countRes = await db.execute({
    sql: `SELECT COUNT(DISTINCT p.id) AS n FROM providers p
          JOIN provider_categories pc ON pc.provider_id = p.id
          JOIN categories c ON c.id = pc.category_id
          WHERE ${where.join(" AND ")}`,
    args,
  });
  const total = Number(countRes.rows[0].n);

  const limit = opts.limit ?? 60;
  const res = await db.execute({
    sql: `SELECT DISTINCT p.* FROM providers p
          JOIN provider_categories pc ON pc.provider_id = p.id
          JOIN categories c ON c.id = pc.category_id
          WHERE ${where.join(" AND ")}
          ORDER BY (p.status = 'active') DESC, p.name
          LIMIT ?`,
    args: [...args, limit],
  });

  const ids = res.rows.map((r) => Number(r.id));
  const ratings = await getRatingSummaries(ids);
  const providers = res.rows.map((row) => ({
    ...rowToPublicProvider(row as Record<string, unknown>),
    offers: [] as Offer[],
    rating: ratings.get(Number(row.id)) ?? { avg: null, count: 0 },
  }));
  return { providers, total };
}

export async function getActiveProviderBySlug(
  slug: string
): Promise<{ provider: Provider; offers: Offer[]; categoryIds: number[] } | null> {
  const db = getMarketplaceDb();
  if (!db) return null;
  const res = await db.execute({
    sql: "SELECT * FROM providers WHERE slug = ? AND status IN ('active', 'listed')",
    args: [slug],
  });
  if (!res.rows.length) return null;
  const provider = rowToPublicProvider(res.rows[0] as Record<string, unknown>);
  const offers = (await listOffers(provider.id)).filter((o) => o.active);
  const cats = await db.execute({
    sql: "SELECT category_id FROM provider_categories WHERE provider_id = ?",
    args: [provider.id],
  });
  return {
    provider,
    offers,
    categoryIds: cats.rows.map((r) => Number(r.category_id)),
  };
}

/** Public provider count per vertical slug (active + listed). */
export async function getVerticalCounts(): Promise<Record<string, number>> {
  const db = getMarketplaceDb();
  if (!db) return {};
  const res = await db.execute({
    sql: `SELECT v.slug, COUNT(DISTINCT p.id) AS n
          FROM providers p
          JOIN provider_categories pc ON pc.provider_id = p.id
          JOIN categories c ON c.id = pc.category_id
          JOIN verticals v ON v.id = c.vertical_id
          WHERE p.status IN ('active', 'listed')
          GROUP BY v.slug`,
    args: [],
  });
  const out: Record<string, number> = {};
  for (const r of res.rows) out[String(r.slug)] = Number(r.n);
  return out;
}

/** Public provider count per category id, for one vertical. */
export async function getCategoryCounts(verticalId: number): Promise<Record<number, number>> {
  const db = getMarketplaceDb();
  if (!db) return {};
  const res = await db.execute({
    sql: `SELECT pc.category_id AS cid, COUNT(DISTINCT p.id) AS n
          FROM providers p
          JOIN provider_categories pc ON pc.provider_id = p.id
          JOIN categories c ON c.id = pc.category_id
          WHERE c.vertical_id = ? AND p.status IN ('active', 'listed')
          GROUP BY pc.category_id`,
    args: [verticalId],
  });
  const out: Record<number, number> = {};
  for (const r of res.rows) out[Number(r.cid)] = Number(r.n);
  return out;
}

export interface FeaturedProvider {
  slug: string;
  name: string;
  commune: string | null;
  phone: string | null;
  status: string;
  vertical_slug: string;
}

/** A handful of recent public providers for the homepage strip. */
export async function listFeaturedProviders(limit = 8): Promise<FeaturedProvider[]> {
  const db = getMarketplaceDb();
  if (!db) return [];
  const res = await db.execute({
    sql: `SELECT p.slug, p.name, p.commune, p.phone, p.status,
            (SELECT v.slug FROM verticals v
             JOIN categories c ON c.vertical_id = v.id
             JOIN provider_categories pc ON pc.category_id = c.id
             WHERE pc.provider_id = p.id LIMIT 1) AS vertical_slug
          FROM providers p
          WHERE p.status IN ('active', 'listed') AND p.commune IS NOT NULL
          ORDER BY (p.status = 'active') DESC, p.created_at DESC
          LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name),
    commune: (r.commune as string) || null,
    phone: (r.phone as string) || null,
    status: String(r.status),
    vertical_slug: (r.vertical_slug as string) || "garages",
  }));
}

export async function isProviderBookable(providerId: number): Promise<boolean> {
  const db = getMarketplaceDb();
  if (!db) return false;
  // P1: every active provider in a booking-enabled vertical is bookable in
  // request mode; a booking_settings row is optional (defaults apply).
  const res = await db.execute({
    sql: `SELECT 1 FROM provider_categories pc
          JOIN categories c ON c.id = pc.category_id
          JOIN verticals v ON v.id = c.vertical_id
          WHERE pc.provider_id = ? AND v.booking_enabled = 1 LIMIT 1`,
    args: [providerId],
  });
  return res.rows.length > 0;
}

function rowToPublicProvider(r: Record<string, unknown>): Provider {
  const parse = <T,>(v: unknown, fb: T): T => {
    if (typeof v !== "string" || !v) return fb;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fb;
    }
  };
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    vat_number: (r.vat_number as string) || null,
    email: String(r.email),
    phone: (r.phone as string) || null,
    whatsapp: (r.whatsapp as string) || null,
    website: (r.website as string) || null,
    address: (r.address as string) || null,
    commune: (r.commune as string) || null,
    logo_url: (r.logo_url as string) || null,
    photos: parse(r.photos, []),
    description_en: (r.description_en as string) || null,
    description_fr: (r.description_fr as string) || null,
    languages: parse(r.languages, []),
    status: r.status as Provider["status"],
    plan: r.plan as Provider["plan"],
    cpl_cents: r.cpl_cents == null ? null : Number(r.cpl_cents),
    sales_rep: (r.sales_rep as string) || null,
    signed_at: (r.signed_at as string) || null,
    notes: null, // never expose internal notes publicly
    source: null,
    source_ref: null,
    opening_hours: (r.opening_hours as string) || null,
    lat: r.lat == null ? null : Number(r.lat),
    lon: r.lon == null ? null : Number(r.lon),
    created_at: String(r.created_at),
    updated_at: (r.updated_at as string) || null,
  };
}
