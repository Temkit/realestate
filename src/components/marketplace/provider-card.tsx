import Link from "next/link";
import { BadgeCheck, Globe, MapPin, Phone } from "lucide-react";
import type { PublicProvider } from "@/lib/marketplace/public-queries";
import { communeDisplay, offerTitle, priceLabel } from "@/lib/marketplace/display";
import { StarRating } from "./star-rating";

export function ProviderCard({
  provider,
  locale,
}: {
  provider: PublicProvider;
  locale: string;
}) {
  const fr = locale !== "en";
  const description = fr ? provider.description_fr : provider.description_en;

  return (
    <div className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/pro/${provider.slug}`}
            className="text-base font-semibold hover:text-primary"
          >
            {provider.name}
          </Link>
          {provider.rating.avg != null && (
            <div className="mt-0.5">
              <StarRating value={provider.rating.avg} count={provider.rating.count} size={14} />
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            {provider.commune && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {communeDisplay(provider.commune)}
              </span>
            )}
            {provider.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {provider.phone}
              </span>
            )}
            {provider.website && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {fr ? "site web" : "website"}
              </span>
            )}
          </div>
        </div>
        {provider.plan === "pro" && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            title={fr ? "Emplacement sponsorisé" : "Sponsored placement"}
          >
            <BadgeCheck className="h-3 w-3" />
            {fr ? "Sponsorisé" : "Sponsored"}
          </span>
        )}
      </div>

      {description && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{description}</p>
      )}

      {provider.offers.length > 0 && (
        <ul className="mb-3 space-y-1">
          {provider.offers.slice(0, 3).map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{offerTitle(o, locale)}</span>
              <span className="shrink-0 font-medium">{priceLabel(o, locale)}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/${locale}/pro/${provider.slug}`}
        className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {fr ? "Contacter / Rendez-vous" : "Contact / Book"}
      </Link>
    </div>
  );
}
