/**
 * Provider-portal data access — EVERY function is scoped to the
 * authenticated provider_id (OWASP A01: no cross-provider access).
 * Callers pass the id from requireProvider(); never from user input.
 */

import { requireMarketplaceDb } from "./db";
import type { AppointmentStatus, DispatchStatus, Provider } from "./types";
import { getProvider } from "./queries";

export async function getProviderByEmail(email: string): Promise<Provider | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    // Match is case-insensitive; only active providers may log in
    sql: "SELECT id FROM providers WHERE lower(email) = lower(?) AND status = 'active' LIMIT 1",
    args: [email.trim()],
  });
  if (!res.rows.length) return null;
  return getProvider(Number(res.rows[0].id));
}

export interface ProviderDashboard {
  totalLeads: number;
  newLeads7d: number;
  upcomingAppointments: number;
  activeOffers: number;
}

export async function getProviderDashboard(providerId: number): Promise<ProviderDashboard> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM lead_dispatches WHERE provider_id = ?) AS total_leads,
            (SELECT COUNT(*) FROM lead_dispatches
              WHERE provider_id = ? AND sent_at > datetime('now', '-7 days')) AS new_7d,
            (SELECT COUNT(*) FROM appointments
              WHERE provider_id = ? AND status = 'confirmed'
                AND starts_at > datetime('now')) AS upcoming,
            (SELECT COUNT(*) FROM offers WHERE provider_id = ? AND active = 1) AS active_offers`,
    args: [providerId, providerId, providerId, providerId],
  });
  const r = res.rows[0];
  return {
    totalLeads: Number(r.total_leads),
    newLeads7d: Number(r.new_7d),
    upcomingAppointments: Number(r.upcoming),
    activeOffers: Number(r.active_offers),
  };
}

export interface ProviderLeadRow {
  dispatch_id: number;
  lead_id: string;
  status: DispatchStatus;
  sent_at: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  commune: string | null;
  message: string | null;
  category_name: string | null;
  created_at: string;
}

export async function listProviderLeads(providerId: number): Promise<ProviderLeadRow[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT d.id AS dispatch_id, d.status, d.sent_at,
            l.id AS lead_id, l.name, l.email, l.phone, l.commune, l.message, l.created_at,
            c.name_fr AS category_name
          FROM lead_dispatches d
          JOIN leads l ON l.id = d.lead_id
          LEFT JOIN categories c ON c.id = l.category_id
          WHERE d.provider_id = ? AND d.status != 'pending'
          ORDER BY d.sent_at DESC, l.created_at DESC
          LIMIT 200`,
    args: [providerId],
  });
  return res.rows.map((r) => ({
    dispatch_id: Number(r.dispatch_id),
    lead_id: String(r.lead_id),
    status: r.status as DispatchStatus,
    sent_at: (r.sent_at as string) || null,
    name: String(r.name),
    email: (r.email as string) || null,
    phone: (r.phone as string) || null,
    commune: (r.commune as string) || null,
    message: (r.message as string) || null,
    category_name: (r.category_name as string) || null,
    created_at: String(r.created_at),
  }));
}

