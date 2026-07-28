"use server";

/**
 * Public form server actions (quote lead + booking request).
 * Guards: Zod, in-memory rate limit per IP, honeypot field, consent required.
 * Redirects back to the source page with ?lead= / ?error= status params.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { NEARBY_COMMUNES } from "@/lib/communes";
import { getMarketplaceDb } from "./db";
import { createBookingRequest, createLead } from "./leads";
import type { BookingWindow } from "./types";

const leadFormSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    commune: z.string().trim().max(60).optional().or(z.literal("")),
    message: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((d) => (d.email && d.email !== "") || (d.phone && d.phone !== ""), {
    message: "email or phone required",
  });

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

async function guard(
  fd: FormData,
  backTo: string
): Promise<void> {
  // Honeypot: bots fill the hidden "website2" field
  if (str(fd, "website2") !== "") redirect(`${backTo}?lead=ok`);
  if (str(fd, "consent") !== "on") redirect(`${backTo}?error=consent`);

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const { allowed } = checkRateLimit(`mkt-lead:${ip}`);
  if (!allowed) redirect(`${backTo}?error=rate`);
}

interface FormContext {
  verticalId: number;
  categoryId: number;
  categoryNameFr: string;
  categoryNameEn: string;
  locale: string;
}

async function loadContext(fd: FormData): Promise<FormContext | null> {
  const db = getMarketplaceDb();
  if (!db) return null;
  const categoryId = Number(str(fd, "category_id"));
  if (!Number.isInteger(categoryId) || categoryId <= 0) return null;
  const res = await db.execute({
    sql: `SELECT c.id, c.vertical_id, c.name_fr, c.name_en
          FROM categories c JOIN verticals v ON v.id = c.vertical_id
          WHERE c.id = ? AND c.active = 1 AND v.active = 1`,
    args: [categoryId],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];
  const locale = str(fd, "locale") === "en" ? "en" : "fr";
  return {
    verticalId: Number(r.vertical_id),
    categoryId,
    categoryNameFr: String(r.name_fr),
    categoryNameEn: String(r.name_en),
    locale,
  };
}

function parseLeadFields(fd: FormData, backTo: string) {
  try {
    return leadFormSchema.parse({
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      commune: str(fd, "commune"),
      message: str(fd, "message"),
    });
  } catch (e) {
    if (e instanceof ZodError) redirect(`${backTo}?error=invalid`);
    throw e;
  }
}

async function loadProvider(providerId: number) {
  const db = getMarketplaceDb();
  if (!db) return null;
  const res = await db.execute({
    sql: "SELECT id, email, name FROM providers WHERE id = ? AND status = 'active'",
    args: [providerId],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return { id: Number(r.id), email: String(r.email), name: String(r.name) };
}

/** Quote request — fan-out (commune/category pages) or pinned (profile). */
export async function submitLeadAction(formData: FormData): Promise<void> {
  const backTo = str(formData, "back_to") || "/";
  await guard(formData, backTo);

  const ctx = await loadContext(formData);
  if (!ctx) redirect(`${backTo}?error=invalid`);
  const fields = parseLeadFields(formData, backTo);

  const communeRaw = fields.commune ?? "";
  const commune = NEARBY_COMMUNES[communeRaw] !== undefined ? communeRaw : null;

  const providerId = Number(str(formData, "provider_id"));
  const pinned = providerId > 0 ? await loadProvider(providerId) : null;
  if (providerId > 0 && !pinned) redirect(`${backTo}?error=invalid`);

  const { dispatched } = await createLead(
    {
      verticalId: ctx.verticalId,
      categoryId: ctx.categoryId,
      categoryNameFr: ctx.categoryNameFr,
      categoryNameForUser: ctx.locale === "en" ? ctx.categoryNameEn : ctx.categoryNameFr,
      name: fields.name,
      email: fields.email || null,
      phone: fields.phone || null,
      commune,
      message: fields.message || null,
      answers: {},
      locale: ctx.locale,
      sourcePage: backTo,
    },
    pinned ?? undefined
  );

  redirect(`${backTo}?lead=${dispatched > 0 ? "ok" : "queued"}`);
}

/** Level-1 booking request — always pinned to one provider. */
export async function submitBookingAction(formData: FormData): Promise<void> {
  const backTo = str(formData, "back_to") || "/";
  await guard(formData, backTo);

  const ctx = await loadContext(formData);
  if (!ctx) redirect(`${backTo}?error=invalid`);
  const fields = parseLeadFields(formData, backTo);

  const provider = await loadProvider(Number(str(formData, "provider_id")));
  if (!provider) redirect(`${backTo}?error=invalid`);

  const windows: BookingWindow[] = [];
  for (const i of [0, 1]) {
    const date = str(formData, `window_date_${i}`);
    const period = str(formData, `window_period_${i}`);
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      (period === "morning" || period === "afternoon") &&
      date >= new Date().toISOString().slice(0, 10)
    ) {
      windows.push({ date, period });
    }
  }
  if (windows.length === 0) redirect(`${backTo}?error=windows`);

  await createBookingRequest(
    {
      verticalId: ctx.verticalId,
      categoryId: ctx.categoryId,
      categoryNameFr: ctx.categoryNameFr,
      categoryNameForUser: ctx.locale === "en" ? ctx.categoryNameEn : ctx.categoryNameFr,
      name: fields.name,
      email: fields.email || null,
      phone: fields.phone || null,
      commune: null,
      message: fields.message || null,
      answers: {},
      locale: ctx.locale,
      sourcePage: backTo,
    },
    provider,
    windows
  );

  redirect(`${backTo}?lead=booking`);
}

