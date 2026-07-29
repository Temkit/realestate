import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Clock, Globe, MapPin, Navigation, Phone } from "lucide-react";
import type { PublicProvider } from "@/lib/marketplace/public-queries";
import {
  communeDisplay,
  directionsUrl,
  offerTitle,
  priceLabel,
  shortHours,
} from "@/lib/marketplace/display";
import { isOpenNow } from "@/lib/marketplace/hours";
import { StarRating } from "./star-rating";

/** Compact, information-dense provider card used on every results page. */
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
  const open = isOpenNow(provider.opening_hours);
  const href = `/${locale}/pro/${provider.slug}`;

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {provider.logo_url && (
            <Image
              src={provider.logo_url}
              alt=""
              width={40}
              height={40}
              className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border object-cover"
            />
          )}
          <Link href={href} className="font-semibold leading-tight hover:text-primary">
            {provider.name}
          </Link>
        </div>
        {claimed ? (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-600"
            title={fr ? "Prestataire vérifié" : "Verified"}
          >
            <BadgeCheck className="h-3 w-3" />
            {fr ? "Vérifié" : "Verified"}
          </span>
        ) : provider.plan === "pro" ? (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
            <BadgeCheck className="h-3 w-3" />
            {fr ? "Sponsorisé" : "Sponsored"}
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
        {provider.rating.avg != null && (
          <StarRating value={provider.rating.avg} count={provider.rating.count} size={13} />
        )}
        {provider.commune && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {communeDisplay(provider.commune)}
          </span>
        )}
        {open != null && (
          <span className={`font-medium ${open ? "text-green-600" : "text-red-500"}`}>
            {open ? (fr ? "Ouvert" : "Open") : fr ? "Fermé" : "Closed"}
          </span>
        )}
        {hours && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {hours}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{description}</p>
      )}

      {provider.offers.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {provider.offers.slice(0, 2).map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">{offerTitle(o, locale)}</span>
              <span className="shrink-0 font-medium">{priceLabel(o, locale)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        {provider.phone && (
          <a
            href={`tel:${provider.phone}`}
            title={fr ? "Appeler" : "Call"}
            className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs hover:bg-muted"
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{fr ? "Appeler" : "Call"}</span>
          </a>
        )}
        {provider.website && (
          <a
            href={provider.website}
            rel="nofollow noopener"
            target="_blank"
            title={fr ? "Site web" : "Website"}
            className="flex items-center rounded-lg border px-2 py-1.5 text-xs hover:bg-muted"
          >
            <Globe className="h-3.5 w-3.5" />
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
            title={fr ? "Itinéraire" : "Directions"}
            className="flex items-center rounded-lg border px-2 py-1.5 text-xs hover:bg-muted"
          >
            <Navigation className="h-3.5 w-3.5" />
          </a>
        )}
        <Link
          href={href}
          className="ml-auto flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          {fr ? "Voir" : "View"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
