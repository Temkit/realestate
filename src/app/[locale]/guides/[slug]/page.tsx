import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { GUIDES, getGuide } from "@/lib/marketplace/guides";
import { SiteHeader } from "@/components/marketplace/site-header";
import { Footer } from "@/components/footer";

export const revalidate = 86400;

export function generateStaticParams() {
  return ["fr", "en"].flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Not found" };
  const fr = locale === "fr";
  return {
    title: `${fr ? guide.title.fr : guide.title.en} | lux24`,
    description: fr ? guide.excerpt.fr : guide.excerpt.en,
    alternates: { canonical: `/${locale}/guides/${slug}` },
    openGraph: {
      title: fr ? guide.title.fr : guide.title.en,
      description: fr ? guide.excerpt.fr : guide.excerpt.en,
      type: "article",
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = getGuide(slug);
  if (!guide) notFound();
  const fr = locale !== "en";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fr ? guide.title.fr : guide.title.en,
    description: fr ? guide.excerpt.fr : guide.excerpt.en,
    inLanguage: fr ? "fr-LU" : "en-US",
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-3.5 py-10 sm:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav className="mb-4 text-sm text-muted-foreground">
          <Link href={`/${locale}/guides`} className="hover:text-foreground">
            {fr ? "Guides" : "Guides"}
          </Link>
          {" / "}
          <span className="text-foreground">{fr ? guide.title.fr : guide.title.en}</span>
        </nav>

        <h1 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {fr ? guide.title.fr : guide.title.en}
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">{fr ? guide.excerpt.fr : guide.excerpt.en}</p>

        <article className="space-y-6">
          {guide.sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-1.5 text-lg font-semibold">{fr ? s.h.fr : s.h.en}</h2>
              <p className="leading-relaxed text-muted-foreground">{fr ? s.p.fr : s.p.en}</p>
            </section>
          ))}
        </article>

        {guide.vertical && (
          <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="mb-3 text-sm">
              {fr
                ? "Prêt à comparer les prestataires près de chez vous ?"
                : "Ready to compare providers near you?"}
            </p>
            <Link
              href={`/${locale}/${guide.vertical}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {fr ? "Voir les prestataires" : "See providers"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
