import Link from "next/link";
import { BadgeCheck, Clock, Globe, MapPin, Navigation, Phone } from "lucide-react";
import type { PublicProvider } from "@/lib/marketplace/public-queries";
import {
  communeDisplay,
  directionsUrl,
  offerTitle,
  priceLabel,
  shortHours,
} from "@/lib/marketplace/display";
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
  const claimed = provider.status === "active";
  const hours = shortHours(provider.opening_hours);

  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {provider.commune && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {communeDisplay(provider.commune)}
              </span>
            )}
            {hours && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {hours}
              </span>
            )}
          </div>
        </div>
        {claimed ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600"
            title={fr ? "Prestataire vérifié" : "Verified provider"}
          >
            <BadgeCheck className="h-3 w-3" />
            {fr ? "Vérifié" : "Verified"}
          </span>
        ) : provider.plan === "pro" ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <BadgeCheck className="h-3 w-3" />
            {fr ? "Sponsorisé" : "Sponsored"}
          </span>
        ) : null}
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

      {/* Quick actions — always available for directory listings */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {provider.phone && (
          <a
            href={`tel:${provider.phone}`}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 hover:bg-muted"
          >
            <Phone className="h-3.5 w-3.5" /> {fr ? "Appeler" : "Call"}
          </a>
        )}
        {provider.website && (
          <a
            href={provider.website}
            rel="nofollow noopener"
            target="_blank"
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 hover:bg-muted"
          >
            <Globe className="h-3.5 w-3.5" /> {fr ? "Site" : "Site"}
          </a>
        )}
        {(provider.commune || provider.lat != null) && (
          <a
            href={directionsUrl({
              lat: provider.lat,
              lon: provider.lon,
              name: provider.name,
              address: provider.address,
              commune: provider.commune,
            })}
            rel="nofollow noopener"
            target="_blank"
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 hover:bg-muted"
          >
            <Navigation className="h-3.5 w-3.5" /> {fr ? "Itinéraire" : "Directions"}
          </a>
        )}
      </div>

      <Link
        href={`/${locale}/pro/${provider.slug}`}
        className="mt-auto inline-block rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {claimed
          ? fr
            ? "Contacter / Rendez-vous"
            : "Contact / Book"
          : fr
            ? "Voir la fiche"
            : "View listing"}
      </Link>
    </div>
  );
}
