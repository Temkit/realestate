"use server";

/**
 * Provider-portal server actions. Every mutation re-derives the provider id
 * from the session (requireProvider) — never from a form field — and every
 * query is scoped by that id (OWASP A01).
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import {
  clearProviderSession,
  requireProvider,
  signLoginToken,
} from "@/lib/marketplace/provider-auth";
import {
  getProviderByEmail,
  providerOwnsCategory,
  providerSetDispatchStatus,
  providerSetOfferActive,
  providerUpdateOffer,
  updateProviderProfile,
  getProviderAppointment,
  type ProviderProfileInput,
} from "@/lib/marketplace/provider-queries";
import { getBaseUrl, sendProviderLoginLink } from "@/lib/marketplace/email";
import { createOffer, upsertBookingSettings } from "@/lib/marketplace/queries";
import {
  addAvailabilityRule,
  addAvailabilityException,
  deleteAvailabilityRule,
  deleteAvailabilityException,
} from "@/lib/marketplace/admin-queries";
import { bookingSettingsSchema, offerSchema } from "@/lib/marketplace/validation";

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}
function orNull(s: string): string | null {
  return s === "" ? null : s;
}

// ── Login ─────────────────────────────────────────────────────────────

export async function requestLoginLinkAction(formData: FormData): Promise<void> {
  const hdrs = await headers();
  const ip = clientIpFromHeaders(hdrs);
  if (!checkRateLimit(`portal-login:${ip}`).allowed) {
    redirect("/portal/login?sent=1"); // don't reveal rate-limit to enumerators
  }

  const email = str(formData, "email");
  const parsed = z.string().email().safeParse(email);
  if (parsed.success) {
    const provider = await getProviderByEmail(parsed.data);
    if (provider) {
      const token = signLoginToken(provider.id);
      if (token) {
        await sendProviderLoginLink({
          to: provider.email,
          providerName: provider.name,
          loginUrl: `${getBaseUrl()}/api/portal/verify/${token}`,
        });
      }
    }
  }
  // Always the same response — never leak whether the email is registered
  redirect("/portal/login?sent=1");
}

export async function logoutAction(): Promise<void> {
  await clearProviderSession();
  redirect("/portal/login");
}

// ── Profile ───────────────────────────────────────────────────────────

const profileSchema = z.object({
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  description_fr: z.string().trim().max(2000).optional().or(z.literal("")),
  description_en: z.string().trim().max(2000).optional().or(z.literal("")),
  logo_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  languages: z.array(z.enum(["fr", "de", "lb", "en", "pt"])).default([]),
});

const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Compose an OSM opening_hours string from the 7-day portal form. */
function composeHours(fd: FormData): string | null {
  const parts: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (fd.get(`day_${i}_closed`) === "on") continue;
    const open = String(fd.get(`day_${i}_open`) ?? "").trim();
    const close = String(fd.get(`day_${i}_close`) ?? "").trim();
    if (TIME_RE.test(open) && TIME_RE.test(close) && open < close) {
      parts.push(`${OSM_DAYS[i]} ${open}-${close}`);
    }
  }
  return parts.length ? parts.join("; ") : null;
}

/** Parse a photos textarea (one URL per line) into a capped, valid list. */
function parsePhotos(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/\S+$/.test(s))
    .slice(0, 8);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  let parsed: z.infer<typeof profileSchema>;
  try {
    parsed = profileSchema.parse({
      phone: str(formData, "phone"),
      whatsapp: str(formData, "whatsapp"),
      website: str(formData, "website"),
      address: str(formData, "address"),
      description_fr: str(formData, "description_fr"),
      description_en: str(formData, "description_en"),
      logo_url: str(formData, "logo_url"),
      languages: formData.getAll("languages").map(String),
    });
  } catch (e) {
    if (e instanceof ZodError) redirect("/portal/profile?error=invalid");
    throw e;
  }
  const input: ProviderProfileInput = {
    phone: orNull(parsed.phone ?? ""),
    whatsapp: orNull(parsed.whatsapp ?? ""),
    website: orNull(parsed.website ?? ""),
    address: orNull(parsed.address ?? ""),
    description_fr: orNull(parsed.description_fr ?? ""),
    description_en: orNull(parsed.description_en ?? ""),
    logo_url: orNull(parsed.logo_url ?? ""),
    languages: parsed.languages,
    opening_hours: composeHours(formData),
    photos: parsePhotos(str(formData, "photos")),
  };
  await updateProviderProfile(providerId, input);
  redirect("/portal/profile?saved=1");
}

