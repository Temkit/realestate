import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { COMMUNES } from "@/lib/seo/slugs";
import type { PublicProvider, ProviderSort } from "@/lib/marketplace/public-queries";
import type { Category, Vertical } from "@/lib/marketplace/types";
import { cname, communeDisplay, vname } from "@/lib/marketplace/display";
import { hrefWith } from "@/lib/marketplace/url";
import { SiteHeader } from "./site-header";
import { ProviderCard } from "./provider-card";
import { SortBar } from "./sort-bar";
import { Pagination } from "./pagination";
import { Footer } from "@/components/footer";

/**
 * Vertical browse page — every provider on one page with in-place category +
 * commune + verified filters, sorting, and pagination. SEO category×commune
 * deep links stay at the bottom.
 */
export function VerticalHub({
  vertical,
  categories,
  locale,
  providers,
  total,
  page,
  pageCount,
  counts = {},
  activeSort,
  activeCategory,
  activeCommune,
  verifiedOnly,
}: {
  vertical: Vertical;
  categories: Category[];
  locale: string;
  providers: PublicProvider[];
  total: number;
  page: number;
  pageCount: number;
  counts?: Record<number, number>;
  activeSort: ProviderSort;
  activeCategory?: string;
  activeCommune?: string;
  verifiedOnly?: boolean;
}) {
  const fr = locale !== "en";
  const name = vname(vertical, locale);
  const base = `/${locale}/${vertical.slug}`;

  // Current query state, so every control preserves the others.
  const current: Record<string, string | undefined> = {
    cat: activeCategory,
    commune: activeCommune,
    sort: activeSort === "recommended" ? undefined : activeSort,
    verified: verifiedOnly ? "1" : undefined,
  };
  const link = (patch: Record<string, string | number | undefined>) =>
    hrefWith(base, current, { page: undefined, ...patch });

  const activeCat = categories.find((c) => c.slug === activeCategory);
  const communeLabel = activeCommune ? communeDisplay(activeCommune) : null;
  const seoCatSlug = activeCat?.slug ?? categories[0]?.slug;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-8 sm:px-8">
        <nav className="mb-3 text-sm text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">
            {fr ? "Accueil" : "Home"}
          </Link>
          {" / "}
          <span className="font-medium text-foreground">{name}</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {activeCat ? cname(activeCat, locale) : name}
          {communeLabel && <span className="text-muted-foreground"> · {communeLabel}</span>}
          <span className="text-muted-foreground"> {fr ? "au Luxembourg" : "in Luxembourg"}</span>
        </h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          {total} {fr ? "prestataires" : "providers"} · {fr ? "devis gratuits, rendez-vous en ligne" : "free quotes, online booking"}
        </p>

        {/* Category filter */}
        <div className="mb-3 flex flex-wrap gap-2">
          <Link
            href={link({ cat: undefined })}
            className={`rounded-full border px-3 py-1.5 text-sm ${!activeCategory ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
          >
            {fr ? "Tous" : "All"}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={link({ cat: c.slug })}
              className={`rounded-full border px-3 py-1.5 text-sm ${activeCategory === c.slug ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
            >
              {cname(c, locale)}
              {counts[c.id] > 0 && <span className="ml-1 text-xs opacity-60">{counts[c.id]}</span>}
            </Link>
          ))}
        </div>

        {/* Commune + verified filters */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <Link
            href={link({ verified: verifiedOnly ? undefined : "1" })}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${verifiedOnly ? "bg-green-500/10 font-medium text-green-600" : "text-muted-foreground hover:bg-muted"}`}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            {fr ? "Vérifiés" : "Verified"}
          </Link>
          <span className="mx-1 h-4 w-px bg-border" />
          <Link
            href={link({ commune: undefined })}
            className={`rounded-full px-2.5 py-1 text-xs ${!activeCommune ? "bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-muted"}`}
          >
            {fr ? "Toutes communes" : "All communes"}
          </Link>
          {COMMUNES.map((c) => (
            <Link
              key={c.slug}
              href={link({ commune: c.slug })}
              className={`rounded-full px-2.5 py-1 text-xs ${activeCommune === c.slug ? "bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-muted"}`}
            >
              {c.display}
            </Link>
          ))}
        </div>

        <SortBar
          locale={locale}
          activeSort={activeSort}
          hrefForSort={(s) => link({ sort: s === "recommended" ? undefined : s })}
        />

        {/* Results */}
        {providers.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {fr
              ? "Aucun prestataire pour ce filtre. Élargissez la recherche ou envoyez une demande."
              : "No providers for this filter. Widen the search or send a request."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} locale={locale} />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          pageCount={pageCount}
          hrefForPage={(pg) => hrefWith(base, current, { page: pg === 1 ? undefined : pg })}
          locale={locale}
        />

        {/* SEO: category × commune deep links */}
        {seoCatSlug && (
          <section className="mt-10 border-t pt-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              {fr ? "Par commune" : "By commune"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {COMMUNES.map((c) => (
                <Link
                  key={c.slug}
                  href={`${base}/${seoCatSlug}/${c.slug}`}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  {activeCat ? cname(activeCat, locale) : name} {c.display}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
