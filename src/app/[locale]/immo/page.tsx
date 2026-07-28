import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ImmoHome } from "@/components/immo/immo-home";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === "fr";
  const title = fr
    ? "Immobilier au Luxembourg — recherche IA | lux24"
    : "Luxembourg Real Estate — AI search | lux24";
  const description = fr
    ? "Recherche immobilière intelligente au Luxembourg : appartements, maisons, bureaux à louer ou à acheter, tous les portails en une recherche."
    : "Smart real-estate search in Luxembourg: apartments, houses and offices to rent or buy, all portals in one search.";
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/immo` },
  };
}

export default async function ImmoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ImmoHome />;
}