// ── Leads ─────────────────────────────────────────────────────────────

export async function respondLeadAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const dispatchId = Number(str(formData, "dispatch_id"));
  const status = str(formData, "status");
  if (dispatchId && ["answered", "disputed", "converted"].includes(status)) {
    await providerSetDispatchStatus(providerId, dispatchId, status as "answered");
  }
  redirect("/portal/leads?saved=1");
}

// ── Appointments ──────────────────────────────────────────────────────

export async function confirmAppointmentPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const appointmentId = str(formData, "appointment_id");
  const windowIndex = Number(str(formData, "window"));

  const owned = await getProviderAppointment(providerId, appointmentId);
  if (!owned || owned.status !== "requested") redirect("/portal/appointments?error=state");

  const { getAppointmentContext, confirmAppointment, afterConfirm, windowToStartsAt } =
    await import("@/lib/marketplace/leads");
  // Shape an AppointmentRecord for the shared helpers (already ownership-checked)
  const record = {
    id: owned.id,
    lead_id: owned.lead_id,
    provider_id: providerId,
    category_id: null,
    starts_at: owned.starts_at,
    duration_min: null,
    status: owned.status,
  };
  const ctx = await getAppointmentContext(record);
  if (!ctx) redirect("/portal/appointments?error=state");
  const window = ctx.windows[windowIndex];
  if (!window) redirect("/portal/appointments?error=state");

  const startsAt = windowToStartsAt(window);
  await confirmAppointment(record, startsAt, ctx.slotMinutes);
  await afterConfirm(record, startsAt);
  redirect("/portal/appointments?saved=1");
}

export async function setAppointmentStatusPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const appointmentId = str(formData, "appointment_id");
  const status = str(formData, "status");
  const allowed = ["declined", "completed", "no_show", "cancelled_provider"];
  if (!allowed.includes(status)) redirect("/portal/appointments");

  const owned = await getProviderAppointment(providerId, appointmentId);
  if (!owned) redirect("/portal/appointments?error=state");

  // State-machine guard: decline only a pending request; complete/no-show/
  // cancel only a confirmed appointment.
  const legal =
    (status === "declined" && owned.status === "requested") ||
    (["completed", "no_show", "cancelled_provider"].includes(status) &&
      owned.status === "confirmed");
  if (!legal) redirect("/portal/appointments?error=state");

  const { setAppointmentStatus, getAppointmentContext } = await import("@/lib/marketplace/leads");
  const record = {
    id: owned.id,
    lead_id: owned.lead_id,
    provider_id: providerId,
    category_id: null,
    starts_at: owned.starts_at,
    duration_min: null,
    status: owned.status,
  };
  await setAppointmentStatus(record, status as "completed", "provider");

  // Ask the customer for a review once the appointment is done
  if (status === "completed") {
    const { sendReviewRequestForAppointment } = await import("@/lib/marketplace/leads");
    await sendReviewRequestForAppointment(record);
  }

  // Notify the user when a confirmed appointment is cancelled by the provider
  if (status === "cancelled_provider" && owned.status === "confirmed") {
    const ctx = await getAppointmentContext(record);
    if (ctx?.userEmail) {
      const { sendBookingCancelledToUser } = await import("@/lib/marketplace/email");
      await sendBookingCancelledToUser({
        to: ctx.userEmail,
        name: ctx.userName,
        providerName: ctx.providerName,
        startsAt: owned.starts_at,
        locale: ctx.locale,
      });
    }
  }
  redirect("/portal/appointments?saved=1");
}

// ── Offers ────────────────────────────────────────────────────────────

