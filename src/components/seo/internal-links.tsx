import Link from "next/link";
import {
  COMMUNES,
  getTypesForLocale,
  getModesForLocale,
} from "@/lib/seo/slugs";
import type { ResolvedParams } from "@/lib/seo/slugs";

interface InternalLinksProps {
  resolved: ResolvedParams;
  modeSlug: string;
  typeSlug: string;
  communeSlug: string;
}

export function InternalLinks({
  resolved,
  modeSlug,
  typeSlug,
  communeSlug,
}: InternalLinksProps) {
  const locale = resolved.locale;
  const types = getTypesForLocale(locale);
  const modes = getModesForLocale(locale);

  // Other property types in same commune
  const otherTypes = types.filter((t) => t.slug !== typeSlug);

  // Other communes for same type (exclude current)
  const otherCommunes = COMMUNES.filter((c) => c.slug !== communeSlug).slice(
    0,
    6
  );

  // Other mode for same type + commune
  const otherMode = modes.find((m) => m.slug !== modeSlug);

  const alsoIn = locale === "fr" ? "Aussi \u00e0" : "Also in";
  const alsoLooking =
    locale === "fr" ? "Vous cherchez aussi" : "Also looking for";
  const otherAreas =
    locale === "fr"
      ? `${resolved.typeDisplay}s dans d\u2019autres communes`
      : `${resolved.typeDisplay}s in other areas`;

  return (
    <div className="mt-10 pt-8 border-t space-y-6">
      {/* Same commune, other types */}
      <div>
        <h3 className="text-sm font-semibold mb-2.5">
          {alsoIn} {resolved.commune}
        </h3>
        <div className="flex flex-wrap gap-2">
          {otherTypes.map((t) => (
            <Link
              key={t.slug}
              href={`/${locale}/${modeSlug}/${t.slug}/${communeSlug}`}
              className="text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {t.display}
            </Link>
          ))}
        </div>
      </div>

      {/* Same type, other communes */}
      <div>
        <h3 className="text-sm font-semibold mb-2.5">{otherAreas}</h3>
        <div className="flex flex-wrap gap-2">
          {otherCommunes.map((c) => (
            <Link
              key={c.slug}
              href={`/${locale}/${modeSlug}/${typeSlug}/${c.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {c.display}
            </Link>
          ))}
        </div>
      </div>

      {/* Other mode */}
      {otherMode && (
        <div>
          <h3 className="text-sm font-semibold mb-2.5">{alsoLooking}</h3>
          <Link
            href={`/${locale}/${otherMode.slug}/${typeSlug}/${communeSlug}`}
            className="text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {resolved.typeDisplay}{" "}
            {locale === "fr"
              ? otherMode.internal === "buy"
                ? "\u00e0 acheter"
                : "\u00e0 louer"
              : `for ${otherMode.internal === "buy" ? "sale" : "rent"}`}{" "}
            {locale === "fr" ? "\u00e0" : "in"} {resolved.commune}
          </Link>
        </div>
      )}
    </div>
  );
}
