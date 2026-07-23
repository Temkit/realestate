"use client";

import Link from "next/link";
import { Car, Hammer, Scissors, Sparkles, Sparkle, Truck } from "lucide-react";

/**
 * Homepage vertical switcher — links into the services marketplace.
 * The six launch verticals are stable (spec §2); slugs hardcoded to keep
 * the client homepage free of DB round-trips.
 */
const VERTICALS = [
  { slug: "garages", fr: "Garages", en: "Garages", Icon: Car },
  { slug: "artisans", fr: "Artisans", en: "Trades", Icon: Hammer },
  { slug: "cleaning", fr: "Nettoyage", en: "Cleaning", Icon: Sparkles },
  { slug: "demenagement", fr: "Déménagement", en: "Moving", Icon: Truck },
  { slug: "coiffeur", fr: "Coiffeurs", en: "Hair", Icon: Scissors },
  { slug: "beaute", fr: "Beauté", en: "Beauty", Icon: Sparkle },
] as const;

export function ServicesStrip({ locale }: { locale: string }) {
  const fr = locale !== "en";
  return (
    <div className="mt-6">
      <p className="mb-2 text-center text-xs text-muted-foreground">
        {fr ? "Aussi sur lux24 — devis & rendez-vous :" : "Also on lux24 — quotes & appointments:"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {VERTICALS.map(({ slug, fr: nameFr, en: nameEn, Icon }) => (
          <Link
            key={slug}
            href={`/${locale}/${slug}`}
            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            <Icon className="h-3.5 w-3.5" />
            {fr ? nameFr : nameEn}
          </Link>
        ))}
      </div>
    </div>
  );
}
