/**
 * Property type synonyms — for broadening "You might also like" searches.
 * bureau → cabinet, co-working, local commercial
 * appartement → studio, duplex, penthouse
 */

const SYNONYMS: Record<string, string[]> = {
  bureau: ["cabinet", "co-working", "local commercial"],
  office: ["cabinet", "co-working", "local commercial"],
  appartement: ["studio", "duplex", "penthouse", "loft"],
  apartment: ["studio", "duplex", "penthouse", "loft"],
  maison: ["villa", "maison de ville", "bungalow"],
  house: ["villa", "townhouse", "bungalow"],
  studio: ["appartement", "chambre"],
};

/**
 * Get similar property types for a given type.
 * Returns 2-3 synonyms for broader search.
 */
export function getSimilarTypes(propertyType: string): string[] {
  const lower = (propertyType || "").toLowerCase();
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (lower.includes(key)) return synonyms.slice(0, 2);
  }
  return [];
}
