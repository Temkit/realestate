import { describe, it, expect, beforeAll } from "vitest";
import { computeAvailableSlots, luxOffsetSuffix } from "@/lib/marketplace/slots";
import { insertProvider, testDb } from "./helpers";

const db = testDb();

/** Tomorrow's UTC date (matches the engine's day iteration). */
function tomorrowStr(): string {
  return new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
}

describe("computeAvailableSlots (Level-2 engine)", () => {
  let providerId: number;

  beforeAll(async () => {
    providerId = await insertProvider(db);
    // Open every weekday 09:00–17:00 so tests don't depend on the weekday
    await db.execute({
      sql: `INSERT INTO booking_settings (provider_id, mode, slot_minutes, buffer_minutes, min_lead_hours, max_horizon_days)
            VALUES (?, 'auto', 60, 0, 0, 60)`,
      args: [providerId],
    });
    for (let wd = 0; wd < 7; wd++) {
      await db.execute({
        sql: `INSERT INTO availability_rules (provider_id, weekday, open_time, close_time)
              VALUES (?, ?, '09:00', '17:00')`,
        args: [providerId, wd],
      });
    }
  });

  it("generates a full grid of open slots (09→16 = 8 slots)", async () => {
    const { config, days } = await computeAvailableSlots(providerId, 14);
    expect(config.mode).toBe("auto");
    expect(config.hasRules).toBe(true);
    const day = days.find((d) => d.date === tomorrowStr());
    expect(day).toBeTruthy();
    expect(day!.slots).toHaveLength(8);
    expect(day!.slots[0].time).toBe("09:00");
    expect(day!.slots.at(-1)!.time).toBe("16:00");
  });

  it("removes a slot already booked by a confirmed appointment", async () => {
    const iso = `${tomorrowStr()}T10:00:00${luxOffsetSuffix(tomorrowStr())}`;
    await db.execute({
      sql: `INSERT INTO appointments (id, provider_id, starts_at, duration_min, status)
            VALUES (?, ?, ?, 60, 'confirmed')`,
      args: [`appt-${Date.now()}`, providerId, iso],
    });
    const { days } = await computeAvailableSlots(providerId, 14);
    const day = days.find((d) => d.date === tomorrowStr())!;
    expect(day.slots).toHaveLength(7);
    expect(day.slots.map((s) => s.time)).not.toContain("10:00");
  });

  it("omits a day marked as a closed exception", async () => {
    const date = tomorrowStr();
    await db.execute({
      sql: `INSERT INTO availability_exceptions (provider_id, date, closed) VALUES (?, ?, 1)`,
      args: [providerId, date],
    });
    const { days } = await computeAvailableSlots(providerId, 14);
    expect(days.find((d) => d.date === date)).toBeUndefined();
  });
});

describe("min-lead time", () => {
  it("excludes today's remaining slots when min_lead is large", async () => {
    const id = await insertProvider(db);
    await db.execute({
      sql: `INSERT INTO booking_settings (provider_id, mode, slot_minutes, buffer_minutes, min_lead_hours, max_horizon_days)
            VALUES (?, 'auto', 60, 0, 48, 60)`,
      args: [id],
    });
    const todayWd = (new Date().getUTCDay() + 6) % 7;
    await db.execute({
      sql: `INSERT INTO availability_rules (provider_id, weekday, open_time, close_time)
            VALUES (?, ?, '09:00', '17:00')`,
      args: [id, todayWd],
    });
    const today = new Date().toISOString().slice(0, 10);
    const { days } = await computeAvailableSlots(id, 1);
    // With a 48h lead, nothing today is bookable
    expect(days.find((d) => d.date === today)).toBeUndefined();
  });
});
