/**
 * Lead + appointment operations (spec §5, §10 Level 1).
 * All writes append to lead_events for the admin timeline.
 */

import { requireMarketplaceDb } from "./db";
import { matchProviders } from "./matching";
import {
  randomId,
  randomToken,
  signDispatchToken,
} from "./tokens";
import {
  getBaseUrl,
  sendAutoBookingToProvider,
  sendBookingConfirmedToUser,
  sendBookingRequestToProvider,
  sendLeadConfirmationToUser,
  sendLeadToProvider,
  type LeadEmailData,
} from "./email";
import type { AppointmentStatus, BookingWindow } from "./types";

export interface NewLead {
  verticalId: number;
  categoryId: number;
  categoryNameFr: string;
  categoryNameForUser: string;
  name: string;
  email: string | null;
  phone: string | null;
  commune: string | null;
  message: string | null;
  answers: Record<string, unknown>;
  locale: string;
  sourcePage: string;
}

async function insertLead(lead: NewLead): Promise<string> {
  const db = requireMarketplaceDb();
  const id = randomId();
  await db.execute({
    sql: `INSERT INTO leads (id, vertical_id, category_id, name, email, phone, commune,
            message, answers, locale, source_page, status, consent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))`,
    args: [
      id, lead.verticalId, lead.categoryId, lead.name, lead.email, lead.phone,
      lead.commune, lead.message, JSON.stringify(lead.answers), lead.locale,
      lead.sourcePage,
    ],
  });
  await addEvent(id, null, "created", "system", {});
  return id;
}

export async function addEvent(
  leadId: string,
  dispatchId: number | null,
  event: string,
  actor: string,
  meta: Record<string, unknown>
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `INSERT INTO lead_events (lead_id, dispatch_id, event, actor, meta)
          VALUES (?, ?, ?, ?, ?)`,
    args: [leadId, dispatchId, event, actor, JSON.stringify(meta)],
  });
}

function toEmailData(lead: NewLead): LeadEmailData {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    commune: lead.commune,
    message: lead.message,
    categoryNameFr: lead.categoryNameFr,
  };
}

/**
 * Quote lead: match up to 3 providers, create dispatches, send emails.
 * Optionally pinned to a single provider (profile-page contact).
 */
export async function createLead(
  lead: NewLead,
  pinnedProvider?: { id: number; email: string; name: string }
): Promise<{ leadId: string; dispatched: number }> {
  const db = requireMarketplaceDb();
  const leadId = await insertLead(lead);

  const targets = pinnedProvider
    ? [pinnedProvider]
    : await matchProviders(lead.categoryId, lead.commune);

  let dispatched = 0;
  for (const provider of targets) {
    const res = await db.execute({
      sql: `INSERT INTO lead_dispatches (lead_id, provider_id, channel, status)
            VALUES (?, ?, 'email', 'pending') RETURNING id`,
      args: [leadId, provider.id],
    });
    const dispatchId = Number(res.rows[0].id);

    const answeredToken = signDispatchToken(dispatchId, "answered");
    const disputedToken = signDispatchToken(dispatchId, "disputed");
    const base = getBaseUrl();
    const { sent, error } = await sendLeadToProvider({
      to: provider.email,
      providerName: provider.name,
      lead: toEmailData(lead),
      answeredUrl: answeredToken ? `${base}/api/leads/r/${answeredToken}` : null,
      disputedUrl: disputedToken ? `${base}/api/leads/r/${disputedToken}` : null,
    });

    if (sent) {
      await db.execute({
        sql: `UPDATE lead_dispatches SET status = 'sent', billable = 1, sent_at = datetime('now') WHERE id = ?`,
        args: [dispatchId],
      });
      await addEvent(leadId, dispatchId, "dispatched", "system", { providerId: provider.id });
      dispatched++;
    } else {
      // stays 'pending' — visible in admin for manual retry (no silent drops)
      await addEvent(leadId, dispatchId, "dispatch_failed", "system", {
        providerId: provider.id,
        error: error ?? "unknown",
      });
    }
  }

  if (dispatched > 0) {
    await db.execute({
      sql: "UPDATE leads SET status = 'dispatched' WHERE id = ?",
      args: [leadId],
    });
    if (lead.email) {
      await sendLeadConfirmationToUser({
        to: lead.email,
        name: lead.name,
        categoryName: lead.categoryNameForUser,
        providerCount: dispatched,
        locale: lead.locale,
      });
    }
  }

  return { leadId, dispatched };
}

/**
 * Level-1 booking request: lead + appointment (status=requested) pinned to one
 * provider; the dispatch email carries per-window confirm links.
 */
