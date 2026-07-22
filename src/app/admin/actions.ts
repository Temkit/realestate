"use server";

/**
 * Admin server actions — every mutation re-checks the session (defense in
 * depth; the layout guard alone doesn't protect actions). Validation via Zod;
 * failures redirect back with a human-readable ?error=.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import {
  clearSessionCookie,
  requireAdmin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/marketplace/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  bookingSettingsSchema,
  categorySchema,
  offerSchema,
  providerSchema,
  verticalSlugSchema,
} from "@/lib/marketplace/validation";
import {
  createCategory,
  createOffer,
  createProvider,
  createVertical,
  listVerticals,
  setCategoryActive,
  setOfferActive,
  setProviderCategories,
  setProviderCoverage,
  setVerticalFlags,
  updateProvider,
  upsertBookingSettings,
} from "@/lib/marketplace/queries";
import { NEARBY_COMMUNES } from "@/lib/communes";
import type { AttributeField } from "@/lib/marketplace/types";

function firstZodMessage(e: ZodError): string {
  const issue = e.issues[0];
  if (!issue) return "validation failed";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function orNull(s: string): string | null {
  return s === "" ? null : s;
}

// ── Auth ──────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData): Promise<void> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const { allowed } = checkRateLimit(`admin-login:${ip}`);
  if (!allowed) redirect("/admin/login?error=rate");

  if (!process.env.ADMIN_PASSWORD) redirect("/admin/login?error=config");

  const password = str(formData, "password");
  if (!password || !verifyPassword(password)) {
    redirect("/admin/login?error=cred");
  }
  await setSessionCookie();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/admin/login");
}

// ── Providers ─────────────────────────────────────────────────────────

export async function saveProviderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const backTo = id ? `/admin/providers/${id}` : "/admin/providers/new";

  const raw: Record<string, unknown> = {
    slug: str(formData, "slug"),
    name: str(formData, "name"),
    vat_number: str(formData, "vat_number"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    whatsapp: str(formData, "whatsapp"),
    website: str(formData, "website"),
    address: str(formData, "address"),
    commune: str(formData, "commune"),
    logo_url: str(formData, "logo_url"),
    description_en: str(formData, "description_en"),
    description_fr: str(formData, "description_fr"),
    languages: formData.getAll("languages").map(String),
    status: str(formData, "status"),
    plan: str(formData, "plan"),
    sales_rep: str(formData, "sales_rep"),
    signed_at: str(formData, "signed_at"),
    notes: str(formData, "notes"),
  };
  // z.coerce.number() turns "" into 0 — only pass cpl when the field was filled
  const cplRaw = str(formData, "cpl_eur");
  if (cplRaw !== "") raw.cpl_eur = cplRaw;

  let parsed: z.infer<typeof providerSchema>;
  try {
    parsed = providerSchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      redirect(`${backTo}?error=${encodeURIComponent(firstZodMessage(e))}`);
    }
    throw e;
  }

  const categoryIds = formData
    .getAll("category_ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  const coverageAll = formData.get("coverage_all") === "on";
  const validCommunes = new Set(Object.keys(NEARBY_COMMUNES));
  const coverage = coverageAll
    ? ["*"]
    : formData
        .getAll("coverage")
        .map(String)
        .filter((c) => validCommunes.has(c));

  const input = {
    slug: parsed.slug,
    name: parsed.name,
    vat_number: orNull(parsed.vat_number ?? ""),
    email: parsed.email,
    phone: orNull(parsed.phone ?? ""),
    whatsapp: orNull(parsed.whatsapp ?? ""),
    website: orNull(parsed.website ?? ""),
    address: orNull(parsed.address ?? ""),
    commune: orNull(parsed.commune ?? ""),
    logo_url: orNull(parsed.logo_url ?? ""),
    description_en: orNull(parsed.description_en ?? ""),
    description_fr: orNull(parsed.description_fr ?? ""),
    languages: parsed.languages,
    status: parsed.status,
    plan: parsed.plan,
    cpl_cents: parsed.cpl_eur === undefined ? null : Math.round(parsed.cpl_eur * 100),
    sales_rep: orNull(parsed.sales_rep ?? ""),
    signed_at: orNull(parsed.signed_at ?? ""),
    notes: orNull(parsed.notes ?? ""),
  };

  let providerId: number;
  try {
    if (id) {
      providerId = Number(id);
      await updateProvider(providerId, input);
    } else {
      providerId = await createProvider(input);
    }
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes("UNIQUE")
        ? "slug already exists"
        : "database error";
    redirect(`${backTo}?error=${encodeURIComponent(msg)}`);
  }

  await setProviderCategories(providerId, categoryIds);
  await setProviderCoverage(providerId, coverage);

  revalidatePath("/admin/providers");
  redirect(`/admin/providers/${providerId}?saved=1`);
}

export async function saveBookingSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const providerId = Number(str(formData, "provider_id"));
  if (!providerId) redirect("/admin/providers");

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
    if (e instanceof ZodError) {
      redirect(
        `/admin/providers/${providerId}?error=${encodeURIComponent(firstZodMessage(e))}`
      );
    }
    throw e;
  }
  redirect(`/admin/providers/${providerId}?saved=1`);
}

// ── Offers ────────────────────────────────────────────────────────────

export async function createOfferAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const providerId = Number(str(formData, "provider_id"));
  if (!providerId) redirect("/admin/providers");
  const backTo = `/admin/providers/${providerId}/offers`;

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
    if (e instanceof ZodError) {
      redirect(`${backTo}?error=${encodeURIComponent(firstZodMessage(e))}`);
    }
    throw e;
  }

  // Rebuild attributes from the vertical's schema fields (attr_<key> inputs)
  const fieldsJson = str(formData, "attribute_fields");
  const attributes: Record<string, unknown> = {};
  if (fieldsJson) {
    let fields: AttributeField[] = [];
    try {
      fields = JSON.parse(fieldsJson) as AttributeField[];
    } catch {
      /* no attribute fields */
    }
    for (const f of fields) {
      const v = formData.get(`attr_${f.key}`);
      if (f.type === "boolean") {
        attributes[f.key] = v === "on";
      } else if (v !== null && String(v).trim() !== "") {
        attributes[f.key] = f.type === "number" ? Number(v) : String(v).trim();
      }
    }
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
    attributes,
  });
  redirect(`${backTo}?saved=1`);
}

