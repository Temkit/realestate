/** Locale display helpers for marketplace entities. */

import { COMMUNES } from "@/lib/seo/slugs";
import type { Category, Offer, Vertical } from "./types";

export function vname(v: Vertical, locale: string): string {
  return locale === "en" ? v.name_en : v.name_fr;
}

export function cname(c: Category, locale: string): string {
  return locale === "en" ? c.name_en : c.name_fr;
}

export function communeDisplay(slug: string): string {
  const featured = COMMUNES.find((c) => c.slug === slug);
  if (featured) return featured.display;
  return slug
    .split("-")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join("-");
}

export function priceLabel(o: Offer, locale: string): string {
  if (o.price_type === "quote" || o.price_cents == null) {
    return locale === "en" ? "on quote" : "sur devis";
  }
  const eur = `${(o.price_cents / 100).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 2 })} €`;
  if (o.price_type === "from") return locale === "en" ? `from ${eur}` : `à partir de ${eur}`;
  if (o.price_type === "hourly") return `${eur}/h`;
  return eur;
}

export function offerTitle(o: Offer, locale: string): string {
  return locale === "en" ? o.title_en : o.title_fr;
}

/** A Google Maps directions link from coords (preferred) or a text query. */
export function directionsUrl(opts: {
  lat: number | null;
  lon: number | null;
  name: string;
  address: string | null;
  commune: string | null;
}): string {
  if (opts.lat != null && opts.lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${opts.lat},${opts.lon}`;
  }
  const q = [opts.name, opts.address, opts.commune && communeDisplay(opts.commune), "Luxembourg"]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

/** Compact opening-hours summary from an OSM opening_hours string. */
export function shortHours(oh: string | null): string | null {
  if (!oh) return null;
  if (/24\/7/.test(oh)) return "24/7";
  // Show the first rule (e.g. "Mo-Fr 08:00-18:00"); drop the rest for the card.
  const first = oh.split(";")[0].trim();
  return first.length > 32 ? first.slice(0, 32) + "…" : first;
}