export async function createBookingRequest(
  lead: NewLead,
  provider: { id: number; email: string; name: string },
  windows: BookingWindow[]
): Promise<{ leadId: string; appointmentId: string }> {
  const db = requireMarketplaceDb();
  lead.answers = { ...lead.answers, windows };
  const leadId = await insertLead(lead);

  const appointmentId = randomId();
  const confirmToken = randomToken();
  const manageToken = randomToken();
  await db.execute({
    sql: `INSERT INTO appointments (id, lead_id, provider_id, category_id, status, confirm_token, manage_token)
          VALUES (?, ?, ?, ?, 'requested', ?, ?)`,
    args: [appointmentId, leadId, provider.id, lead.categoryId, confirmToken, manageToken],
  });

  const res = await db.execute({
    sql: `INSERT INTO lead_dispatches (lead_id, provider_id, channel, status)
          VALUES (?, ?, 'email', 'pending') RETURNING id`,
    args: [leadId, provider.id],
  });
  const dispatchId = Number(res.rows[0].id);

  const base = getBaseUrl();
  const confirmUrls = windows.map(
    (_, i) => `${base}/api/appointments/r/${confirmToken}?action=confirm&w=${i}`
  );
  const declineUrl = `${base}/api/appointments/r/${confirmToken}?action=decline`;

  const { sent, error } = await sendBookingRequestToProvider({
    to: provider.email,
    providerName: provider.name,
    lead: toEmailData(lead),
    windows,
    confirmUrls,
    declineUrl,
  });

  if (sent) {
    await db.execute({
      sql: `UPDATE lead_dispatches SET status = 'sent', billable = 1, sent_at = datetime('now') WHERE id = ?`,
      args: [dispatchId],
    });
    await db.execute({
      sql: "UPDATE leads SET status = 'dispatched' WHERE id = ?",
      args: [leadId],
    });
    await addEvent(leadId, dispatchId, "dispatched", "system", {
      providerId: provider.id,
      appointmentId,
    });
  } else {
    await addEvent(leadId, dispatchId, "dispatch_failed", "system", {
      providerId: provider.id,
      error: error ?? "unknown",
    });
  }

  return { leadId, appointmentId };
}

/**
 * Level-2 auto-confirmed booking. The insert is guarded against a concurrent
 * confirmed appointment on the same grid slot; returns null when taken.
 */
export async function createAutoBooking(
  lead: NewLead,
  provider: { id: number; email: string; name: string },
  startsAtIso: string,
  durationMin: number
): Promise<{ leadId: string; appointmentId: string } | null> {
  const db = requireMarketplaceDb();
  lead.answers = { ...lead.answers, slot: startsAtIso };
  const leadId = await insertLead(lead);

  const appointmentId = randomId();
  const confirmToken = randomToken();
  const manageToken = randomToken();
  const res = await db.execute({
    sql: `INSERT INTO appointments (id, lead_id, provider_id, category_id, starts_at,
            duration_min, status, confirm_token, manage_token)
          SELECT ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM appointments
            WHERE provider_id = ? AND status = 'confirmed' AND starts_at = ?
          )`,
    args: [
      appointmentId, leadId, provider.id, lead.categoryId, startsAtIso,
      durationMin, confirmToken, manageToken, provider.id, startsAtIso,
    ],
  });
  if (res.rowsAffected === 0) {
    await db.execute({
      sql: "UPDATE leads SET status = 'invalid' WHERE id = ?",
      args: [leadId],
    });
    await addEvent(leadId, null, "slot_taken", "system", { slot: startsAtIso });
    return null;
  }

  const dispatch = await db.execute({
    sql: `INSERT INTO lead_dispatches (lead_id, provider_id, channel, status)
          VALUES (?, ?, 'email', 'pending') RETURNING id`,
    args: [leadId, provider.id],
  });
  const dispatchId = Number(dispatch.rows[0].id);

  const base = getBaseUrl();
  const { sent, error } = await sendAutoBookingToProvider({
    to: provider.email,
    providerName: provider.name,
    lead: toEmailData(lead),
    startsAt: startsAtIso,
    cancelUrl: `${base}/api/appointments/r/${confirmToken}?action=cancel`,
  });
  if (sent) {
    await db.execute({
      sql: `UPDATE lead_dispatches SET status = 'sent', billable = 1, sent_at = datetime('now') WHERE id = ?`,
      args: [dispatchId],
    });
    await db.execute({
      sql: "UPDATE leads SET status = 'answered' WHERE id = ?",
      args: [leadId],
    });
    await addEvent(leadId, dispatchId, "dispatched", "system", {
      providerId: provider.id,
      appointmentId,
      auto: true,
    });
  } else {
    await addEvent(leadId, dispatchId, "dispatch_failed", "system", {
      providerId: provider.id,
      error: error ?? "unknown",
    });
  }

  if (lead.email) {
    await sendBookingConfirmedToUser({
      to: lead.email,
      name: lead.name,
      providerName: provider.name,
      startsAt: startsAtIso,
      manageUrl: `${base}/${lead.locale}/rdv/${manageToken}`,
      locale: lead.locale,
    });
  }
  await scheduleReminders(appointmentId, startsAtIso);

  return { leadId, appointmentId };
}

