import type { MetadataRoute } from "next";
import { allCombinations, getAlternateUrl, COMMUNES } from "@/lib/seo/slugs";
import { getMarketplaceDb } from "@/lib/marketplace/db";
import {
  listActiveCategories,
  listActiveVerticals,
} from "@/lib/marketplace/public-queries";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lux24.lu";

const staticPages = [
  "",
  "/about",
  "/privacy",
  "/terms",
  "/mentions-legales",
  "/cookies",
];

const locales = ["fr", "en"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Marketplace pages (spec §7) — vertical hubs, categories, category×commune,
  // provider profiles. Skipped when the DB is unreachable (e.g. at build time).
  try {
    if (getMarketplaceDb()) {
      const verticals = await listActiveVerticals();
      for (const v of verticals) {
        const categories = await listActiveCategories(v.id);
        for (const locale of locales) {
          entries.push({
            url: `${BASE_URL}/${locale}/${v.slug}`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.7,
          });
          for (const c of categories) {
            entries.push({
              url: `${BASE_URL}/${locale}/${v.slug}/${c.slug}`,
              lastModified: new Date(),
              changeFrequency: "daily",
              priority: 0.7,
            });
            for (const commune of COMMUNES) {
              entries.push({
                url: `${BASE_URL}/${locale}/${v.slug}/${c.slug}/${commune.slug}`,
                lastModified: new Date(),
                changeFrequency: "daily",
                priority: 0.8,
              });
            }
          }
        }
      }

      const db = getMarketplaceDb()!;
      const providers = await db.execute({
        sql: "SELECT slug FROM providers WHERE status = 'active'",
        args: [],
      });
      for (const row of providers.rows) {
        for (const locale of locales) {
          entries.push({
            url: `${BASE_URL}/${locale}/pro/${row.slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    }
  } catch {
    /* sitemap must never fail on marketplace DB issues */
  }

  return entries;
}
