import { describe, it, expect } from "vitest";
import {
  getProviderByEmail,
  providerSetDispatchStatus,
  providerSetOfferActive,
  providerUpdateOffer,
  getProviderAppointment,
} from "@/lib/marketplace/provider-queries";
import {
  categoryId,
  insertOffer,
  insertProvider,
  testDb,
} from "./helpers";

const db = testDb();

describe("provider-scoped access (OWASP A01 / IDOR)", () => {
  it("a provider cannot edit another provider's offer", async () => {
    const cat = await categoryId(db, "garages", "tyres");
    const a = await insertProvider(db);
    const b = await insertProvider(db);
    const offerA = await insertOffer(db, a, cat, { price_cents: 5000 });

    // B attempts to hijack A's offer
    expect(await providerUpdateOffer(b, offerA, { title_fr: "x", title_en: "x", price_type: "fixed", price_cents: 1 })).toBe(false);
    expect(await providerSetOfferActive(b, offerA, false)).toBe(false);

    // Untouched
    const row = await db.execute({ sql: "SELECT price_cents, active FROM offers WHERE id = ?", args: [offerA] });
    expect(Number(row.rows[0].price_cents)).toBe(5000);
    expect(Number(row.rows[0].active)).toBe(1);

    // A (the owner) can
    expect(await providerSetOfferActive(a, offerA, false)).toBe(true);
    expect(await providerUpdateOffer(a, offerA, { title_fr: "y", title_en: "y", price_type: "fixed", price_cents: 7000 })).toBe(true);
  });

  it("a provider cannot change another provider's dispatch", async () => {
    const a = await insertProvider(db);
    const b = await insertProvider(db);
    // Seed a lead + a dispatch owned by A
    const leadId = `lead-${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO leads (id, vertical_id, name, status, consent_at)
            VALUES (?, 1, 'X', 'dispatched', datetime('now'))`,
      args: [leadId],
    });
    const disp = await db.execute({
      sql: `INSERT INTO lead_dispatches (lead_id, provider_id, status) VALUES (?, ?, 'sent') RETURNING id`,
      args: [leadId, a],
    });
    const dispatchId = Number(disp.rows[0].id);

    expect(await providerSetDispatchStatus(b, dispatchId, "converted")).toBe(false);
    const still = await db.execute({ sql: "SELECT status FROM lead_dispatches WHERE id = ?", args: [dispatchId] });
    expect(String(still.rows[0].status)).toBe("sent");

    expect(await providerSetDispatchStatus(a, dispatchId, "converted")).toBe(true);
  });

  it("getProviderAppointment returns null for another provider's appointment", async () => {
    const a = await insertProvider(db);
    const b = await insertProvider(db);
    const apptId = `appt-${Date.now()}-scope`;
    await db.execute({
      sql: `INSERT INTO appointments (id, provider_id, status) VALUES (?, ?, 'requested')`,
      args: [apptId, a],
    });
    expect(await getProviderAppointment(b, apptId)).toBeNull();
    expect((await getProviderAppointment(a, apptId))?.id).toBe(apptId);
  });
});

describe("getProviderByEmail", () => {
  it("matches case-insensitively and only active providers", async () => {
    const email = `Case.Test.${Date.now()}@Example.com`;
    const id = await insertProvider(db, { email, status: "active" });
    const found = await getProviderByEmail(email.toLowerCase());
    expect(found?.id).toBe(id);

    const pausedEmail = `paused.${Date.now()}@x.com`;
    await insertProvider(db, { email: pausedEmail, status: "paused" });
    expect(await getProviderByEmail(pausedEmail)).toBeNull();
  });
});
