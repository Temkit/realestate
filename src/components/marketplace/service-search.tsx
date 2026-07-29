"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { Suggestions } from "@/lib/marketplace/public-queries";

/**
 * Hero search with autocomplete. Free text → /recherche results; a keyword that
 * clearly maps to a launch vertical fast-paths straight to that vertical.
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

const EMPTY: Suggestions = { providers: [], categories: [] };

export function ServiceSearch() {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const fr = locale !== "en";
  const router = useRouter();

  const [q, setQ] = useState("");
  const [sug, setSug] = useState<Suggestions>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);
  const hasTerm = q.trim().length >= 2;

  // Debounced suggestions
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/marketplace/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          setSug(await res.json());
          setOpen(true);
          setActive(-1);
        }
      } catch {
        /* aborted or offline */
      }
    }, 220);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Flat list of navigable items for keyboard nav
  const items: { label: string; href: string }[] = [
    ...sug.categories.map((c) => ({
      label: fr ? c.name_fr : c.name_en,
      href: `/${c.vertical_slug}?cat=${c.slug}`,
    })),
    ...sug.providers.map((p) => ({
      label: p.commune ? `${p.name} · ${p.commune}` : p.name,
      href: `/pro/${p.slug}`,
    })),
  ];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (active >= 0 && items[active]) return go(items[active].href);
    const term = q.trim();
    if (!term) return;
    const match = KEYWORDS.find((k) => k.rx.test(term));
    if (match) return go(match.slug === "immo" ? "/immo" : `/${match.slug}`);
    go(`/recherche?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl" ref={boxRef}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => items.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={t("hero.searchPlaceholder")}
            aria-label={t("hero.searchPlaceholder")}
            autoComplete="off"
            className="w-full rounded-2xl border bg-background py-4 pl-12 pr-4 text-base shadow-sm outline-none focus:ring-2 focus:ring-primary"
          />

          {open && hasTerm && items.length > 0 && (
            <ul className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-card shadow-lg">
              {sug.categories.length > 0 && (
                <li className="px-4 pt-2 text-xs font-medium text-muted-foreground">
                  {fr ? "Services" : "Services"}
                </li>
              )}
              {items.map((it, i) => {
                const isCat = i < sug.categories.length;
                const showProvHeader = !isCat && i === sug.categories.length && sug.providers.length > 0;
                return (
                  <div key={it.href + i}>
                    {showProvHeader && (
                      <div className="px-4 pt-2 text-xs font-medium text-muted-foreground">
                        {fr ? "Prestataires" : "Providers"}
                      </div>
                    )}
                    <li>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(it.href)}
                        onMouseEnter={() => setActive(i)}
                        className={`block w-full px-4 py-2 text-left text-sm ${active === i ? "bg-muted" : "hover:bg-muted"}`}
                      >
                        {it.label}
                      </button>
                    </li>
                  </div>
                );
              })}
            </ul>
          )}
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-2xl bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          {t("hero.searchButton")}
        </button>
      </div>
    </form>
  );
}
