import Link from "next/link";
import type { ResolvedParams } from "@/lib/seo/slugs";

interface BreadcrumbsProps {
  resolved: ResolvedParams;
  modeSlug: string;
  typeSlug: string;
  communeSlug: string;
}

export function Breadcrumbs({
  resolved,
  modeSlug,
  typeSlug,
  communeSlug,
}: BreadcrumbsProps) {
  const home = resolved.locale === "fr" ? "Accueil" : "Home";
  void communeSlug;

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-sm text-muted-foreground mb-4"
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li>
          <Link
            href={`/${resolved.locale}`}
            className="hover:text-foreground transition-colors"
          >
            {home}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href={`/${resolved.locale}/${modeSlug}`}
            className="hover:text-foreground transition-colors"
          >
            {resolved.modeDisplay}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href={`/${resolved.locale}/${modeSlug}/${typeSlug}`}
            className="hover:text-foreground transition-colors"
          >
            {resolved.typeDisplay}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <span className="text-foreground font-medium">
            {resolved.commune}
          </span>
        </li>
      </ol>
    </nav>
  );
}
