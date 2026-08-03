import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { COMMUNES } from "@/lib/seo/slugs";
import type { PublicProvider } from "@/lib/marketplace/public-queries";
import type { Category, Vertical } from "@/lib/marketplace/types";
import { cname, communeDisplay, vname } from "@/lib/marketplace/display";
import { categoryFaq, categoryIntro } from "@/lib/marketplace/content";
import { LeadForm } from "./lead-form";
import { ProviderCard } from "./provider-card";
import { StatusBanner } from "./status-banner";
import { SiteHeader } from "./site-header";
import { Footer } from "@/components/footer";

/**
 * Category page, optionally scoped to a commune — the SEO money page:
 * provider cards + fan-out quote form (spec §7).
 */
export function CategoryView({
  vertical,
  category,
  communeSlug,
  providers,
  total,
  locale,
}: {
  vertical: Vertical;
  category: Category;
  communeSlug: string | null;
  providers: PublicProvider[];
  total: number;
  locale: string;
}) {
  const fr = locale !== "en";
  const catName = cname(category, locale);
  const commune = communeSlug ? communeDisplay(communeSlug) : null;
  const basePath = `/${locale}/${vertical.slug}/${category.slug}`;
  const path = communeSlug ? `${basePath}/${communeSlug}` : basePath;
  // Full, filterable/sortable list lives on the vertical browse page.
  const browseHref = `/${locale}/${vertical.slug}?cat=${category.slug}${communeSlug ? `&commune=${communeSlug}` : ""}`;

  const heading = commune
    ? fr
      ? `${catName} à ${commune}`
      : `${catName} in ${commune}`
    : fr
      ? `${catName} au Luxembourg`
      : `${catName} in Luxembourg`;

  const intro = categoryIntro(catName, commune, locale);
  const faq = categoryFaq(catName, commune, locale);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

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
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-10 sm:px-8">
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
          ? `${total} prestataire${total === 1 ? "" : "s"} — devis gratuits, sans engagement.`
          : `${total} provider${total === 1 ? "" : "s"} — free quotes, no obligation.`}
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p>

      <StatusBanner locale={locale} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {providers.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              {fr
                ? "Pas encore de prestataire référencé ici — envoyez votre demande, nous la transmettons dès qu'un prestataire rejoint lëtz24."
                : "No providers listed here yet — send your request and we'll forward it as soon as one joins lëtz24."}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {providers.map((p) => (
                  <ProviderCard key={p.id} provider={p} locale={locale} />
                ))}
              </div>
              {total > providers.length && (
                <Link
                  href={browseHref}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  {fr
                    ? `Voir les ${total} prestataires — filtrer & trier`
                    : `See all ${total} providers — filter & sort`}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </>
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

      <section className="mt-12 max-w-3xl border-t pt-8">
        <h2 className="mb-4 text-lg font-semibold">
          {fr ? "Questions fréquentes" : "Frequently asked questions"}
        </h2>
        <dl className="space-y-4">
          {faq.map((f, i) => (
            <div key={i}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      </main>
      <Footer />
    </div>
  );
}
