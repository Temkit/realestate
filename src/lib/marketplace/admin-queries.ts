/**
 * Admin-only reads/writes: leads inbox, appointments board, stats, billing.
 * Callers must be behind requireAdmin().
 */

import { requireMarketplaceDb } from "./db";
import type { AppointmentStatus, DispatchStatus, LeadStatus } from "./types";

export interface AdminLeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commune: string | null;
  status: LeadStatus;
  created_at: string;
  category_name: string | null;
  vertical_name: string | null;
  dispatch_count: number;
  pending_count: number;
}

export async function listLeads(statusFilter?: string): Promise<AdminLeadRow[]> {
  const db = requireMarketplaceDb();
  const where = statusFilter ? "WHERE l.status = ?" : "";
  const res = await db.execute({
    sql: `SELECT l.id, l.name, l.email, l.phone, l.commune, l.status, l.created_at,
            c.name_fr AS category_name, v.name_fr AS vertical_name,
            (SELECT COUNT(*) FROM lead_dispatches d WHERE d.lead_id = l.id) AS dispatch_count,
            (SELECT COUNT(*) FROM lead_dispatches d WHERE d.lead_id = l.id AND d.status = 'pending') AS pending_count
          FROM leads l
          LEFT JOIN categories c ON c.id = l.category_id
          LEFT JOIN verticals v ON v.id = l.vertical_id
          ${where}
          ORDER BY l.created_at DESC
          LIMIT 200`,
    args: statusFilter ? [statusFilter] : [],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: (r.email as string) || null,
    phone: (r.phone as string) || null,
    commune: (r.commune as string) || null,
    status: r.status as LeadStatus,
    created_at: String(r.created_at),
    category_name: (r.category_name as string) || null,
    vertical_name: (r.vertical_name as string) || null,
    dispatch_count: Number(r.dispatch_count),
    pending_count: Number(r.pending_count),
  }));
}

export interface AdminLeadDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commune: string | null;
  message: string | null;
  answers: string;
  locale: string;
  source_page: string | null;
  status: LeadStatus;
  created_at: string;
  category_id: number | null;
  category_name: string | null;
  dispatches: {
    id: number;
    provider_id: number;
    provider_name: string;
    provider_email: string;
    status: DispatchStatus;
    billable: boolean;
    sent_at: string | null;
  }[];
  events: { event: string; actor: string; meta: string; created_at: string }[];
}