export async function toggleOfferAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(str(formData, "id"));
  const providerId = Number(str(formData, "provider_id"));
  const active = str(formData, "active") === "1";
  if (id) await setOfferActive(id, active);
  redirect(`/admin/providers/${providerId}/offers`);
}

// ── Config (verticals + categories) ───────────────────────────────────

export async function createVerticalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    const slug = verticalSlugSchema.parse(str(formData, "slug"));
    const name_en = z.string().trim().min(2).max(100).parse(str(formData, "name_en"));
    const name_fr = z.string().trim().min(2).max(100).parse(str(formData, "name_fr"));
    const existing = await listVerticals();
    const maxSort = Math.max(0, ...existing.map((v) => v.sort));
    await createVertical({ slug, name_en, name_fr, sort: maxSort + 1 });
  } catch (e) {
    if (e instanceof ZodError) {
      redirect(`/admin/config?error=${encodeURIComponent(firstZodMessage(e))}`);
    }
    redirect(`/admin/config?error=${encodeURIComponent("could not create vertical (duplicate slug?)")}`);
  }
  redirect("/admin/config?saved=1");
}

export async function toggleVerticalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(str(formData, "id"));
  const flag = str(formData, "flag"); // 'active' | 'booking_enabled'
  const value = str(formData, "value") === "1";
  if (id && (flag === "active" || flag === "booking_enabled")) {
    await setVerticalFlags(id, { [flag]: value });
  }
  redirect("/admin/config");
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    const parsed = categorySchema.parse({
      vertical_id: str(formData, "vertical_id"),
      slug: str(formData, "slug"),
      name_en: str(formData, "name_en"),
      name_fr: str(formData, "name_fr"),
    });
    await createCategory(parsed);
  } catch (e) {
    if (e instanceof ZodError) {
      redirect(`/admin/config?error=${encodeURIComponent(firstZodMessage(e))}`);
    }
    redirect(`/admin/config?error=${encodeURIComponent("could not create category (duplicate slug?)")}`);
  }
  redirect("/admin/config?saved=1");
}

export async function toggleCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(str(formData, "id"));
  const active = str(formData, "active") === "1";
  if (id) await setCategoryActive(id, active);
  redirect("/admin/config");
}
