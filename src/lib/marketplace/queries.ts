/**
 * Marketplace data access — all admin CRUD goes through here.
 * Parameterized queries only; JSON columns are parsed at the boundary.
 */

import type { Row } from "@libsql/client";
import { requireMarketplaceDb } from "./db";
import type {
  BookingSettings,
  Category,
  Offer,
  Provider,
  Vertical,
} from "./types";

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ── Verticals & categories ────────────────────────────────────────────

function rowToVertical(r: Row): Vertical {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name_en: String(r.name_en),
    name_fr: String(r.name_fr),
    attribute_schema: parseJson(r.attribute_schema, {}),
    lead_form_schema: parseJson(r.lead_form_schema, {}),
    booking_enabled: Number(r.booking_enabled) === 1,
    active: Number(r.active) === 1,
    sort: Number(r.sort),
  };
}

export async function listVerticals(): Promise<Vertical[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT * FROM verticals ORDER BY sort, slug",
    args: [],
  });
  return res.rows.map(rowToVertical);
}

function rowToCategory(r: Row): Category {
  return {
    id: Number(r.id),
    vertical_id: Number(r.vertical_id),
    slug: String(r.slug),
    name_en: String(r.name_en),
    name_fr: String(r.name_fr),
    active: Number(r.active) === 1,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT * FROM categories ORDER BY vertical_id, slug",
    args: [],
  });
  return res.rows.map(rowToCategory);
}

export async function createVertical(input: {
  slug: string;
  name_en: string;
  name_fr: string;
  sort: number;
}): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO verticals (slug, name_en, name_fr, sort, active) VALUES (?, ?, ?, ?, 0)`,
    args: [input.slug, input.name_en, input.name_fr, input.sort],
  });
}

export async function createCategory(input: {
  vertical_id: number;
  slug: string;
  name_en: string;
  name_fr: string;
}): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO categories (vertical_id, slug, name_en, name_fr) VALUES (?, ?, ?, ?)`,
    args: [input.vertical_id, input.slug, input.name_en, input.name_fr],
  });
}

export async function setCategoryActive(id: number, active: boolean): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "UPDATE categories SET active = ? WHERE id = ?",
    args: [active ? 1 : 0, id],
  });
}

export async function setVerticalFlags(
  id: number,
  flags: { active?: boolean; booking_enabled?: boolean }
): Promise<void> {
  const db = requireMarketplaceDb();
  if (flags.active !== undefined) {
    await db.execute({
      sql: "UPDATE verticals SET active = ? WHERE id = ?",
      args: [flags.active ? 1 : 0, id],
    });
  }
  if (flags.booking_enabled !== undefined) {
    await db.execute({
      sql: "UPDATE verticals SET booking_enabled = ? WHERE id = ?",
      args: [flags.booking_enabled ? 1 : 0, id],
    });
  }
}

// ── Providers ─────────────────────────────────────────────────────────

function rowToProvider(r: Row): Provider {
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
    photos: parseJson(r.photos, []),
    description_en: (r.description_en as string) || null,
    description_fr: (r.description_fr as string) || null,
    languages: parseJson(r.languages, []),
    status: r.status as Provider["status"],
    plan: r.plan as Provider["plan"],
    cpl_cents: r.cpl_cents === null ? null : Number(r.cpl_cents),
    sales_rep: (r.sales_rep as string) || null,
    signed_at: (r.signed_at as string) || null,
    notes: (r.notes as string) || null,
    source: (r.source as string) || null,
    source_ref: (r.source_ref as string) || null,
    opening_hours: (r.opening_hours as string) || null,
    lat: r.lat == null ? null : Number(r.lat),
    lon: r.lon == null ? null : Number(r.lon),
    created_at: String(r.created_at),
    updated_at: (r.updated_at as string) || null,
  };
}

export async function listProviders(filter?: {
  status?: string;
  verticalId?: number;
}): Promise<Provider[]> {
  const db = requireMarketplaceDb();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter?.status) {
    where.push("p.status = ?");
    args.push(filter.status);
  }
  if (filter?.verticalId) {
    where.push(
      `p.id IN (SELECT pc.provider_id FROM provider_categories pc
        JOIN categories c ON c.id = pc.category_id WHERE c.vertical_id = ?)`
    );
    args.push(filter.verticalId);
  }
  const res = await db.execute({
    sql: `SELECT p.* FROM providers p
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY p.created_at DESC`,
    args,
  });
  return res.rows.map(rowToProvider);
}

export async function getProvider(id: number): Promise<Provider | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT * FROM providers WHERE id = ?",
    args: [id],
  });
  return res.rows.length ? rowToProvider(res.rows[0]) : null;
}

export interface ProviderInput {
  slug: string;
  name: string;
  vat_number: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  commune: string | null;
  logo_url: string | null;
  description_en: string | null;
  description_fr: string | null;
  languages: string[];
  status: string;
  plan: string;
  cpl_cents: number | null;
  sales_rep: string | null;
  signed_at: string | null;
  notes: string | null;
}

