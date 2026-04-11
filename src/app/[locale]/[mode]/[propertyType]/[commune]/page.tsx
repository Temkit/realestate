import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { resolveParams, allCombinations } from "@/lib/seo/slugs";
import { generatePageMetadata } from "@/lib/seo/metadata";
import { sanitizeForClient, saveRedirects } from "@/lib/seo/sanitize";
import { buildListingJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildSearchCacheKey, getSearchCache, setSearchCache } from "@/lib/search-cache";
import { runPipeline } from "@/lib/search";
import { formatNumber } from "@/lib/format";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { InternalLinks } from "@/components/seo/internal-links";
import { Home, Bed, Bath, Ruler, ExternalLink, ShieldCheck, ArrowRight } from "lucide-react";

// ISR: revalidate every 24h (matches Redis cache TTL)
export const revalidate = 86400;

// Allow non-predefined slugs — validated in resolveParams
export const dynamicParams = true;

// Don't pre-generate all 192 pages at build time — too many API calls.
// Pages are generated on first visit (ISR) and cached for 24h.
// The QStash cron warms Redis cache so ISR pages render instantly.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; mode: string; propertyType: string; commune: string }>;
}): Promise<Metadata> {
  const { locale, mode, propertyType, commune } = await params;
  const resolved = resolveParams(locale, mode, propertyType, commune);
  if (!resolved) return { title: "Not found" };

  // Try to get property count from cache for description
  const cacheKey = buildSearchCacheKey(resolved.query, resolved.mode);
  const cached = await getSearchCache(cacheKey);
  const count = cached?.properties?.length || 0;

  return generatePageMetadata(resolved, count, mode, propertyType, commune);
}

export default async function CommuneSearchPage({
  params,
}: {
  params: Promise<{ locale: string; mode: string; propertyType: string; commune: string }>;
}) {
  const { locale, mode, propertyType, commune } = await params;
  const resolved = resolveParams(locale, mode, propertyType, commune);
  if (!resolved) notFound();

  // Read from Redis cache — at build time, only use cached data (no pipeline)
  // ISR will regenerate with fresh data on next visit after revalidate period
  const cacheKey = buildSearchCacheKey(resolved.query, resolved.mode);
  let searchResult = await getSearchCache(cacheKey);

  if (!searchResult) {
    // During ISR revalidation (not build), try running the pipeline
    // At build time this just returns empty — the page will fill on first visit
    try {
      searchResult = await runPipeline(resolved.query, resolved.mode);
      await setSearchCache(cacheKey, searchResult);
    } catch {
      searchResult = { properties: [], summary: "", citations: [] };
    }
  }

  const properties = searchResult.properties;

  // Save URL redirects (fire-and-forget)
  saveRedirects(properties).catch(() => {});

  const safeProperties = sanitizeForClient(properties);
  const analytics = searchResult.marketAnalytics;

  // Heading text
  const heading =
    locale === "fr"
      ? `${resolved.typeDisplay}s ${resolved.mode === "buy" ? "\u00e0 acheter" : "\u00e0 louer"} \u00e0 ${resolved.commune}`
      : `${resolved.typeDisplay}s for ${resolved.mode === "buy" ? "sale" : "rent"} in ${resolved.commune}`;

  const subheading =
    properties.length > 0
      ? locale === "fr"
        ? `${properties.length} r\u00e9sultat${properties.length > 1 ? "s" : ""} trouv\u00e9${properties.length > 1 ? "s" : ""}`
        : `${properties.length} result${properties.length > 1 ? "s" : ""} found`
      : locale === "fr"
        ? "Aucun r\u00e9sultat pour le moment"
        : "No results at the moment";

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildListingJsonLd(resolved, safeProperties)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd(resolved, mode, propertyType)
          ),
        }}
      />

      <div className="max-w-7xl mx-auto px-3.5 sm:px-8 py-6 sm:py-10">
        {/* Breadcrumbs */}
        <Breadcrumbs
          resolved={resolved}
          modeSlug={mode}
          typeSlug={propertyType}
          communeSlug={commune}
        />

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-2">
          {heading}
        </h1>
        <p className="text-muted-foreground mb-6">{subheading}</p>

        {/* CTA to search */}
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-6"
        >
          {locale === "fr" ? "Recherche personnalis\u00e9e" : "Custom search"}
          <ArrowRight className="h-4 w-4" />
        </Link>

        {/* Market stats summary */}
        {analytics?.priceRange && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatBox
              label={locale === "fr" ? "Prix min" : "Min price"}
              value={`\u20ac${formatNumber(analytics.priceRange.min)}${resolved.mode === "rent" ? "/mo" : ""}`}
            />
            <StatBox
              label={locale === "fr" ? "Prix max" : "Max price"}
              value={`\u20ac${formatNumber(analytics.priceRange.max)}${resolved.mode === "rent" ? "/mo" : ""}`}
            />
            <StatBox
              label={locale === "fr" ? "Prix moyen" : "Avg price"}
              value={`\u20ac${formatNumber(analytics.priceRange.avg)}${resolved.mode === "rent" ? "/mo" : ""}`}
            />
            {analytics.pricePerSqm && (
              <StatBox
                label={locale === "fr" ? "Moy. \u20ac/m\u00b2" : "Avg \u20ac/m\u00b2"}
                value={`\u20ac${formatNumber(analytics.pricePerSqm.avg)}`}
              />
            )}
          </div>
        )}

        {/* AI Summary */}
        {searchResult.summary && (
          <p className="text-[0.9375rem] text-muted-foreground leading-relaxed mb-8">
            {searchResult.summary}
          </p>
        )}

        {/* Property grid */}
        {safeProperties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {safeProperties.map((p) => (
              <PropertyCardStatic key={p.id} property={p} mode={resolved.mode} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Home className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              {locale === "fr" ? "Aucune annonce trouv\u00e9e" : "No listings found"}
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              {locale === "fr"
                ? "Essayez une recherche personnalis\u00e9e pour plus de r\u00e9sultats"
                : "Try a custom search for more results"}
            </p>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {locale === "fr" ? "Rechercher" : "Search"}
            </Link>
          </div>
        )}

        {/* Internal links */}
        <InternalLinks
          resolved={resolved}
          modeSlug={mode}
          typeSlug={propertyType}
          communeSlug={commune}
        />
      </div>
    </>
  );
}

