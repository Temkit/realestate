import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getModesForLocale, getTypesForLocale, COMMUNES } from "@/lib/seo/slugs";

export const revalidate = 86400;

export function generateStaticParams() {
  const params: { locale: string; mode: string }[] = [];
  for (const locale of ["fr", "en"]) {
    for (const m of getModesForLocale(locale)) {
      params.push({ locale, mode: m.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; mode: string }>;
}): Promise<Metadata> {
  const { locale, mode } = await params;
  const modes = getModesForLocale(locale);
  const modeEntry = modes.find((m) => m.slug === mode);
  if (!modeEntry) return { title: "Not found" };

  const title =
    locale === "fr"
      ? `Immobilier ${modeEntry.internal === "buy" ? "à acheter" : "à louer"} au Luxembourg | olu.lu`
      : `Real estate for ${modeEntry.internal === "buy" ? "sale" : "rent"} in Luxembourg | olu.lu`;
  const description =
    locale === "fr"
      ? `Parcourez toutes les annonces d'immobilier ${modeEntry.internal === "buy" ? "à acheter" : "à louer"} au Luxembourg. Appartements, maisons, bureaux et studios dans les 12 communes principales.`
      : `Browse all Luxembourg real estate listings for ${modeEntry.internal === "buy" ? "sale" : "rent"}. Apartments, houses, offices and studios across 12 main communes.`;
  const canonical = `https://olu.lu/${locale}/${mode}`;
  const otherMode = modes.find((m) => m.internal !== modeEntry.internal);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        fr: `https://olu.lu/fr/${otherMode ? (locale === "fr" ? mode : otherMode.slug) : mode}`,
        en: `https://olu.lu/en/${otherMode ? (locale === "en" ? mode : otherMode.slug) : mode}`,
        "x-default": canonical,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "olu.lu",
      locale: locale === "fr" ? "fr_LU" : "en_US",
      images: ["/og-image.png"],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  };
}

export default async function ModeIndexPage({
  params,
}: {
  params: Promise<{ locale: string; mode: string }>;
}) {
  const { locale, mode } = await params;
  const modes = getModesForLocale(locale);
  const modeEntry = modes.find((m) => m.slug === mode);
  if (!modeEntry) notFound();

  const types = getTypesForLocale(locale);
  const heading =
    locale === "fr"
      ? `Immobilier ${modeEntry.internal === "buy" ? "\u00e0 acheter" : "\u00e0 louer"} au Luxembourg`
      : `Real estate for ${modeEntry.internal === "buy" ? "sale" : "rent"} in Luxembourg`;

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-8 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">
        {heading}
      </h1>

      {types.map((type) => (
        <section key={type.slug} className="mb-8">
          <h2 className="text-lg font-semibold mb-3">{type.display}</h2>
          <div className="flex flex-wrap gap-2">
            {COMMUNES.map((c) => (
              <Link
                key={c.slug}
                href={`/${locale}/${mode}/${type.slug}/${c.slug}`}
                className="text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {c.display}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