export async function getLeadDetail(id: string): Promise<AdminLeadDetail | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT l.*, c.name_fr AS category_name
          FROM leads l LEFT JOIN categories c ON c.id = l.category_id
          WHERE l.id = ?`,
    args: [id],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];

  const dispatches = await db.execute({
    sql: `SELECT d.id, d.provider_id, d.status, d.billable, d.sent_at,
            p.name AS provider_name, p.email AS provider_email
          FROM lead_dispatches d JOIN providers p ON p.id = d.provider_id
          WHERE d.lead_id = ? ORDER BY d.id`,
    args: [id],
  });
  const events = await db.execute({
    sql: `SELECT event, actor, meta, created_at FROM lead_events
          WHERE lead_id = ? ORDER BY id`,
    args: [id],
  });

  return {
    id: String(r.id),
    name: String(r.name),
    email: (r.email as string) || null,
    phone: (r.phone as string) || null,
    commune: (r.commune as string) || null,
    message: (r.message as string) || null,
    answers: String(r.answers ?? "{}"),
    locale: String(r.locale ?? "fr"),
    source_page: (r.source_page as string) || null,
    status: r.status as LeadStatus,
    created_at: String(r.created_at),
    category_id: r.category_id == null ? null : Number(r.category_id),
    category_name: (r.category_name as string) || null,
    dispatches: dispatches.rows.map((d) => ({
      id: Number(d.id),
      provider_id: Number(d.provider_id),
      provider_name: String(d.provider_name),
      provider_email: String(d.provider_email),
      status: d.status as DispatchStatus,
      billable: Number(d.billable) === 1,
      sent_at: (d.sent_at as string) || null,
    })),
    events: events.rows.map((e) => ({
      event: String(e.event),
      actor: String(e.actor),
      meta: String(e.meta ?? "{}"),
      created_at: String(e.created_at),
    })),
  };
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "UPDATE leads SET status = ? WHERE id = ?",
    args: [status, id],
  });
}

export async function setDispatchStatus(
  id: number,
  status: DispatchStatus,
  billable?: boolean
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `UPDATE lead_dispatches SET status = ?${billable !== undefined ? ", billable = " + (billable ? 1 : 0) : ""} WHERE id = ?`,
    args: [status, id],
  });
}

// ── Appointments board ────────────────────────────────────────────────

export interface AdminAppointmentRow {
  id: string;
  lead_id: string | null;
  provider_name: string;
  user_name: string | null;
  category_name: string | null;
  starts_at: string | null;
  status: AppointmentStatus;
  created_at: string;
}

export async function listAppointments(statusFilter?: string): Promise<AdminAppointmentRow[]> {
  const db = requireMarketplaceDb();
  const where = statusFilter ? "WHERE a.status = ?" : "";
  const res = await db.execute({
    sql: `SELECT a.id, a.lead_id, a.starts_at, a.status, a.created_at,
            p.name AS provider_name, l.name AS user_name, c.name_fr AS category_name
          FROM appointments a
          JOIN providers p ON p.id = a.provider_id
          LEFT JOIN leads l ON l.id = a.lead_id
          LEFT JOIN categories c ON c.id = a.category_id
          ${where}
          ORDER BY COALESCE(a.starts_at, a.created_at) DESC
          LIMIT 200`,
    args: statusFilter ? [statusFilter] : [],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    lead_id: (r.lead_id as string) || null,
    provider_name: String(r.provider_name),
    user_name: (r.user_name as string) || null,
    category_name: (r.category_name as string) || null,
    starts_at: (r.starts_at as string) || null,
    status: r.status as AppointmentStatus,
    created_at: String(r.created_at),
  }));
}

export async function adminSetAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [status, id],
  });
}

// ── Stats & billing ───────────────────────────────────────────────────

export interface MarketplaceStats {
  leadsByDay: { day: string; count: number }[];
  dispatchByStatus: { status: string; count: number }[];
  answerRatePercent: number | null;
  topCategories: { name: string; count: number }[];
  topCommunes: { commune: string; count: number }[];
  perProvider: {
    provider_id: number;
    name: string;
    plan: string;
    cpl_cents: number | null;
    total: number;
    billable: number;
    answered: number;
  }[];
}

export async function getStats(): Promise<MarketplaceStats> {
  const db = requireMarketplaceDb();

  const [byDay, byStatus, topCats, topCommunes, perProvider] = await Promise.all([
    db.execute({
      sql: `SELECT date(created_at) AS day, COUNT(*) AS count FROM leads
            WHERE created_at > datetime('now', '-30 days')
            GROUP BY day ORDER BY day DESC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT status, COUNT(*) AS count FROM lead_dispatches GROUP BY status`,
      args: [],
    }),
    db.execute({
      sql: `SELECT c.name_fr AS name, COUNT(*) AS count FROM leads l
            JOIN categories c ON c.id = l.category_id
            GROUP BY c.id ORDER BY count DESC LIMIT 10`,
      args: [],
    }),
    db.execute({
      sql: `SELECT commune, COUNT(*) AS count FROM leads
            WHERE commune IS NOT NULL GROUP BY commune ORDER BY count DESC LIMIT 10`,
      args: [],
    }),
    db.execute({
      sql: `SELECT p.id AS provider_id, p.name, p.plan, p.cpl_cents,
              COUNT(d.id) AS total,
              SUM(CASE WHEN d.billable = 1 THEN 1 ELSE 0 END) AS billable,
              SUM(CASE WHEN d.status IN ('answered','converted') THEN 1 ELSE 0 END) AS answered
            FROM providers p LEFT JOIN lead_dispatches d ON d.provider_id = p.id
            GROUP BY p.id ORDER BY total DESC`,
      args: [],
    }),
  ]);

  const dispatchByStatus = byStatus.rows.map((r) => ({
    status: String(r.status),
    count: Number(r.count),
  }));
  const sent = dispatchByStatus
    .filter((d) => d.status !== "pending" && d.status !== "bounced")
    .reduce((a, d) => a + d.count, 0);
  const answered = dispatchByStatus
    .filter((d) => d.status === "answered" || d.status === "converted")
    .reduce((a, d) => a + d.count, 0);

  return {
    leadsByDay: byDay.rows.map((r) => ({ day: String(r.day), count: Number(r.count) })),
    dispatchByStatus,
    answerRatePercent: sent > 0 ? Math.round((answered / sent) * 100) : null,
    topCategories: topCats.rows.map((r) => ({ name: String(r.name), count: Number(r.count) })),
    topCommunes: topCommunes.rows.map((r) => ({ commune: String(r.commune), count: Number(r.count) })),
    perProvider: perProvider.rows.map((r) => ({
      provider_id: Number(r.provider_id),
      name: String(r.name),
      plan: String(r.plan),
      cpl_cents: r.cpl_cents == null ? null : Number(r.cpl_cents),
      total: Number(r.total),
      billable: Number(r.billable ?? 0),
      answered: Number(r.answered ?? 0),
    })),
  };
}

export interface BillingRow {
  provider_id: number;
  provider_name: string;
  vat_number: string | null;
  plan: string;
  cpl_cents: number | null;
  billable_dispatches: number;
  amount_cents: number;
}

/** Billable dispatches per provider for a given month (YYYY-MM). Spec §5/§9. */
export async function getBillingForMonth(month: string): Promise<BillingRow[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT p.id AS provider_id, p.name AS provider_name, p.vat_number, p.plan, p.cpl_cents,
            COUNT(d.id) AS billable_dispatches
          FROM lead_dispatches d
          JOIN providers p ON p.id = d.provider_id
          WHERE d.billable = 1 AND d.status NOT IN ('disputed', 'bounced')
            AND strftime('%Y-%m', d.sent_at) = ?
          GROUP BY p.id
          ORDER BY p.name`,
    args: [month],
  });
  return res.rows.map((r) => {
    const count = Number(r.billable_dispatches);
    const cpl = r.cpl_cents == null ? null : Number(r.cpl_cents);
    return {
      provider_id: Number(r.provider_id),
      provider_name: String(r.provider_name),
      vat_number: (r.vat_number as string) || null,
      plan: String(r.plan),
      cpl_cents: cpl,
      billable_dispatches: count,
      amount_cents: cpl == null ? 0 : cpl * count,
    };
  });
}

