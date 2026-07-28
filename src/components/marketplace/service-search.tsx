"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Hero search — maps a free-text need to a launch vertical via keywords
 * (no LLM; conversational routing is a later, gated feature). Falls back to
 * scrolling to the services grid when nothing matches.
 */
const KEYWORDS: { rx: RegExp; slug: string }[] = [
  { rx: /vidange|pneu|frein|garage|voiture|auto|carross|contr[oô]le|technique/i, slug: "garages" },
  { rx: /plomb|[eé]lectric|peintre|peinture|chauffage|toit|couvreur|serrur|artisan|r[eé]nov|ma[cç]on/i, slug: "artisans" },
  { rx: /nettoy|m[eé]nage|cleaning|propret|vitres/i, slug: "cleaning" },
  { rx: /d[eé]m[eé]nag|transport|garde-?meuble|moving/i, slug: "demenagement" },
  { rx: /coiff|barbier|cheveux|couleur|hair/i, slug: "coiffeur" },
  { rx: /esth[eé]t|ongle|manucure|massage|spa|beaut|nail/i, slug: "beaute" },
  { rx: /immo|appart|maison|logement|louer|acheter|bureau|studio|villa/i, slug: "immo" },
];

export function ServiceSearch() {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const match = KEYWORDS.find((k) => k.rx.test(q));
    if (match) {
      router.push(match.slug === "immo" ? "/immo" : `/${match.slug}`);
      return;
    }
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("hero.searchPlaceholder")}
          aria-label={t("hero.searchPlaceholder")}
          className="w-full rounded-2xl border bg-background py-4 pl-12 pr-4 text-base shadow-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-2xl bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90"
      >
        {t("hero.searchButton")}
      </button>
    </form>
  );
}