/** Admin retry of a pending/bounced dispatch (spec §5 — no silent drops). */
export async function retryDispatch(dispatchId: number): Promise<{ sent: boolean; error?: string }> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT d.id, d.status, d.lead_id,
            l.name, l.email, l.phone, l.commune, l.message,
            c.name_fr AS category_name_fr,
            p.email AS provider_email, p.name AS provider_name
          FROM lead_dispatches d
          JOIN leads l ON l.id = d.lead_id
          JOIN providers p ON p.id = d.provider_id
          LEFT JOIN categories c ON c.id = l.category_id
          WHERE d.id = ?`,
    args: [dispatchId],
  });
  if (!res.rows.length) return { sent: false, error: "dispatch not found" };
  const r = res.rows[0];
  if (r.status !== "pending" && r.status !== "bounced") {
    return { sent: false, error: `dispatch is ${r.status}` };
  }

  const answeredToken = signDispatchToken(dispatchId, "answered");
  const disputedToken = signDispatchToken(dispatchId, "disputed");
  const base = getBaseUrl();
  const { sent, error } = await sendLeadToProvider({
    to: String(r.provider_email),
    providerName: String(r.provider_name),
    lead: {
      name: String(r.name),
      email: (r.email as string) || null,
      phone: (r.phone as string) || null,
      commune: (r.commune as string) || null,
      message: (r.message as string) || null,
      categoryNameFr: String(r.category_name_fr ?? "Service"),
    },
    answeredUrl: answeredToken ? `${base}/api/leads/r/${answeredToken}` : null,
    disputedUrl: disputedToken ? `${base}/api/leads/r/${disputedToken}` : null,
  });

  const leadId = String(r.lead_id);
  if (sent) {
    await db.execute({
      sql: `UPDATE lead_dispatches SET status = 'sent', billable = 1, sent_at = datetime('now') WHERE id = ?`,
      args: [dispatchId],
    });
    await db.execute({
      sql: "UPDATE leads SET status = 'dispatched' WHERE id = ? AND status = 'new'",
      args: [leadId],
    });
    await addEvent(leadId, dispatchId, "dispatch_retried", "admin", {});
  } else {
    await addEvent(leadId, dispatchId, "dispatch_retry_failed", "admin", {
      error: error ?? "unknown",
    });
  }
  return { sent, error };
}

export interface AppointmentRecord {
  id: string;
  lead_id: string | null;
  provider_id: number;
  category_id: number | null;
  starts_at: string | null;
  duration_min: number | null;
  status: AppointmentStatus;
}

export async function getAppointmentByToken(
  kind: "confirm" | "manage",
  token: string
): Promise<AppointmentRecord | null> {
  const db = requireMarketplaceDb();
  const col = kind === "confirm" ? "confirm_token" : "manage_token";
  const res = await db.execute({
    sql: `SELECT id, lead_id, provider_id, category_id, starts_at, duration_min, status
          FROM appointments WHERE ${col} = ?`,
    args: [token],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return {
    id: String(r.id),
    lead_id: (r.lead_id as string) || null,
    provider_id: Number(r.provider_id),
    category_id: r.category_id == null ? null : Number(r.category_id),
    starts_at: (r.starts_at as string) || null,
    duration_min: r.duration_min == null ? null : Number(r.duration_min),
    status: r.status as AppointmentStatus,
  };
}

const PERIOD_START_HOUR: Record<string, number> = { morning: 9, afternoon: 14 };

/** Window (date + period) → ISO start in Europe/Luxembourg (CET/CEST). */
export function windowToStartsAt(w: BookingWindow): string {
  const hour = PERIOD_START_HOUR[w.period] ?? 9;
  // Luxembourg is UTC+1 (winter) / UTC+2 (summer); DST switch months are
  // approximated — a 1h shift on two edge days is acceptable for reminders.
  const month = Number(w.date.slice(5, 7));
  const offset = month >= 4 && month <= 10 ? 2 : 1;
  return `${w.date}T${String(hour).padStart(2, "0")}:00:00+0${offset}:00`;
}

export async function confirmAppointment(
  appt: AppointmentRecord,
  startsAt: string,
  durationMin: number
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: `UPDATE appointments SET status = 'confirmed', starts_at = ?, duration_min = ?,
            updated_at = datetime('now') WHERE id = ?`,
    args: [startsAt, durationMin, appt.id],
  });
  if (appt.lead_id) {
    await addEvent(appt.lead_id, null, "appointment_confirmed", "provider", {
      appointmentId: appt.id,
      startsAt,
    });
    await db.execute({
      sql: "UPDATE leads SET status = 'answered' WHERE id = ?",
      args: [appt.lead_id],
    });
  }
}

export async function setAppointmentStatus(
  appt: AppointmentRecord,
  status: AppointmentStatus,
  actor: string
): Promise<void> {
  const db = requireMarketplaceDb();
  await db.execute({
    sql: "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [status, appt.id],
  });
  if (appt.lead_id) {
    await addEvent(appt.lead_id, null, `appointment_${status}`, actor, {
      appointmentId: appt.id,
    });
  }
}

/** Fetch the lead + provider details needed for post-confirm emails. */
export async function getAppointmentContext(appt: AppointmentRecord): Promise<{
  userName: string;
  userEmail: string | null;
  locale: string;
  providerName: string;
  providerEmail: string;
  windows: BookingWindow[];
  slotMinutes: number;
  manageToken: string;
} | null> {
  const db = requireMarketplaceDb();
  const res = await db.execute({
    sql: `SELECT l.name AS user_name, l.email AS user_email, l.locale, l.answers,
                 p.name AS provider_name, p.email AS provider_email,
                 a.manage_token,
                 COALESCE(b.slot_minutes, 60) AS slot_minutes
          FROM appointments a
          JOIN providers p ON p.id = a.provider_id
          LEFT JOIN leads l ON l.id = a.lead_id
          LEFT JOIN booking_settings b ON b.provider_id = a.provider_id
          WHERE a.id = ?`,
    args: [appt.id],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];
  let windows: BookingWindow[] = [];
  try {
    const answers = JSON.parse(String(r.answers ?? "{}"));
    if (Array.isArray(answers.windows)) windows = answers.windows;
  } catch {
    /* no windows */
  }
  return {
    userName: String(r.user_name ?? ""),
    userEmail: (r.user_email as string) || null,
    locale: String(r.locale ?? "fr"),
    providerName: String(r.provider_name),
    providerEmail: String(r.provider_email),
    windows,
    slotMinutes: Number(r.slot_minutes),
    manageToken: String(r.manage_token),
  };
}

/** Post-confirm side effects: user email + reminder scheduling. */
export async function afterConfirm(
  appt: AppointmentRecord,
  startsAt: string
): Promise<void> {
  const ctx = await getAppointmentContext(appt);
  if (!ctx) return;
  const base = getBaseUrl();
  if (ctx.userEmail) {
    await sendBookingConfirmedToUser({
      to: ctx.userEmail,
      name: ctx.userName,
      providerName: ctx.providerName,
      startsAt,
      manageUrl: `${base}/${ctx.locale}/rdv/${ctx.manageToken}`,
      locale: ctx.locale,
    });
  }
  await scheduleReminders(appt.id, startsAt);
}

/**
 * Email a review request for a completed appointment (P3b). Uses the
 * appointment's manage_token as the review token. No-op without a user email.
 */
export async function sendReviewRequestForAppointment(
  appt: AppointmentRecord
): Promise<void> {
  const ctx = await getAppointmentContext(appt);
  if (!ctx || !ctx.userEmail) return;
  const { sendReviewRequest } = await import("./email");
  await sendReviewRequest({
    to: ctx.userEmail,
    name: ctx.userName,
    providerName: ctx.providerName,
    reviewUrl: `${getBaseUrl()}/${ctx.locale}/avis/${ctx.manageToken}`,
    locale: ctx.locale,
  });
}

/** Schedule 24h + 2h reminders via QStash (skipped without QSTASH_TOKEN). */
async function scheduleReminders(appointmentId: string, startsAt: string): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    console.warn("[marketplace] QSTASH_TOKEN missing — reminders not scheduled");
    return;
  }
  const { Client } = await import("@upstash/qstash");
  const qstash = new Client({ token });
  const startMs = new Date(startsAt).getTime();
  const url = `${getBaseUrl()}/api/cron/appointment-reminder`;

  for (const [kind, offsetMs] of [
    ["24h", 24 * 3600_000],
    ["2h", 2 * 3600_000],
  ] as const) {
    const notBefore = Math.floor((startMs - offsetMs) / 1000);
    if (notBefore * 1000 <= Date.now()) continue; // window already past
    try {
      await qstash.publishJSON({
        url,
        body: { appointmentId, kind },
        notBefore,
      });
    } catch (e) {
      console.error(`[marketplace] reminder scheduling failed (${kind}):`, e);
    }
  }
}