export async function createOfferPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  let parsed: z.infer<typeof offerSchema>;
  const raw: Record<string, unknown> = {
    category_id: str(formData, "category_id"),
    title_en: str(formData, "title_en"),
    title_fr: str(formData, "title_fr"),
    price_type: str(formData, "price_type"),
  };
  const priceRaw = str(formData, "price_eur");
  if (priceRaw !== "") raw.price_eur = priceRaw;
  try {
    parsed = offerSchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) redirect("/portal/offers?error=invalid");
    throw e;
  }
  // Ownership: the category must belong to this provider
  if (!(await providerOwnsCategory(providerId, parsed.category_id))) {
    redirect("/portal/offers?error=category");
  }
  await createOffer({
    provider_id: providerId,
    category_id: parsed.category_id,
    title_en: parsed.title_en,
    title_fr: parsed.title_fr,
    price_type: parsed.price_type,
    price_cents:
      parsed.price_type === "quote" || parsed.price_eur === undefined
        ? null
        : Math.round(parsed.price_eur * 100),
    attributes: {},
  });
  const { revalidateProviderPaths } = await import("@/lib/marketplace/revalidate");
  await revalidateProviderPaths([parsed.category_id]);
  redirect("/portal/offers?saved=1");
}

export async function updateOfferPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const offerId = Number(str(formData, "offer_id"));
  const raw: Record<string, unknown> = {
    category_id: str(formData, "category_id") || "1", // schema requires it; not used for update
    title_en: str(formData, "title_en"),
    title_fr: str(formData, "title_fr"),
    price_type: str(formData, "price_type"),
  };
  const priceRaw = str(formData, "price_eur");
  if (priceRaw !== "") raw.price_eur = priceRaw;
  let parsed: z.infer<typeof offerSchema>;
  try {
    parsed = offerSchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) redirect("/portal/offers?error=invalid");
    throw e;
  }
  await providerUpdateOffer(providerId, offerId, {
    title_fr: parsed.title_fr,
    title_en: parsed.title_en,
    price_type: parsed.price_type,
    price_cents:
      parsed.price_type === "quote" || parsed.price_eur === undefined
        ? null
        : Math.round(parsed.price_eur * 100),
  });
  redirect("/portal/offers?saved=1");
}

export async function toggleOfferPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const offerId = Number(str(formData, "offer_id"));
  const active = str(formData, "active") === "1";
  if (offerId) await providerSetOfferActive(providerId, offerId, active);
  redirect("/portal/offers?saved=1");
}

// ── Availability & booking mode ───────────────────────────────────────

export async function saveBookingModeAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  try {
    const parsed = bookingSettingsSchema.parse({
      mode: str(formData, "mode"),
      slot_minutes: str(formData, "slot_minutes"),
      buffer_minutes: str(formData, "buffer_minutes"),
      min_lead_hours: str(formData, "min_lead_hours"),
      max_horizon_days: str(formData, "max_horizon_days"),
    });
    await upsertBookingSettings(providerId, parsed);
  } catch (e) {
    if (e instanceof ZodError) redirect("/portal/availability?error=invalid");
    throw e;
  }
  redirect("/portal/availability?saved=1");
}

export async function addRulePortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const weekday = Number(str(formData, "weekday"));
  const open = str(formData, "open_time");
  const close = str(formData, "close_time");
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (weekday >= 0 && weekday <= 6 && timeRe.test(open) && timeRe.test(close) && open < close) {
    await addAvailabilityRule(providerId, weekday, open, close);
  } else {
    redirect("/portal/availability?error=invalid");
  }
  redirect("/portal/availability?saved=1");
}

export async function deleteRulePortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const id = Number(str(formData, "id"));
  if (id) await deleteAvailabilityRule(id, providerId); // scoped by provider_id
  redirect("/portal/availability");
}

export async function addExceptionPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const date = str(formData, "date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) await addAvailabilityException(providerId, date);
  redirect("/portal/availability?saved=1");
}

export async function deleteExceptionPortalAction(formData: FormData): Promise<void> {
  const providerId = await requireProvider();
  const id = Number(str(formData, "id"));
  if (id) await deleteAvailabilityException(id, providerId);
  redirect("/portal/availability");
}