/** Mark a dispatch answered/disputed/converted — only if it belongs to the provider. */
export async function providerSetDispatchStatus(
  providerId: number,
  dispatchId: number,
  status: DispatchStatus
): Promise<boolean> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT lead_id FROM lead_dispatches WHERE id = ? AND provider_id = ?`,
    args: [dispatchId, providerId],
  });
  if (!res.rows.length) return false;
  const billable = status === "disputed" ? 0 : 1;
  await db.execute({
    sql: "UPDATE lead_dispatches SET status = ?, billable = ? WHERE id = ? AND provider_id = ?",
    args: [status, billable, dispatchId, providerId],
  });
  await db.execute({
    sql: `INSERT INTO lead_events (lead_id, dispatch_id, event, actor, meta)
          VALUES (?, ?, ?, 'provider', '{}')`,
    args: [String(res.rows[0].lead_id), dispatchId, `provider_${status}`],
  });
  return true;
}

// ── Appointments (scoped) ─────────────────────────────────────────────

export interface ProviderAppointmentRow {
  id: string;
  lead_id: string | null;
  status: AppointmentStatus;
  starts_at: string | null;
  category_name: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  answers: string;
}

export async function listProviderAppointments(
  providerId: number
): Promise<ProviderAppointmentRow[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT a.id, a.lead_id, a.status, a.starts_at,
            c.name_fr AS category_name,
            l.name AS user_name, l.email AS user_email, l.phone AS user_phone,
            l.answers AS answers
          FROM appointments a
          LEFT JOIN categories c ON c.id = a.category_id
          LEFT JOIN leads l ON l.id = a.lead_id
          WHERE a.provider_id = ?
          ORDER BY COALESCE(a.starts_at, a.created_at) DESC
          LIMIT 200`,
    args: [providerId],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    lead_id: (r.lead_id as string) || null,
    status: r.status as AppointmentStatus,
    starts_at: (r.starts_at as string) || null,
    category_name: (r.category_name as string) || null,
    user_name: (r.user_name as string) || null,
    user_email: (r.user_email as string) || null,
    user_phone: (r.user_phone as string) || null,
    answers: String(r.answers ?? "{}"),
  }));
}

/** Load an appointment only if it belongs to the provider (ownership gate). */
export async function getProviderAppointment(
  providerId: number,
  appointmentId: string
): Promise<{ id: string; lead_id: string | null; status: AppointmentStatus; starts_at: string | null } | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT id, lead_id, status, starts_at FROM appointments
          WHERE id = ? AND provider_id = ?`,
    args: [appointmentId, providerId],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return {
    id: String(r.id),
    lead_id: (r.lead_id as string) || null,
    status: r.status as AppointmentStatus,
    starts_at: (r.starts_at as string) || null,
  };
}

// ── Profile (scoped, restricted fields) ───────────────────────────────

export interface ProviderProfileInput {
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  description_fr: string | null;
  description_en: string | null;
  languages: string[];
  logo_url: string | null;
}

/**
 * Provider self-edit: contact + presentation only. slug/status/plan/cpl/
 * vat/commune stay admin-only (billing + routing integrity).
 */
export async function updateProviderProfile(
  providerId: number,
  input: ProviderProfileInput
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `UPDATE providers SET
            phone = ?, whatsapp = ?, website = ?, address = ?,
            description_fr = ?, description_en = ?, languages = ?, logo_url = ?,
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      input.phone, input.whatsapp, input.website, input.address,
      input.description_fr, input.description_en,
      JSON.stringify(input.languages), input.logo_url, providerId,
    ],
  });
}

// ── Offers (scoped) ───────────────────────────────────────────────────

export async function providerOwnsCategory(
  providerId: number,
  categoryId: number
): Promise<boolean> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT 1 FROM provider_categories WHERE provider_id = ? AND category_id = ? LIMIT 1",
    args: [providerId, categoryId],
  });
  return res.rows.length > 0;
}

export async function providerUpdateOffer(
  providerId: number,
  offerId: number,
  input: { title_fr: string; title_en: string; price_type: string; price_cents: number | null }
): Promise<boolean> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `UPDATE offers SET title_fr = ?, title_en = ?, price_type = ?, price_cents = ?,
            updated_at = datetime('now')
          WHERE id = ? AND provider_id = ?`,
    args: [
      input.title_fr, input.title_en, input.price_type, input.price_cents,
      offerId, providerId,
    ],
  });
  return res.rowsAffected > 0;
}

export async function providerSetOfferActive(
  providerId: number,
  offerId: number,
  active: boolean
): Promise<boolean> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "UPDATE offers SET active = ?, updated_at = datetime('now') WHERE id = ? AND provider_id = ?",
    args: [active ? 1 : 0, offerId, providerId],
  });
  return res.rowsAffected > 0;
}