/** Level-2 auto-confirm booking from the slot picker. */
export async function submitAutoBookAction(formData: FormData): Promise<void> {
  const backTo = str(formData, "back_to") || "/";
  await guard(formData, backTo);

  const ctx = await loadContext(formData);
  if (!ctx) redirect(`${backTo}?error=invalid`);
  const fields = parseLeadFields(formData, backTo);

  const provider = await loadProvider(Number(str(formData, "provider_id")));
  if (!provider) redirect(`${backTo}?error=invalid`);

  const slot = str(formData, "slot");
  const { computeAvailableSlots } = await import("./slots");
  const { config, days } = await computeAvailableSlots(provider.id, 60);
  const valid =
    config.mode === "auto" && days.some((d) => d.slots.some((s) => s.iso === slot));
  if (!valid) redirect(`${backTo}?error=slot_taken`);

  const { createAutoBooking } = await import("./leads");
  const result = await createAutoBooking(
    {
      verticalId: ctx.verticalId,
      categoryId: ctx.categoryId,
      categoryNameFr: ctx.categoryNameFr,
      categoryNameForUser: ctx.locale === "en" ? ctx.categoryNameEn : ctx.categoryNameFr,
      name: fields.name,
      email: fields.email || null,
      phone: fields.phone || null,
      commune: null,
      message: fields.message || null,
      answers: {},
      locale: ctx.locale,
      sourcePage: backTo,
    },
    provider,
    slot,
    config.slot_minutes
  );
  if (!result) redirect(`${backTo}?error=slot_taken`);

  redirect(`${backTo}?lead=confirmed`);
}

/** Claim a directory listing (unclaimed 'listed' provider). */
export async function submitClaimAction(formData: FormData): Promise<void> {
  const backTo = str(formData, "back_to") || "/";
  // Honeypot + rate limit + consent (reuses the same guard as lead forms)
  await guard(formData, backTo);

  const providerId = Number(str(formData, "provider_id"));
  const contactName = str(formData, "contact_name");
  const email = str(formData, "email");
  const phone = str(formData, "phone") || null;
  const message = str(formData, "message") || null;

  const parsed = z
    .object({ contactName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200) })
    .safeParse({ contactName, email });
  if (!providerId || !parsed.success) redirect(`${backTo}?error=invalid`);

  const db = getMarketplaceDb();
  if (!db) redirect(`${backTo}?error=invalid`);

  // Only 'listed' (unclaimed) providers can be claimed
  const prov = await db.execute({
    sql: "SELECT name, status FROM providers WHERE id = ?",
    args: [providerId],
  });
  if (!prov.rows.length || prov.rows[0].status !== "listed") redirect(`${backTo}?error=invalid`);

  const { randomId } = await import("./tokens");
  await db.execute({
    sql: `INSERT INTO provider_claims (id, provider_id, contact_name, email, phone, message)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [randomId(), providerId, contactName, email, phone, message],
  });

  const { sendClaimToOps } = await import("./email");
  await sendClaimToOps({
    providerName: String(prov.rows[0].name),
    providerId,
    contactName,
    email,
    phone,
    message,
  });

  redirect(`${backTo}?claim=ok`);
}

/** Submit a review from the tokenized /avis/[token] page (P3b). */
export async function submitReviewAction(formData: FormData): Promise<void> {
  const token = str(formData, "token");
  const locale = str(formData, "locale") === "en" ? "en" : "fr";
  const backTo = `/${locale}/avis/${token}`;
  if (!token) redirect(`/${locale}`);

  const rating = Number(str(formData, "rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`${backTo}?error=rating`);
  }
  const comment = str(formData, "comment").slice(0, 2000) || null;

  const { getAppointmentByToken, getAppointmentContext } = await import("./leads");
  const appt = await getAppointmentByToken("manage", token);
  // Only a completed appointment can be reviewed
  if (!appt || appt.status !== "completed") redirect(`${backTo}?error=state`);

  const { appointmentHasReview, createReview } = await import("./reviews");
  if (await appointmentHasReview(appt.id)) redirect(`${backTo}?done=1`);

  const ctx = await getAppointmentContext(appt);
  const ok = await createReview({
    providerId: appt.provider_id,
    appointmentId: appt.id,
    leadId: appt.lead_id,
    authorName: ctx?.userName || "Client",
    rating,
    comment,
  });
  redirect(`${backTo}?${ok ? "done=1" : "error=state"}`);
}

/** User-side cancellation from the /rdv/[token] manage page. */
export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const token = str(formData, "token");
  const locale = str(formData, "locale") === "en" ? "en" : "fr";
  if (!token) redirect(`/${locale}`);

  const { getAppointmentByToken, setAppointmentStatus } = await import("./leads");
  const appt = await getAppointmentByToken("manage", token);
  if (appt && (appt.status === "requested" || appt.status === "confirmed")) {
    await setAppointmentStatus(appt, "cancelled_user", "user");
  }
  redirect(`/${locale}/rdv/${token}`);
}
