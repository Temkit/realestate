import type { MetadataRoute } from "next";
import { allCombinations, getAlternateUrl } from "@/lib/seo/slugs";

const BASE_URL = "https://olu.lu";

const staticPages = [
  "",
  "/about",
  "/privacy",
  "/terms",
  "/mentions-legales",
  "/cookies",
];

const locales = ["fr", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  for (const page of staticPages) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === "" ? "daily" : "monthly",
        priority: page === "" ? 1 : 0.5,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${BASE_URL}/${l}${page}`])
          ),
        },
      });
    }
  }

  // SEO search pages (192 combinations)
  for (const combo of allCombinations()) {
    const path = `/${combo.locale}/${combo.mode}/${combo.propertyType}/${combo.commune}`;
    const alternate = getAlternateUrl(
      combo.locale,
      combo.mode,
      combo.propertyType,
      combo.commune
    );

    entries.push({
      url: `${BASE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
      alternates: {
        languages: {
          [combo.locale]: `${BASE_URL}${path}`,
          [alternate.locale]: `${BASE_URL}${alternate.path}`,
        },
      },
    });
  }

  return entries;
}
