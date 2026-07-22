/** Marketplace row types — mirror scripts/marketplace/schema.mjs. */

export type ProviderStatus = "draft" | "active" | "paused" | "churned";
export type ProviderPlan = "free" | "starter" | "pro";
export type PriceType = "fixed" | "from" | "hourly" | "quote";
export type BookingMode = "request" | "auto";

export interface Vertical {
  id: number;
  slug: string;
  name_en: string;
  name_fr: string;
  attribute_schema: AttributeSchema;
  lead_form_schema: Record<string, unknown>;
  booking_enabled: boolean;
  active: boolean;
  sort: number;
}

export interface AttributeField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
}

export interface AttributeSchema {
  fields?: AttributeField[];
}

export interface Category {
  id: number;
  vertical_id: number;
  slug: string;
  name_en: string;
  name_fr: string;
  active: boolean;
}

export interface Provider {
  id: number;
  slug: string;
  name: string;
  vat_number: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  commune: string | null;
  logo_url: string | null;
  photos: string[];
  description_en: string | null;
  description_fr: string | null;
  languages: string[];
  status: ProviderStatus;
  plan: ProviderPlan;
  cpl_cents: number | null;
  sales_rep: string | null;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Offer {
  id: number;
  provider_id: number;
  category_id: number;
  title_en: string;
  title_fr: string;
  price_type: PriceType;
  price_cents: number | null;
  attributes: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface BookingSettings {
  provider_id: number;
  mode: BookingMode;
  slot_minutes: number;
  buffer_minutes: number;
  min_lead_hours: number;
  max_horizon_days: number;
}

/** Vertical slugs may not shadow existing top-level route segments. */
export const RESERVED_SLUGS = [
  "buy",
  "rent",
  "acheter",
  "louer",
  "admin",
  "api",
  "pro",
  "immo",
  "fr",
  "en",
];
