/**
 * JSON-LD structured data for SEO pages.
 * Generates Schema.org ItemList with RealEstateListing items + BreadcrumbList.
 */

import type { Property } from "@/lib/types";
import type { ResolvedParams } from "./slugs";

const BASE_URL = "https://olu.lu";

export function buildListingJsonLd(
  resolved: ResolvedParams,
  properties: Property[]
): object {
  const name =
    resolved.locale === "fr"
      ? `${resolved.typeDisplay}s ${resolved.mode === "buy" ? "à acheter" : "à louer"} à ${resolved.commune}, Luxembourg`
      : `${resolved.typeDisplay}s for ${resolved.mode === "buy" ? "sale" : "rent"} in ${resolved.commune}, Luxembourg`;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: properties.length,
    itemListElement: properties.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "RealEstateListing",
        name: `${p.propertyType} ${resolved.locale === "fr" ? "à" : "in"} ${p.city || resolved.commune}`,
        ...(p.description ? { description: p.description.slice(0, 200) } : {}),
        ...(p.listingUrl ? { url: p.listingUrl } : {}),
        datePosted: new Date().toISOString().split("T")[0],
        ...(p.price > 0
          ? {
              offers: {
                "@type": "Offer",
                price: p.price,
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
                priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              },
            }
          : {}),
        address: {
          "@type": "PostalAddress",
          streetAddress: p.address || undefined,
          addressLocality: p.city || resolved.commune,
          addressRegion: "Luxembourg",
          addressCountry: "LU",
        },
        areaServed: {
          "@type": "City",
          name: p.city || resolved.commune,
        },
        ...(p.sqft > 0
          ? {
              floorSize: {
                "@type": "QuantitativeValue",
                value: p.sqft,
                unitCode: "MTK",
              },
            }
          : {}),
        ...(p.bedrooms > 0 ? { numberOfRooms: p.bedrooms } : {}),
        ...(p.bathrooms > 0 ? { numberOfBathroomsTotal: p.bathrooms } : {}),
        ...(p.imageUrl ? { image: p.imageUrl } : {}),
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(
  resolved: ResolvedParams,
  modeSlug: string,
  typeSlug: string,
  communeSlug: string
): object {
  const home = resolved.locale === "fr" ? "Accueil" : "Home";

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: home,
        item: `${BASE_URL}/${resolved.locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: resolved.modeDisplay,
        item: `${BASE_URL}/${resolved.locale}/${modeSlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: resolved.typeDisplay,
        item: `${BASE_URL}/${resolved.locale}/${modeSlug}/${typeSlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: resolved.commune,
        item: `${BASE_URL}/${resolved.locale}/${modeSlug}/${typeSlug}/${communeSlug}`,
      },
    ],
  };
}
