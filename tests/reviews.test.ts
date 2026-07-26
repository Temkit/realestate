import { describe, it, expect } from "vitest";
import {
  appointmentHasReview,
  createReview,
  getRatingSummary,
  listApprovedReviews,
  moderateReview,
} from "@/lib/marketplace/reviews";
import { insertAppointment, insertProvider, testDb } from "./helpers";

const db = testDb();

async function reviewIdFor(providerId: number): Promise<string> {
  const r = await db.execute({
    sql: "SELECT id FROM reviews WHERE provider_id = ? ORDER BY created_at DESC LIMIT 1",
    args: [providerId],
  });
  return String(r.rows[0].id);
}

describe("reviews lifecycle", () => {
  it("is hidden while pending, visible once approved", async () => {
    const providerId = await insertProvider(db);
    const appt = await insertAppointment(db, providerId);
    expect(
      await createReview({
        providerId,
        appointmentId: appt,
        leadId: null,
        authorName: "Alice",
        rating: 4,
        comment: "Great",
      })
    ).toBe(true);

    // Pending → not counted publicly
    expect(await getRatingSummary(providerId)).toEqual({ avg: null, count: 0 });
    expect(await listApprovedReviews(providerId)).toHaveLength(0);

    // Approve → now public
    const id = await reviewIdFor(providerId);
    expect(await moderateReview(id, "approved")).toBe(providerId);
    expect(await getRatingSummary(providerId)).toEqual({ avg: 4, count: 1 });
    const approved = await listApprovedReviews(providerId);
    expect(approved).toHaveLength(1);
    expect(approved[0].author_name).toBe("Alice");
  });

  it("averages multiple approved ratings", async () => {
    const providerId = await insertProvider(db);
    for (const [i, rating] of [5, 4, 3].entries()) {
      const appt = await insertAppointment(db, providerId);
      await createReview({
        providerId,
        appointmentId: appt,
        leadId: null,
        authorName: `U${i}`,
        rating,
        comment: null,
      });
    }
    const rows = await db.execute({
      sql: "SELECT id FROM reviews WHERE provider_id = ?",
      args: [providerId],
    });
    for (const row of rows.rows) await moderateReview(String(row.id), "approved");

    const summary = await getRatingSummary(providerId);
    expect(summary.count).toBe(3);
    expect(summary.avg).toBe(4); // (5+4+3)/3
  });

  it("blocks a second review for the same appointment", async () => {
    const providerId = await insertProvider(db);
    const appt = await insertAppointment(db, providerId);
    expect(
      await createReview({ providerId, appointmentId: appt, leadId: null, authorName: "A", rating: 5, comment: null })
    ).toBe(true);
    expect(await appointmentHasReview(appt)).toBe(true);
    expect(
      await createReview({ providerId, appointmentId: appt, leadId: null, authorName: "B", rating: 1, comment: null })
    ).toBe(false);
  });

  it("clamps out-of-range ratings to 1..5", async () => {
    const providerId = await insertProvider(db);
    const appt = await insertAppointment(db, providerId);
    await createReview({ providerId, appointmentId: appt, leadId: null, authorName: "C", rating: 9, comment: null });
    const id = await reviewIdFor(providerId);
    await moderateReview(id, "approved");
    expect((await getRatingSummary(providerId)).avg).toBe(5);
  });

  it("rejected reviews never appear publicly", async () => {
    const providerId = await insertProvider(db);
    const appt = await insertAppointment(db, providerId);
    await createReview({ providerId, appointmentId: appt, leadId: null, authorName: "D", rating: 1, comment: "bad" });
    const id = await reviewIdFor(providerId);
    await moderateReview(id, "rejected");
    expect(await getRatingSummary(providerId)).toEqual({ avg: null, count: 0 });
    expect(await listApprovedReviews(providerId)).toHaveLength(0);
  });
});
