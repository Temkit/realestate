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
