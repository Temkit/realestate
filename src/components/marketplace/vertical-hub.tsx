import Link from "next/link";
import { COMMUNES } from "@/lib/seo/slugs";
import type { Category, Vertical } from "@/lib/marketplace/types";
import { cname, vname } from "@/lib/marketplace/display";
import { SiteHeader } from "./site-header";
import { Footer } from "@/components/footer";

/** Vertical hub — /[locale]/[vertical]: categories + featured communes. */
export function VerticalHub({
  vertical,
  categories,
  locale,
  counts = {},
  total = 0,
}: {
  vertical: Vertical;
  categories: Category[];
  locale: string;
  counts?: Record<number, number>;
  total?: number;
}) {
  const fr = locale !== "en";
  const name = vname(vertical, locale);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-10 sm:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-foreground">
          {fr ? "Accueil" : "Home"}
        </Link>
        {" / "}
        <span className="font-medium text-foreground">{name}</span>
      </nav>

      <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {fr ? `${name} au Luxembourg` : `${name} in Luxembourg`}
      </h1>
      <p className="mb-8 text-muted-foreground">
        {total > 0
          ? fr
            ? `${total} prestataires — comparez, demandez des devis, prenez rendez-vous.`
            : `${total} providers — compare, get quotes, book appointments.`
          : fr
            ? "Comparez les prestataires, demandez des devis gratuits, prenez rendez-vous."
            : "Compare providers, get free quotes, book appointments."}
      </p>

      <h2 className="mb-3 text-lg font-semibold">{fr ? "Services" : "Services"}</h2>
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/${locale}/${vertical.slug}/${c.slug}`}
            className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/50"
          >
            <p className="font-medium transition-colors group-hover:text-primary">
              {cname(c, locale)}
            </p>
            {counts[c.id] > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {counts[c.id]} {fr ? "prestataires" : "providers"}
              </p>
            )}
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        {fr ? "Par commune" : "By commune"}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {COMMUNES.map((commune) =>
          categories.slice(0, 1).map((c) => (
            <Link
              key={commune.slug}
              href={`/${locale}/${vertical.slug}/${c.slug}/${commune.slug}`}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/50"
            >
              <p className="font-medium">{commune.display}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {name} — {commune.display}
              </p>
            </Link>
          ))
        )}
      </div>
      </main>
      <Footer />
    </div>
  );
}
