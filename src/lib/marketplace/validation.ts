/** Zod schemas for admin server actions (spec §6). */

import { z } from "zod";
import { RESERVED_SLUGS } from "./types";

export const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits and dashes only");

export const providerSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(2).max(120),
  vat_number: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  commune: z.string().trim().max(60).optional().or(z.literal("")),
  logo_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  description_en: z.string().trim().max(2000).optional().or(z.literal("")),
  description_fr: z.string().trim().max(2000).optional().or(z.literal("")),
  languages: z.array(z.enum(["fr", "de", "lb", "en", "pt"])).default([]),
  status: z.enum(["draft", "active", "paused", "churned"]).default("draft"),
  plan: z.enum(["free", "starter", "pro"]).default("free"),
  /** Euros in the form; converted to cents in the action. */
  cpl_eur: z.coerce.number().min(0).max(500).optional(),
  sales_rep: z.string().trim().max(100).optional().or(z.literal("")),
  signed_at: z.string().trim().max(10).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const offerSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  title_en: z.string().trim().min(2).max(200),
  title_fr: z.string().trim().min(2).max(200),
  price_type: z.enum(["fixed", "from", "hourly", "quote"]),
  price_eur: z.coerce.number().min(0).max(100000).optional(),
});

export const bookingSettingsSchema = z.object({
  mode: z.enum(["request", "auto"]),
  slot_minutes: z.coerce.number().int().min(10).max(480),
  buffer_minutes: z.coerce.number().int().min(0).max(120),
  min_lead_hours: z.coerce.number().int().min(0).max(168),
  max_horizon_days: z.coerce.number().int().min(1).max(365),
});

export const categorySchema = z.object({
  vertical_id: z.coerce.number().int().positive(),
  slug: slugSchema,
  name_en: z.string().trim().min(2).max(100),
  name_fr: z.string().trim().min(2).max(100),
});

export const verticalSlugSchema = slugSchema.refine(
  (s) => !RESERVED_SLUGS.includes(s),
  { message: "slug is reserved by an existing route" }
);
