/**
 * SEO slug mappings — bidirectional mapping between URL slugs and internal values.
 * Central source of truth for all 192 static page combinations.
 */

// ── Commune slugs (locale-independent) ──────────────────────────────────────

export const COMMUNES: { slug: string; display: string }[] = [
  { slug: "luxembourg", display: "Luxembourg" },
  { slug: "esch-sur-alzette", display: "Esch-sur-Alzette" },
  { slug: "differdange", display: "Differdange" },
  { slug: "dudelange", display: "Dudelange" },
  { slug: "ettelbruck", display: "Ettelbruck" },
  { slug: "diekirch", display: "Diekirch" },
  { slug: "mondorf-les-bains", display: "Mondorf-les-Bains" },
  { slug: "strassen", display: "Strassen" },
  { slug: "bertrange", display: "Bertrange" },
  { slug: "mamer", display: "Mamer" },
  { slug: "hesperange", display: "Hesperange" },
  { slug: "belval", display: "Belval" },
];

// ── Locale-specific slugs ───────────────────────────────────────────────────

interface SlugEntry {
  slug: string;
  display: string;
  internal: string; // internal mode or query term
}

const MODES: Record<string, SlugEntry[]> = {
  fr: [
    { slug: "acheter", display: "Acheter", internal: "buy" },
    { slug: "louer", display: "Louer", internal: "rent" },
  ],
  en: [
    { slug: "buy", display: "Buy", internal: "buy" },
    { slug: "rent", display: "Rent", internal: "rent" },
  ],
};

const PROPERTY_TYPES: Record<string, SlugEntry[]> = {
  fr: [
    { slug: "appartement", display: "Appartement", internal: "appartement" },
    { slug: "maison", display: "Maison", internal: "maison" },
    { slug: "bureau", display: "Bureau", internal: "bureau" },
    { slug: "studio", display: "Studio", internal: "studio" },
  ],
  en: [
    { slug: "apartment", display: "Apartment", internal: "appartement" },
    { slug: "house", display: "House", internal: "maison" },
    { slug: "office", display: "Office", internal: "bureau" },
    { slug: "studio", display: "Studio", internal: "studio" },
  ],
};

// ── Resolution ──────────────────────────────────────────────────────────────

export interface ResolvedParams {
  mode: "buy" | "rent";
  modeDisplay: string;
  propertyType: string;
  typeDisplay: string;
  commune: string;
  communeSlug: string;
  query: string; // for buildSearchCacheKey
  locale: string;
}

/**
 * Resolve URL slugs to internal values. Returns null if any slug is invalid.
 */
export function resolveParams(
  locale: string,
  modeSlug: string,
  typeSlug: string,
  communeSlug: string
): ResolvedParams | null {
  const modes = MODES[locale];
  const types = PROPERTY_TYPES[locale];
  if (!modes || !types) return null;

  const modeEntry = modes.find((m) => m.slug === modeSlug);
  const typeEntry = types.find((t) => t.slug === typeSlug);
  const communeEntry = COMMUNES.find((c) => c.slug === communeSlug);

  if (!modeEntry || !typeEntry || !communeEntry) return null;

  return {
    mode: modeEntry.internal as "buy" | "rent",
    modeDisplay: modeEntry.display,
    propertyType: typeEntry.internal,
    typeDisplay: typeEntry.display,
    commune: communeEntry.display,
    communeSlug: communeEntry.slug,
    query: `${typeEntry.internal} ${communeEntry.display}`,
    locale,
  };
}

/**
 * Get the equivalent slugs in the other locale (for hreflang).
 */
export function getAlternateUrl(
  locale: string,
  modeSlug: string,
  typeSlug: string,
  communeSlug: string
): { locale: string; path: string } {
  const otherLocale = locale === "fr" ? "en" : "fr";
  const resolved = resolveParams(locale, modeSlug, typeSlug, communeSlug);
  if (!resolved) return { locale: otherLocale, path: `/${otherLocale}` };

  const otherModes = MODES[otherLocale]!;
  const otherTypes = PROPERTY_TYPES[otherLocale]!;
  const otherMode = otherModes.find((m) => m.internal === resolved.mode)!;
  const otherType = otherTypes.find(
    (t) => t.internal === resolved.propertyType
  )!;

  return {
    locale: otherLocale,
    path: `/${otherLocale}/${otherMode.slug}/${otherType.slug}/${communeSlug}`,
  };
}

/**
 * Generate all 192 combinations for generateStaticParams.
 */
export function allCombinations(): {
  locale: string;
  mode: string;
  propertyType: string;
  commune: string;
}[] {
  const combos: {
    locale: string;
    mode: string;
    propertyType: string;
    commune: string;
  }[] = [];

  for (const locale of ["fr", "en"]) {
    for (const mode of MODES[locale]!) {
      for (const type of PROPERTY_TYPES[locale]!) {
        for (const commune of COMMUNES) {
          combos.push({
            locale,
            mode: mode.slug,
            propertyType: type.slug,
            commune: commune.slug,
          });
        }
      }
    }
  }

  return combos;
}

/**
 * Get all modes for a locale (for index pages).
 */
export function getModesForLocale(locale: string): SlugEntry[] {
  return MODES[locale] || MODES["en"]!;
}

/**
 * Get all property types for a locale (for index pages).
 */
export function getTypesForLocale(locale: string): SlugEntry[] {
  return PROPERTY_TYPES[locale] || PROPERTY_TYPES["en"]!;
}