export async function createProvider(input: ProviderInput): Promise<number> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `INSERT INTO providers (
            slug, name, vat_number, email, phone, whatsapp, website, address,
            commune, logo_url, description_en, description_fr, languages,
            status, plan, cpl_cents, sales_rep, signed_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      input.slug, input.name, input.vat_number, input.email, input.phone,
      input.whatsapp, input.website, input.address, input.commune,
      input.logo_url, input.description_en, input.description_fr,
      JSON.stringify(input.languages), input.status, input.plan,
      input.cpl_cents, input.sales_rep, input.signed_at, input.notes,
    ],
  });
  return Number(res.rows[0].id);
}

export async function updateProvider(id: number, input: ProviderInput): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `UPDATE providers SET
            slug = ?, name = ?, vat_number = ?, email = ?, phone = ?,
            whatsapp = ?, website = ?, address = ?, commune = ?, logo_url = ?,
            description_en = ?, description_fr = ?, languages = ?, status = ?,
            plan = ?, cpl_cents = ?, sales_rep = ?, signed_at = ?, notes = ?,
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      input.slug, input.name, input.vat_number, input.email, input.phone,
      input.whatsapp, input.website, input.address, input.commune,
      input.logo_url, input.description_en, input.description_fr,
      JSON.stringify(input.languages), input.status, input.plan,
      input.cpl_cents, input.sales_rep, input.signed_at, input.notes, id,
    ],
  });
}

export async function getProviderCategoryIds(providerId: number): Promise<number[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT category_id FROM provider_categories WHERE provider_id = ?",
    args: [providerId],
  });
  return res.rows.map((r) => Number(r.category_id));
}

export async function setProviderCategories(
  providerId: number,
  categoryIds: number[]
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.batch([
    {
      sql: "DELETE FROM provider_categories WHERE provider_id = ?",
      args: [providerId],
    },
    ...categoryIds.map((cid) => ({
      sql: "INSERT INTO provider_categories (provider_id, category_id) VALUES (?, ?)",
      args: [providerId, cid],
    })),
  ]);
}

export async function getProviderCoverage(providerId: number): Promise<string[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT commune_slug FROM provider_coverage WHERE provider_id = ?",
    args: [providerId],
  });
  return res.rows.map((r) => String(r.commune_slug));
}

export async function setProviderCoverage(
  providerId: number,
  communes: string[]
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.batch([
    {
      sql: "DELETE FROM provider_coverage WHERE provider_id = ?",
      args: [providerId],
    },
    ...communes.map((slug) => ({
      sql: "INSERT INTO provider_coverage (provider_id, commune_slug) VALUES (?, ?)",
      args: [providerId, slug],
    })),
  ]);
}

// ── Offers ────────────────────────────────────────────────────────────

function rowToOffer(r: Row): Offer {
  return {
    id: Number(r.id),
    provider_id: Number(r.provider_id),
    category_id: Number(r.category_id),
    title_en: String(r.title_en),
    title_fr: String(r.title_fr),
    price_type: r.price_type as Offer["price_type"],
    price_cents: r.price_cents === null ? null : Number(r.price_cents),
    attributes: parseJson(r.attributes, {}),
    active: Number(r.active) === 1,
    created_at: String(r.created_at),
    updated_at: (r.updated_at as string) || null,
  };
}

export async function listOffers(providerId: number): Promise<Offer[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT * FROM offers WHERE provider_id = ? ORDER BY created_at DESC",
    args: [providerId],
  });
  return res.rows.map(rowToOffer);
}

export async function createOffer(input: {
  provider_id: number;
  category_id: number;
  title_en: string;
  title_fr: string;
  price_type: string;
  price_cents: number | null;
  attributes: Record<string, unknown>;
}): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO offers (provider_id, category_id, title_en, title_fr, price_type, price_cents, attributes)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.provider_id, input.category_id, input.title_en, input.title_fr,
      input.price_type, input.price_cents, JSON.stringify(input.attributes),
    ],
  });
}

export async function setOfferActive(id: number, active: boolean): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "UPDATE offers SET active = ?, updated_at = datetime('now') WHERE id = ?",
    args: [active ? 1 : 0, id],
  });
}

// ── Booking settings ──────────────────────────────────────────────────

export async function getBookingSettings(
  providerId: number
): Promise<BookingSettings | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT * FROM booking_settings WHERE provider_id = ?",
    args: [providerId],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return {
    provider_id: Number(r.provider_id),
    mode: r.mode as BookingSettings["mode"],
    slot_minutes: Number(r.slot_minutes),
    buffer_minutes: Number(r.buffer_minutes),
    min_lead_hours: Number(r.min_lead_hours),
    max_horizon_days: Number(r.max_horizon_days),
  };
}

export async function upsertBookingSettings(
  providerId: number,
  s: Omit<BookingSettings, "provider_id">
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO booking_settings (provider_id, mode, slot_minutes, buffer_minutes, min_lead_hours, max_horizon_days)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(provider_id) DO UPDATE SET
            mode = excluded.mode,
            slot_minutes = excluded.slot_minutes,
            buffer_minutes = excluded.buffer_minutes,
            min_lead_hours = excluded.min_lead_hours,
            max_horizon_days = excluded.max_horizon_days`,
    args: [
      providerId, s.mode, s.slot_minutes, s.buffer_minutes,
      s.min_lead_hours, s.max_horizon_days,
    ],
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────

export async function getDashboardCounts(): Promise<{
  providers: number;
  activeProviders: number;
  offers: number;
  leads: number;
}> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM providers) AS providers,
            (SELECT COUNT(*) FROM providers WHERE status = 'active') AS active_providers,
            (SELECT COUNT(*) FROM offers WHERE active = 1) AS offers,
            (SELECT COUNT(*) FROM leads) AS leads`,
    args: [],
  });
  const r = res.rows[0];
  return {
    providers: Number(r.providers),
    activeProviders: Number(r.active_providers),
    offers: Number(r.offers),
    leads: Number(r.leads),
  };
}
