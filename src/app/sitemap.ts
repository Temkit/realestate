import type { MetadataRoute } from "next";

const BASE_URL = "https://olu.lu";

const pages = [
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

  for (const page of pages) {
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

  return entries;
}
