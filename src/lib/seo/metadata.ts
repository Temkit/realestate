/**
 * SEO metadata generation — title, description, Open Graph for static pages.
 */

import type { Metadata } from "next";
import type { ResolvedParams } from "./slugs";
import { getAlternateUrl } from "./slugs";

const BASE_URL = "https://olu.lu";

const TEMPLATES = {
  fr: {
    title: (type: string, mode: string, commune: string) =>
      `${type} ${mode === "buy" ? "à acheter" : "à louer"} à ${commune} | olu.lu`,
    description: (type: string, mode: string, commune: string, count: number) =>
      `${count > 0 ? count : ""} ${type.toLowerCase()}${count !== 1 ? "s" : ""} ${mode === "buy" ? "à vendre" : "en location"} à ${commune}, Luxembourg. Prix, photos et analyse du marché immobilier.`,
  },
  en: {
    title: (type: string, mode: string, commune: string) =>
      `${type} for ${mode === "buy" ? "sale" : "rent"} in ${commune} | olu.lu`,
    description: (type: string, mode: string, commune: string, count: number) =>
      `${count > 0 ? count : ""} ${type.toLowerCase()}${count !== 1 ? "s" : ""} for ${mode === "buy" ? "sale" : "rent"} in ${commune}, Luxembourg. Prices, photos and real estate market analysis.`,
  },
};

export function generatePageMetadata(
  resolved: ResolvedParams,
  propertyCount: number,
  modeSlug: string,
  typeSlug: string,
  communeSlug: string
): Metadata {
  const t = TEMPLATES[resolved.locale as "fr" | "en"] || TEMPLATES.en;
  const title = t.title(resolved.typeDisplay, resolved.mode, resolved.commune);
  const description = t.description(
    resolved.typeDisplay,
    resolved.mode,
    resolved.commune,
    propertyCount
  );

  const canonical = `${BASE_URL}/${resolved.locale}/${modeSlug}/${typeSlug}/${communeSlug}`;
  const alternate = getAlternateUrl(
    resolved.locale,
    modeSlug,
    typeSlug,
    communeSlug
  );

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: "olu.lu",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical,
      languages: {
        [alternate.locale]: `${BASE_URL}${alternate.path}`,
        [resolved.locale]: canonical,
      },
    },
  };
}
