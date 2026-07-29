import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { GUIDES } from "@/lib/marketplace/guides";
import { SiteHeader } from "@/components/marketplace/site-header";
import { Footer } from "@/components/footer";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === "fr";
  const title = fr ? "Guides & conseils | lux24" : "Guides & tips | lux24";
  return {
    title,
    description: fr
      ? "Conseils pratiques pour choisir un prestataire, comprendre les prix et réserver au Luxembourg."
      : "Practical tips to choose a provider, understand prices and book in Luxembourg.",
    alternates: { canonical: `/${locale}/guides` },
  };
}

export default async function GuidesIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const fr = locale !== "en";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-3.5 py-10 sm:px-8">
        <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {fr ? "Guides & conseils" : "Guides & tips"}
        </h1>
        <p className="mb-8 text-muted-foreground">
          {fr
            ? "Pour bien choisir, comprendre les prix et réserver sereinement."
            : "To choose well, understand prices and book with confidence."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/${locale}/guides/${g.slug}`}
              className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30"
            >
              <h2 className="font-semibold">{fr ? g.title.fr : g.title.en}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{fr ? g.excerpt.fr : g.excerpt.en}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
