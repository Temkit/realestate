import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getModesForLocale,
  getTypesForLocale,
  COMMUNES,
} from "@/lib/seo/slugs";

export const revalidate = 86400;

export function generateStaticParams() {
  const params: { locale: string; mode: string; propertyType: string }[] = [];
  for (const locale of ["fr", "en"]) {
    for (const m of getModesForLocale(locale)) {
      for (const t of getTypesForLocale(locale)) {
        params.push({ locale, mode: m.slug, propertyType: t.slug });
      }
    }
  }
  return params;
}

export default async function TypeIndexPage({
  params,
}: {
  params: Promise<{ locale: string; mode: string; propertyType: string }>;
}) {
  const { locale, mode, propertyType } = await params;
  const modes = getModesForLocale(locale);
  const types = getTypesForLocale(locale);
  const modeEntry = modes.find((m) => m.slug === mode);
  const typeEntry = types.find((t) => t.slug === propertyType);
  if (!modeEntry || !typeEntry) notFound();

  const heading =
    locale === "fr"
      ? `${typeEntry.display}s ${modeEntry.internal === "buy" ? "\u00e0 acheter" : "\u00e0 louer"} au Luxembourg`
      : `${typeEntry.display}s for ${modeEntry.internal === "buy" ? "sale" : "rent"} in Luxembourg`;

  const chooseCommuneText =
    locale === "fr" ? "Choisissez une commune" : "Choose a commune";

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-8 py-10">
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href={`/${locale}`} className="hover:text-foreground">
          {locale === "fr" ? "Accueil" : "Home"}
        </Link>
        {" / "}
        <Link href={`/${locale}/${mode}`} className="hover:text-foreground">
          {modeEntry.display}
        </Link>
        {" / "}
        <span className="text-foreground font-medium">{typeEntry.display}</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
        {heading}
      </h1>
      <p className="text-muted-foreground mb-8">{chooseCommuneText}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {COMMUNES.map((c) => (
          <Link
            key={c.slug}
            href={`/${locale}/${mode}/${propertyType}/${c.slug}`}
            className="rounded-xl border bg-card p-4 hover:bg-muted/50 hover:border-primary/30 transition-colors group"
          >
            <p className="font-medium group-hover:text-primary transition-colors">
              {c.display}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {typeEntry.display}s {locale === "fr" ? "\u00e0" : "in"}{" "}
              {c.display}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
