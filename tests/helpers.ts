import { createClient, type Client } from "@libsql/client";

/** A fresh client to the test DB for fixture setup + assertions. */
export function testDb(): Client {
  return createClient({ url: process.env.TURSO_DATABASE_URL! });
}

let counter = 0;
export function uniqueSlug(prefix = "p"): string {
  return `${prefix}-${Date.now().toString(36)}-${counter++}`;
}

export async function categoryId(
  db: Client,
  verticalSlug: string,
  catSlug: string
): Promise<number> {
  const r = await db.execute({
    sql: `SELECT c.id FROM categories c JOIN verticals v ON v.id = c.vertical_id
          WHERE v.slug = ? AND c.slug = ?`,
    args: [verticalSlug, catSlug],
  });
  return Number(r.rows[0].id);
}

export async function insertProvider(
  db: Client,
  overrides: Partial<{
    slug: string;
    name: string;
    email: string;
    status: string;
    plan: string;
  }> = {}
): Promise<number> {
  const slug = overrides.slug ?? uniqueSlug();
  const r = await db.execute({
    sql: `INSERT INTO providers (slug, name, email, status, plan)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [
      slug,
      overrides.name ?? slug,
      overrides.email ?? `${slug}@example.com`,
      overrides.status ?? "active",
      overrides.plan ?? "free",
    ],
  });
  return Number(r.rows[0].id);
}

export async function linkCategory(db: Client, providerId: number, catId: number): Promise<void> {
  await db.execute({
    sql: "INSERT INTO provider_categories (provider_id, category_id) VALUES (?, ?)",
    args: [providerId, catId],
  });
}

export async function addCoverage(db: Client, providerId: number, commune: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO provider_coverage (provider_id, commune_slug) VALUES (?, ?)",
    args: [providerId, commune],
  });
}

export async function insertAppointment(
  db: Client,
  providerId: number,
  status = "completed"
): Promise<string> {
  const id = `appt-${uniqueSlug("a")}`;
  await db.execute({
    sql: `INSERT INTO appointments (id, provider_id, status) VALUES (?, ?, ?)`,
    args: [id, providerId, status],
  });
  return id;
}

export async function insertOffer(
  db: Client,
  providerId: number,
  catId: number,
  overrides: Partial<{ price_cents: number; active: number }> = {}
): Promise<number> {
  const r = await db.execute({
    sql: `INSERT INTO offers (provider_id, category_id, title_fr, title_en, price_type, price_cents, active)
          VALUES (?, ?, 'x', 'x', 'fixed', ?, ?) RETURNING id`,
    args: [providerId, catId, overrides.price_cents ?? 1000, overrides.active ?? 1],
  });
  return Number(r.rows[0].id);
}
