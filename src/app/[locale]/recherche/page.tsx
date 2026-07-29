import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { queryProviders } from "@/lib/marketplace/public-queries";
import { hrefWith } from "@/lib/marketplace/url";
import { SiteHeader } from "@/components/marketplace/site-header";
import { ServiceSearch } from "@/components/marketplace/service-search";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { Pagination } from "@/components/marketplace/pagination";
import { Footer } from "@/components/footer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === "fr";
  return {
    title: fr ? "Recherche — lux24" : "Search — lux24",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page: pageParam } = await searchParams;
  const fr = locale !== "en";
  const term = (q ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const { providers, total, pageCount } = term
    ? await queryProviders({ q: term, page, pageSize: 24 })
    : { providers: [], total: 0, pageCount: 0 };

  const base = `/${locale}/recherche`;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3.5 py-8 sm:px-8">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">
          {term
            ? fr
              ? `Résultats pour « ${term} »`
              : `Results for "${term}"`
            : fr
              ? "Rechercher un service"
              : "Search for a service"}
        </h1>

        <div className="mb-6 max-w-xl">
          <ServiceSearch />
        </div>

        {term && (
          <p className="mb-4 text-sm text-muted-foreground">
            {total} {fr ? "résultat" : "result"}
            {total === 1 ? "" : "s"}
          </p>
        )}

        {term && providers.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {fr
              ? "Aucun prestataire trouvé. Essayez un autre terme ou parcourez les catégories."
              : "No providers found. Try another term or browse the categories."}
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
          hrefForPage={(pg) => hrefWith(base, { q: term }, { page: pg === 1 ? undefined : pg })}
          locale={locale}
        />

        {!term && (
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Tapez ce que vous cherchez ci-dessus, ou "
              : "Type what you're looking for above, or "}
            <Link href={`/${locale}`} className="text-primary hover:underline">
              {fr ? "parcourez les services" : "browse services"}
            </Link>
            .
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