// ── Claims (directory listing claims) ─────────────────────────────────

export interface ClaimRow {
  id: string;
  provider_id: number;
  provider_name: string;
  provider_slug: string;
  provider_status: string;
  contact_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

export async function listClaims(status = "pending"): Promise<ClaimRow[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT cl.*, p.name AS provider_name, p.slug AS provider_slug, p.status AS provider_status
          FROM provider_claims cl JOIN providers p ON p.id = cl.provider_id
          WHERE cl.status = ? ORDER BY cl.created_at DESC LIMIT 200`,
    args: [status],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    provider_id: Number(r.provider_id),
    provider_name: String(r.provider_name),
    provider_slug: String(r.provider_slug),
    provider_status: String(r.provider_status),
    contact_name: String(r.contact_name),
    email: String(r.email),
    phone: (r.phone as string) || null,
    message: (r.message as string) || null,
    status: String(r.status),
    created_at: String(r.created_at),
  }));
}

export async function countPendingClaims(): Promise<number> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT COUNT(*) n FROM provider_claims WHERE status = 'pending'",
    args: [],
  });
  return Number(res.rows[0].n);
}

/**
 * Approve a claim: set the provider's email to the claimant's (if empty) and
 * flip the provider to 'active' (now claimed — receives leads). Returns the
 * provider id so its pages can be revalidated.
 */
export async function approveClaim(id: string): Promise<number | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT provider_id, email FROM provider_claims WHERE id = ? AND status = 'pending'",
    args: [id],
  });
  if (!res.rows.length) return null;
  const providerId = Number(res.rows[0].provider_id);
  const email = String(res.rows[0].email);
  await db.batch([
    {
      sql: `UPDATE providers SET status = 'active',
              email = CASE WHEN email = '' OR email IS NULL THEN ? ELSE email END,
              updated_at = datetime('now')
            WHERE id = ?`,
      args: [email, providerId],
    },
    { sql: "UPDATE provider_claims SET status = 'approved', handled_at = datetime('now') WHERE id = ?", args: [id] },
  ]);
  return providerId;
}

export async function rejectClaim(id: string): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "UPDATE provider_claims SET status = 'rejected', handled_at = datetime('now') WHERE id = ?",
    args: [id],
  });
}

/** Bulk-publish: flip all draft providers to 'listed' (public directory). */
export async function publishDraftsAsListed(): Promise<number> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "UPDATE providers SET status = 'listed', updated_at = datetime('now') WHERE status = 'draft'",
    args: [],
  });
  return res.rowsAffected;
}

export async function countDrafts(): Promise<number> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT COUNT(*) n FROM providers WHERE status = 'draft'",
    args: [],
  });
  return Number(res.rows[0].n);
}

// ── Availability rules (Level 2) ──────────────────────────────────────

export interface AvailabilityRule {
  id: number;
  provider_id: number;
  weekday: number; // 0=Mon … 6=Sun
  open_time: string;
  close_time: string;
}

export async function listAvailabilityRules(providerId: number): Promise<AvailabilityRule[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT id, provider_id, weekday, open_time, close_time
          FROM availability_rules WHERE provider_id = ? ORDER BY weekday, open_time`,
    args: [providerId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    provider_id: Number(r.provider_id),
    weekday: Number(r.weekday),
    open_time: String(r.open_time),
    close_time: String(r.close_time),
  }));
}

export async function addAvailabilityRule(
  providerId: number,
  weekday: number,
  openTime: string,
  closeTime: string
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO availability_rules (provider_id, weekday, open_time, close_time)
          VALUES (?, ?, ?, ?)`,
    args: [providerId, weekday, openTime, closeTime],
  });
}

export async function deleteAvailabilityRule(id: number, providerId: number): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "DELETE FROM availability_rules WHERE id = ? AND provider_id = ?",
    args: [id, providerId],
  });
}

export interface AvailabilityException {
  id: number;
  date: string;
  closed: boolean;
}

export async function listAvailabilityExceptions(
  providerId: number
): Promise<AvailabilityException[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT id, date, closed FROM availability_exceptions
          WHERE provider_id = ? AND date >= date('now') ORDER BY date`,
    args: [providerId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    date: String(r.date),
    closed: Number(r.closed) === 1,
  }));
}

export async function addAvailabilityException(
  providerId: number,
  date: string
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO availability_exceptions (provider_id, date, closed) VALUES (?, ?, 1)`,
    args: [providerId, date],
  });
}

export async function deleteAvailabilityException(
  id: number,
  providerId: number
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "DELETE FROM availability_exceptions WHERE id = ? AND provider_id = ?",
    args: [id, providerId],
  });
}
