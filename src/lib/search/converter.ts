/**
 * Converter — transforms ScrapedListing/DedupedListing into Property for the UI.
 */

import type { Property, ScrapedListing } from "@/lib/types";
import type { DedupedListing } from "./dedup";

/**
 * Convert a DedupedListing (post-dedup) into a Property for the frontend.
 */
export function dedupedToProperty(
  listing: DedupedListing,
  id: string
): Property {
  const pricePerSqm =
    listing.price > 0 && listing.surface > 0
      ? Math.round(listing.price / listing.surface)
      : undefined;

  return {
    id,
    address: listing.address || listing.city || "Address not available",
    city: listing.city,
    state: "Luxembourg",
    zipCode: "",
    price: listing.price,
    bedrooms: listing.rooms,
    bathrooms: listing.bathrooms,
    sqft: listing.surface,
    propertyType: listing.propertyType,
    yearBuilt: null,
    description: listing.description,
    features: [],
    imageUrl: listing.imageUrl,
    source: listing.sources[0] || listing.source,
    sources: listing.sources,
    listingUrl: listing.listingUrls[0] || listing.url,
    listingUrls: listing.listingUrls,
    listingStatus:
      listing.contractType === "rent"
        ? `Rental - €${listing.price.toLocaleString()}/month`
        : "Active",
    listingMode: listing.contractType,
    pricePerSqm,
    priceVerified: listing.priceVerified,
    alsoOnPortals: listing.alsoOnPortals,
  };
}

/**
 * Convert a raw ScrapedListing into a Property (used when dedup is skipped).
 */
export function scrapedToProperty(
  listing: ScrapedListing,
  id: string
): Property {
  const pricePerSqm =
    listing.price > 0 && listing.surface > 0
      ? Math.round(listing.price / listing.surface)
      : undefined;

  return {
    id,
    address: listing.address || listing.city || "Address not available",
    city: listing.city,
    state: "Luxembourg",
    zipCode: "",
    price: listing.price,
    bedrooms: listing.rooms,
    bathrooms: listing.bathrooms,
    sqft: listing.surface,
    propertyType: listing.propertyType,
    yearBuilt: null,
    description: listing.description,
    features: [],
    imageUrl: listing.imageUrl,
    source: listing.source,
    sources: [listing.source],
    listingUrl: listing.url,
    listingUrls: [listing.url],
    listingStatus:
      listing.contractType === "rent"
        ? `Rental - €${listing.price.toLocaleString()}/month`
        : "Active",
    listingMode: listing.contractType,
    pricePerSqm,
    priceVerified: false,
    alsoOnPortals: [],
  };
}
