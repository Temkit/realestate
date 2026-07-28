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
          WHERE pc.category_id = ? AND p.status = 'active' ${coverageClause}
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
  // Rank: plan weight → higher rating → name. Unrated providers sort below
  // rated ones at the same plan tier (avg null → -1).
  providers.sort(
    (a, b) =>
      (PLAN_WEIGHT[b.plan] ?? 0) - (PLAN_WEIGHT[a.plan] ?? 0) ||
      (b.rating.avg ?? -1) - (a.rating.avg ?? -1) ||
      a.name.localeCompare(b.name)
  );
  return providers;
}

export async function getActiveProviderBySlug(
  slug: string
): Promise<{ provider: Provider; offers: Offer[]; categoryIds: number[] } | null> {
  const db = getMarketplaceDb();
  if (!db) return null;
  const res = await db.execute({
    sql: "SELECT * FROM providers WHERE slug = ? AND status = 'active'",
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
    created_at: String(r.created_at),
    updated_at: (r.updated_at as string) || null,
  };
}
