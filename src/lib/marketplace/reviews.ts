/**
 * Reviews (spec §10 P3b). Verified reviews only: a customer can review after
 * their appointment is marked `completed`, via the tokenized link emailed to
 * them. Reviews start `pending` and appear publicly only once an admin
 * approves them. Approved ratings feed public ordering + JSON-LD.
 */

import { requireMarketplaceDb } from "./db";
import { randomId } from "./tokens";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  provider_id: number;
  author_name: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  created_at: string;
}

export interface RatingSummary {
  avg: number | null; // 1..5, one decimal
  count: number;
}

export async function getRatingSummary(providerId: number): Promise<RatingSummary> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT AVG(rating) AS avg, COUNT(*) AS count
          FROM reviews WHERE provider_id = ? AND status = 'approved'`,
    args: [providerId],
  });
  const r = res.rows[0];
  const count = Number(r.count);
  return {
    avg: count > 0 && r.avg != null ? Math.round(Number(r.avg) * 10) / 10 : null,
    count,
  };
}

/** Approved ratings for many providers at once (public listing pages). */
export async function getRatingSummaries(
  providerIds: number[]
): Promise<Map<number, RatingSummary>> {
  const map = new Map<number, RatingSummary>();
  if (!providerIds.length) return map;
  const db = requireMarketplaceDb();
  const placeholders = providerIds.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT provider_id, AVG(rating) AS avg, COUNT(*) AS count
          FROM reviews WHERE status = 'approved' AND provider_id IN (${placeholders})
          GROUP BY provider_id`,
    args: providerIds,
  });
  for (const r of res.rows) {
    const count = Number(r.count);
    map.set(Number(r.provider_id), {
      avg: count > 0 && r.avg != null ? Math.round(Number(r.avg) * 10) / 10 : null,
      count,
    });
  }
  return map;
}

export async function listApprovedReviews(
  providerId: number,
  limit = 10
): Promise<Review[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT id, provider_id, author_name, rating, comment, status, created_at
          FROM reviews WHERE provider_id = ? AND status = 'approved'
          ORDER BY created_at DESC LIMIT ?`,
    args: [providerId, limit],
  });
  return res.rows.map(rowToReview);
}

function rowToReview(r: Record<string, unknown>): Review {
  return {
    id: String(r.id),
    provider_id: Number(r.provider_id),
    author_name: String(r.author_name),
    rating: Number(r.rating),
    comment: (r.comment as string) || null,
    status: r.status as ReviewStatus,
    created_at: String(r.created_at),
  };
}

/** True when this appointment already has a review (blocks the form). */
export async function appointmentHasReview(appointmentId: string): Promise<boolean> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT 1 FROM reviews WHERE appointment_id = ? LIMIT 1",
    args: [appointmentId],
  });
  return res.rows.length > 0;
}

/** Insert a pending review. Returns false if the appointment was already reviewed. */
export async function createReview(input: {
  providerId: number;
  appointmentId: string | null;
  leadId: string | null;
  authorName: string;
  rating: number;
  comment: string | null;
}): Promise<boolean> {
  const db = requireMarketplaceDb();
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  try {
    await db.execute({
      sql: `INSERT INTO reviews (id, provider_id, appointment_id, lead_id, author_name, rating, comment, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        randomId(), input.providerId, input.appointmentId, input.leadId,
        input.authorName, rating, input.comment,
      ],
    });
    return true;
  } catch (e) {
    // UNIQUE(appointment_id) violation → already reviewed
    if (e instanceof Error && e.message.includes("UNIQUE")) return false;
    throw e;
  }
}

// ── Moderation (admin) ────────────────────────────────────────────────

export interface PendingReviewRow extends Review {
  provider_name: string;
}

export async function listReviews(status: ReviewStatus): Promise<PendingReviewRow[]> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT r.id, r.provider_id, r.author_name, r.rating, r.comment, r.status, r.created_at,
            p.name AS provider_name
          FROM reviews r JOIN providers p ON p.id = r.provider_id
          WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
    args: [status],
  });
  return res.rows.map((r) => ({
    ...rowToReview(r as Record<string, unknown>),
    provider_name: String(r.provider_name),
  }));
}

export async function countPendingReviews(): Promise<number> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'",
    args: [],
  });
  return Number(res.rows[0].n);
}

export async function moderateReview(
  id: string,
  status: "approved" | "rejected"
): Promise<number | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `UPDATE reviews SET status = ?, moderated_at = datetime('now')
          WHERE id = ? RETURNING provider_id`,
    args: [status, id],
  });
  return res.rows.length ? Number(res.rows[0].provider_id) : null;
}
