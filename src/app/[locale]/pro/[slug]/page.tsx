import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Globe, MapPin, Phone } from "lucide-react";
import {
  getActiveProviderBySlug,
  isProviderBookable,
  queryProviders,
} from "@/lib/marketplace/public-queries";
import { listCategories, listVerticals } from "@/lib/marketplace/queries";
import { getMarketplaceDb } from "@/lib/marketplace/db";
import { cname, communeDisplay, offerTitle, priceLabel } from "@/lib/marketplace/display";
import { computeAvailableSlots } from "@/lib/marketplace/slots";
import { weeklyHours, isOpenNow } from "@/lib/marketplace/hours";
import { getRatingSummary, listApprovedReviews } from "@/lib/marketplace/reviews";
import { StarRating } from "@/components/marketplace/star-rating";
import { SiteHeader } from "@/components/marketplace/site-header";
import { Footer } from "@/components/footer";
import { HoursTable } from "@/components/marketplace/hours-table";
import { MapEmbed } from "@/components/marketplace/map-embed";
import { PhotoGallery } from "@/components/marketplace/photo-gallery";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { BookingForm } from "@/components/marketplace/booking-form";
import { LeadForm } from "@/components/marketplace/lead-form";
import { SlotPickerForm } from "@/components/marketplace/slot-picker-form";
import { ClaimForm } from "@/components/marketplace/claim-form";
import { StatusBanner } from "@/components/marketplace/status-banner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!getMarketplaceDb()) return { title: "Not found" };
  const data = await getActiveProviderBySlug(slug);
  if (!data) return { title: "Not found" };
  const { provider } = data;
  const fr = locale !== "en";
  const title = `${provider.name}${provider.commune ? ` — ${communeDisplay(provider.commune)}` : ""} | lëtz24`;
  const description =
    (fr ? provider.description_fr : provider.description_en) ||
    (fr
      ? `Contactez ${provider.name} au Luxembourg — devis gratuit et prise de rendez-vous via lëtz24.`
      : `Contact ${provider.name} in Luxembourg — free quote and appointment booking via lëtz24.`);
  return {
    title,
    description,
    alternates: { canonical: `https://letz24.lu/${locale}/pro/${slug}` },
  };
}

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  await connection();
  const { locale, slug } = await params;
  if (!getMarketplaceDb()) notFound();

  const data = await getActiveProviderBySlug(slug);
  if (!data) notFound();
  const { provider, offers, categoryIds } = data;
  // Unclaimed directory listings (imported) show contact + a claim CTA, not
  // the quote/booking forms (they have no owner/email to receive requests).
  const isClaimed = provider.status === "active";

  const [allCategories, verticals, bookable] = await Promise.all([
    listCategories(),
    listVerticals(),
    isClaimed ? isProviderBookable(provider.id) : Promise.resolve(false),
  ]);
  const categories = allCategories.filter(
    (c) => categoryIds.includes(c.id) && c.active
  );
  const [rating, reviews, similarRes] = await Promise.all([
    getRatingSummary(provider.id),
    listApprovedReviews(provider.id, 10),
    categoryIds[0]
      ? queryProviders({
          categoryId: categoryIds[0],
          communeSlug: provider.commune ?? undefined,
          pageSize: 5,
        })
      : Promise.resolve({ providers: [] }),
  ]);
  const similar = ("providers" in similarRes ? similarRes.providers : [])
    .filter((p) => p.id !== provider.id)
    .slice(0, 3);
  const fr = locale !== "en";
  const description = fr ? provider.description_fr : provider.description_en;
  const weekly = weeklyHours(provider.opening_hours, locale);
  const openNow = isOpenNow(provider.opening_hours);
  const firstVertical = verticals.find((v) =>
    categories.some((c) => c.vertical_id === v.id)
  );
  const path = `/${locale}/pro/${slug}`;

  // Level-2 slot picker only in auto mode with availability rules configured
  let slotDays: Awaited<ReturnType<typeof computeAvailableSlots>>["days"] = [];
  let autoMode = false;
  if (bookable) {
    const { config, days } = await computeAvailableSlots(provider.id, 14);
    autoMode = config.mode === "auto" && config.hasRules;
    slotDays = days;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider.name,
    url: `https://letz24.lu${path}`,
    telephone: provider.phone ?? undefined,
    address: provider.commune
      ? {
          "@type": "PostalAddress",
          streetAddress: provider.address ?? undefined,
          addressLocality: communeDisplay(provider.commune),
          addressCountry: "LU",
        }
      : undefined,
    geo:
      provider.lat != null && provider.lon != null
        ? { "@type": "GeoCoordinates", latitude: provider.lat, longitude: provider.lon }
        : undefined,
    image: provider.photos.length ? provider.photos : provider.logo_url ? [provider.logo_url] : undefined,
    openingHours: provider.opening_hours ?? undefined,
    aggregateRating:
      rating.avg != null
        ? {
            "@type": "AggregateRating",
            ratingValue: rating.avg,
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3.5 py-10 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-foreground">
          {fr ? "Accueil" : "Home"}
        </Link>
        {firstVertical && (
          <>
            {" / "}
            <Link href={`/${locale}/${firstVertical.slug}`} className="hover:text-foreground">
              {fr ? firstVertical.name_fr : firstVertical.name_en}
            </Link>
          </>
        )}
        {" / "}
        <span className="font-medium text-foreground">{provider.name}</span>
      </nav>

      <div className="mb-6 flex items-start gap-4">
        {provider.logo_url && (
          <Image
            src={provider.logo_url}
            alt={provider.name}
            width={64}
            height={64}
            className="rounded-xl border object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{provider.name}</h1>
          {rating.avg != null && (
            <div className="mt-1">
              <StarRating value={rating.avg} count={rating.count} />
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {provider.commune && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {provider.address ? `${provider.address}, ` : ""}
                {communeDisplay(provider.commune)}
              </span>
            )}
            {provider.phone && (
              <a href={`tel:${provider.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="h-4 w-4" />
                {provider.phone}
              </a>
            )}
            {provider.website && (
              <a
                href={provider.website}
                rel="nofollow noopener"
                target="_blank"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-4 w-4" />
                {fr ? "Site web" : "Website"}
              </a>
            )}
          </div>
          {provider.languages.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {fr ? "Langues : " : "Languages: "}
              {provider.languages.map((l) => l.toUpperCase()).join(", ")}
            </p>
          )}
        </div>
      </div>

      <StatusBanner locale={locale} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {provider.photos.length > 0 && (
            <PhotoGallery photos={provider.photos} name={provider.name} />
          )}

          {description && <p className="text-sm leading-relaxed">{description}</p>}

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c.id} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                  {cname(c, locale)}
                </span>
              ))}
            </div>
          )}

          {weekly && <HoursTable weekly={weekly} openNow={openNow} locale={locale} />}

          {provider.lat != null && provider.lon != null && (
            <MapEmbed lat={provider.lat} lon={provider.lon} title={provider.name} />
          )}

          {offers.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-base font-semibold">
                {fr ? "Prestations & tarifs" : "Services & prices"}
              </h2>
              <ul className="space-y-2">
                {offers.map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-3 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                    <span>{offerTitle(o, locale)}</span>
                    <span className="shrink-0 font-medium">{priceLabel(o, locale)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {fr
                  ? "Tarifs indicatifs communiqués par le prestataire."
                  : "Indicative prices provided by the provider."}
              </p>
            </div>
          )}

          {reviews.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-base font-semibold">
                {fr ? "Avis clients" : "Customer reviews"}
              </h2>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border bg-card p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <StarRating value={r.rating} size={14} showValue={false} />
                      <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span>
                    </div>
                    <p className="text-sm font-medium">{r.author_name}</p>
                    {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside>
          {isClaimed ? (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-1 text-base font-semibold">
                {bookable
                  ? fr
                    ? "Prendre rendez-vous"
                    : "Book an appointment"
                  : fr
                    ? "Demander un devis"
                    : "Request a quote"}
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {bookable
                  ? autoMode
                    ? fr
                      ? "Réservation immédiate — choisissez un créneau libre."
                      : "Instant booking — pick an open slot."
                    : fr
                      ? "Le prestataire confirme votre créneau par email."
                      : "The provider confirms your slot by email."
                  : fr
                    ? "Réponse directe du prestataire."
                    : "Direct reply from the provider."}
              </p>
              {bookable && autoMode && slotDays.length > 0 && categories.length > 0 ? (
                <SlotPickerForm
                  locale={locale}
                  providerId={provider.id}
                  categories={categories}
                  days={slotDays}
                  backTo={path}
                />
              ) : bookable && categories.length > 0 ? (
                <BookingForm
                  locale={locale}
                  providerId={provider.id}
                  categories={categories}
                  backTo={path}
                />
              ) : categories.length > 0 ? (
                <LeadForm
                  locale={locale}
                  categoryId={categories[0].id}
                  backTo={path}
                  providerId={provider.id}
                  showCommune={false}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {fr ? "Profil en cours de configuration." : "Profile being set up."}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="mb-3 text-base font-semibold">{fr ? "Contact" : "Contact"}</h2>
                <div className="space-y-2 text-sm">
                  {provider.phone && (
                    <a href={`tel:${provider.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Phone className="h-4 w-4" /> {provider.phone}
                    </a>
                  )}
                  {provider.website && (
                    <a href={provider.website} rel="nofollow noopener" target="_blank" className="flex items-center gap-2 text-primary hover:underline">
                      <Globe className="h-4 w-4" /> {fr ? "Site web" : "Website"}
                    </a>
                  )}
                  {provider.commune && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {provider.address ? `${provider.address}, ` : ""}
                      {communeDisplay(provider.commune)}
                    </p>
                  )}
                  {!provider.phone && !provider.website && (
                    <p className="text-muted-foreground">
                      {fr ? "Coordonnées non renseignées." : "No contact details yet."}
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <h2 className="mb-1 text-base font-semibold">
                  {fr ? "C'est votre entreprise ?" : "Is this your business?"}
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  {fr
                    ? "Revendiquez cette fiche pour recevoir des demandes de devis, gérer vos tarifs et prendre des rendez-vous — gratuitement."
                    : "Claim this listing to receive quote requests, manage your prices and take bookings — for free."}
                </p>
                <ClaimForm locale={locale} providerId={provider.id} providerName={provider.name} backTo={path} />
              </div>
            </div>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="mb-4 text-lg font-semibold">
            {fr ? "Prestataires similaires" : "Similar providers"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <ProviderCard key={p.id} provider={p} locale={locale} />
            ))}
          </div>
        </section>
      )}
      </main>
      <Footer />
    </div>
  );
}
