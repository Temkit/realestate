import Link from "next/link";
import { COMMUNES } from "@/lib/seo/slugs";
import type { PublicProvider } from "@/lib/marketplace/public-queries";
import type { Category, Vertical } from "@/lib/marketplace/types";
import { cname, communeDisplay, vname } from "@/lib/marketplace/display";
import { LeadForm } from "./lead-form";
import { ProviderCard } from "./provider-card";
import { StatusBanner } from "./status-banner";

/**
 * Category page, optionally scoped to a commune — the SEO money page:
 * provider cards + fan-out quote form (spec §7).
 */
export function CategoryView({
  vertical,
  category,
  communeSlug,
  providers,
  locale,
}: {
  vertical: Vertical;
  category: Category;
  communeSlug: string | null;
  providers: PublicProvider[];
  locale: string;
}) {
  const fr = locale !== "en";
  const catName = cname(category, locale);
  const commune = communeSlug ? communeDisplay(communeSlug) : null;
  const basePath = `/${locale}/${vertical.slug}/${category.slug}`;
  const path = communeSlug ? `${basePath}/${communeSlug}` : basePath;

  const heading = commune
    ? fr
      ? `${catName} à ${commune}`
      : `${catName} in ${commune}`
    : fr
      ? `${catName} au Luxembourg`
      : `${catName} in Luxembourg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: heading,
    areaServed: commune ?? "Luxembourg",
    provider: providers.slice(0, 10).map((p) => ({
      "@type": "LocalBusiness",
      name: p.name,
      address: p.commune
        ? { "@type": "PostalAddress", addressLocality: communeDisplay(p.commune), addressCountry: "LU" }
        : undefined,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-3.5 py-10 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-foreground">
          {fr ? "Accueil" : "Home"}
        </Link>
        {" / "}
        <Link href={`/${locale}/${vertical.slug}`} className="hover:text-foreground">
          {vname(vertical, locale)}
        </Link>
        {" / "}
        {commune ? (
          <>
            <Link href={basePath} className="hover:text-foreground">
              {catName}
            </Link>
            {" / "}
            <span className="font-medium text-foreground">{commune}</span>
          </>
        ) : (
          <span className="font-medium text-foreground">{catName}</span>
        )}
      </nav>

      <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
      <p className="mb-6 text-muted-foreground">
        {fr
          ? `${providers.length} prestataire${providers.length === 1 ? "" : "s"} — devis gratuits, sans engagement.`
          : `${providers.length} provider${providers.length === 1 ? "" : "s"} — free quotes, no obligation.`}
      </p>

      <StatusBanner locale={locale} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {providers.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              {fr
                ? "Pas encore de prestataire référencé ici — envoyez votre demande, nous la transmettons dès qu'un prestataire rejoint lux24."
                : "No providers listed here yet — send your request and we'll forward it as soon as one joins lux24."}
            </div>
          ) : (
            providers.map((p) => <ProviderCard key={p.id} provider={p} locale={locale} />)
          )}

          {communeSlug && (
            <div className="pt-2">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                {fr ? "Autres communes" : "Other communes"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {COMMUNES.filter((c) => c.slug !== communeSlug)
                  .slice(0, 8)
                  .map((c) => (
                    <Link
                      key={c.slug}
                      href={`${basePath}/${c.slug}`}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {c.display}
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="sticky top-6 rounded-2xl border bg-card p-5">
            <h2 className="mb-1 text-base font-semibold">
              {fr ? "Recevez jusqu'à 3 devis" : "Get up to 3 quotes"}
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {fr ? "Gratuit et sans engagement." : "Free, no obligation."}
            </p>
            <LeadForm
              locale={locale}
              categoryId={category.id}
              backTo={path}
              defaultCommune={communeSlug ?? undefined}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
