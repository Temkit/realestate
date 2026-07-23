/**
 * Level-2 slot engine (spec §10): slots = availability rules − exceptions −
 * confirmed appointments − min_lead_time, on a slot_minutes grid with
 * buffer_minutes between jobs. Times are Europe/Luxembourg local.
 */

import { requireMarketplaceDb } from "./db";
import type { BookingMode } from "./types";

export interface SlotDay {
  date: string; // YYYY-MM-DD
  slots: { iso: string; time: string }[]; // time = "HH:MM" local
}

interface Settings {
  mode: BookingMode;
  slot_minutes: number;
  buffer_minutes: number;
  min_lead_hours: number;
  max_horizon_days: number;
}

const DEFAULTS: Settings = {
  mode: "request",
  slot_minutes: 60,
  buffer_minutes: 0,
  min_lead_hours: 24,
  max_horizon_days: 60,
};

export async function getBookingConfig(
  providerId: number
): Promise<Settings & { hasRules: boolean }> {
  const db = requireMarketplaceDb();
  const [settings, rules] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM booking_settings WHERE provider_id = ?",
      args: [providerId],
    }),
    db.execute({
      sql: "SELECT COUNT(*) AS n FROM availability_rules WHERE provider_id = ?",
      args: [providerId],
    }),
  ]);
  const s = settings.rows[0];
  return {
    mode: s ? (String(s.mode) as BookingMode) : DEFAULTS.mode,
    slot_minutes: s ? Number(s.slot_minutes) : DEFAULTS.slot_minutes,
    buffer_minutes: s ? Number(s.buffer_minutes) : DEFAULTS.buffer_minutes,
    min_lead_hours: s ? Number(s.min_lead_hours) : DEFAULTS.min_lead_hours,
    max_horizon_days: s ? Number(s.max_horizon_days) : DEFAULTS.max_horizon_days,
    hasRules: Number(rules.rows[0].n) > 0,
  };
}

/** Europe/Luxembourg UTC offset for a date (DST approximated by month). */
export function luxOffsetSuffix(dateStr: string): string {
  const month = Number(dateStr.slice(5, 7));
  return month >= 4 && month <= 10 ? "+02:00" : "+01:00";
}

function toIso(date: string, time: string): string {
  return `${date}T${time}:00${luxOffsetSuffix(date)}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function timeLte(a: string, b: string): boolean {
  return a <= b; // "HH:MM" compares lexicographically
}

/** Compute open slots for the next `days` days (capped by max_horizon_days). */
export async function computeAvailableSlots(
  providerId: number,
  days = 14
): Promise<{ config: Settings & { hasRules: boolean }; days: SlotDay[] }> {
  const db = requireMarketplaceDb();
  const config = await getBookingConfig(providerId);
  const horizon = Math.min(days, config.max_horizon_days);

  const [rulesRes, exceptionsRes, apptsRes] = await Promise.all([
    db.execute({
      sql: `SELECT weekday, open_time, close_time FROM availability_rules
            WHERE provider_id = ?`,
      args: [providerId],
    }),
    db.execute({
      sql: `SELECT date, closed, open_time, close_time FROM availability_exceptions
            WHERE provider_id = ? AND date >= date('now')`,
      args: [providerId],
    }),
    db.execute({
      sql: `SELECT starts_at, duration_min FROM appointments
            WHERE provider_id = ? AND status = 'confirmed'
              AND starts_at > datetime('now', '-1 day')`,
      args: [providerId],
    }),
  ]);

  const rules = rulesRes.rows.map((r) => ({
    weekday: Number(r.weekday),
    open: String(r.open_time),
    close: String(r.close_time),
  }));
  const exceptions = new Map(
    exceptionsRes.rows.map((r) => [
      String(r.date),
      {
        closed: Number(r.closed) === 1,
        open: (r.open_time as string) || null,
        close: (r.close_time as string) || null,
      },
    ])
  );
  const busy = apptsRes.rows
    .filter((r) => r.starts_at)
    .map((r) => {
      const start = new Date(String(r.starts_at)).getTime();
      const dur = (r.duration_min == null ? config.slot_minutes : Number(r.duration_min)) +
        config.buffer_minutes;
      return { start, end: start + dur * 60_000 };
    });

  const minStart = Date.now() + config.min_lead_hours * 3600_000;
  const result: SlotDay[] = [];
  const today = new Date();

  for (let d = 0; d < horizon; d++) {
    const day = new Date(today.getTime() + d * 86400_000);
    const dateStr = day.toISOString().slice(0, 10);
    const weekday = (day.getUTCDay() + 6) % 7; // 0=Mon

    const exception = exceptions.get(dateStr);
    if (exception?.closed) continue;

    let dayRules = rules.filter((r) => r.weekday === weekday);
    if (exception && exception.open && exception.close) {
      dayRules = [{ weekday, open: exception.open, close: exception.close }];
    }
    if (!dayRules.length) continue;

    const slots: { iso: string; time: string }[] = [];
    for (const rule of dayRules) {
      let t = rule.open;
      while (timeLte(addMinutes(t, config.slot_minutes), rule.close)) {
        const iso = toIso(dateStr, t);
        const startMs = new Date(iso).getTime();
        const endMs = startMs + (config.slot_minutes + config.buffer_minutes) * 60_000;
        const clash = busy.some((b) => startMs < b.end && endMs > b.start);
        if (startMs >= minStart && !clash) {
          slots.push({ iso, time: t });
        }
        t = addMinutes(t, config.slot_minutes);
      }
    }
    slots.sort((a, b) => a.time.localeCompare(b.time));
    if (slots.length) result.push({ date: dateStr, slots });
  }

  return { config, days: result };
}

/** True when the exact slot is still free (authoritative re-check at booking). */
export async function isSlotAvailable(providerId: number, iso: string): Promise<boolean> {
  const { days } = await computeAvailableSlots(providerId, 60);
  return days.some((d) => d.slots.some((s) => s.iso === iso));
}