// ── Static sub-components (Server Components, no "use client") ──────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3.5 text-center">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function PropertyCardStatic({
  property: p,
  mode,
}: {
  property: ReturnType<typeof sanitizeForClient>[number];
  mode: "buy" | "rent";
}) {
  const priceLabel =
    p.price > 0
      ? `\u20ac${formatNumber(p.price)}${mode === "rent" ? "/mo" : ""}`
      : "Prix sur demande";

  return (
    <article className="rounded-xl sm:rounded-2xl border bg-card overflow-hidden">
      {/* Image */}
      <div className="relative bg-muted h-[180px] sm:h-[200px] flex items-center justify-center">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.address}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Home className="h-10 w-10 text-muted-foreground/25" strokeWidth={1} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <span className="bg-white/95 dark:bg-card/95 text-foreground px-3 py-1.5 rounded-lg text-lg font-bold tabular-nums">
            {priceLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-5 space-y-2">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.priceVerified && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </span>
          )}
          {p.fairPrice && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                p.fairPrice.rating === "good"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : p.fairPrice.rating === "fair"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {p.fairPrice.label}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-[0.9375rem] truncate">{p.address}</h3>
        <p className="text-muted-foreground text-sm truncate">{p.city}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {p.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bed className="h-4 w-4" /> {p.bedrooms}
            </span>
          )}
          {p.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4" /> {p.bathrooms}
            </span>
          )}
          {p.sqft > 0 && (
            <span className="flex items-center gap-1">
              <Ruler className="h-4 w-4" /> {formatNumber(p.sqft)} m²
            </span>
          )}
          {p.pricePerSqm && (
            <span className="text-xs tabular-nums">
              €{formatNumber(p.pricePerSqm)}/m²
            </span>
          )}
        </div>

        {/* True cost hint */}
        {p.trueCost?.totalCost && p.trueCost.totalCost > p.price && (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Total: €{formatNumber(p.trueCost.totalCost)}
          </p>
        )}

        {/* Link */}
        {p.listingUrl && (
          <a
            href={p.listingUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-xs text-primary/70 hover:text-primary inline-flex items-center gap-1 mt-1"
          >
            {p.source || "View listing"}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}
