import Link from "next/link";
import { COMMUNES } from "@/lib/seo/slugs";
import type { PublicProvider } from "@/lib/marketplace/public-queries";
import type { Category, Vertical } from "@/lib/marketplace/types";
import { cname, communeDisplay, vname } from "@/lib/marketplace/display";
import { SiteHeader } from "./site-header";
import { ProviderCard } from "./provider-card";
import { Footer } from "@/components/footer";

/**
 * Vertical browse page — all providers on ONE page with in-place category +
 * commune filters (no drill-down). Keeps SEO commune links at the bottom.
 */
export function VerticalHub({
  vertical,
  categories,
  locale,
  providers,
  total,
  counts = {},
  activeCategory,
  activeCommune,
}: {
  vertical: Vertical;
  categories: Category[];
  locale: string;
  providers: PublicProvider[];
  total: number;
  counts?: Record<number, number>;
  activeCategory?: string;
  activeCommune?: string;
}) {
  const fr = locale !== "en";
  const name = vname(vertical, locale);
  const base = `/${locale}/${vertical.slug}`;

  const hrefFor = (cat?: string, commune?: string) => {
    const p = new URLSearchParams();
    if (cat) p.set("cat", cat);
    if (commune) p.set("commune", commune);
    const q = p.toString();
    return q ? `${base}?${q}` : base;
  };

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
            href={hrefFor(undefined, activeCommune)}
            className={`rounded-full border px-3 py-1.5 text-sm ${!activeCategory ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
          >
            {fr ? "Tous" : "All"}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={hrefFor(c.slug, activeCommune)}
              className={`rounded-full border px-3 py-1.5 text-sm ${activeCategory === c.slug ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
            >
              {cname(c, locale)}
              {counts[c.id] > 0 && <span className="ml-1 text-xs opacity-60">{counts[c.id]}</span>}
            </Link>
          ))}
        </div>

        {/* Commune filter */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          <Link
            href={hrefFor(activeCategory, undefined)}
            className={`rounded-full px-2.5 py-1 text-xs ${!activeCommune ? "bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-muted"}`}
          >
            {fr ? "Toutes communes" : "All communes"}
          </Link>
          {COMMUNES.map((c) => (
            <Link
              key={c.slug}
              href={hrefFor(activeCategory, c.slug)}
              className={`rounded-full px-2.5 py-1 text-xs ${activeCommune === c.slug ? "bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-muted"}`}
            >
              {c.display}
            </Link>
          ))}
        </div>

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
        {total > providers.length && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {fr
              ? `${providers.length} affichés sur ${total} — affinez avec un filtre.`
              : `Showing ${providers.length} of ${total} — narrow with a filter.`}
          </p>
        )}

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
