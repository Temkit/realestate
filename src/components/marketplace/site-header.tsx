"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "./logo";

/** Launch verticals — slugs are stable (spec §2). Kept static for a fast header. */
const VERTICALS = [
  { slug: "garages", key: "garages" },
  { slug: "artisans", key: "artisans" },
  { slug: "cleaning", key: "cleaning" },
  { slug: "demenagement", key: "moving" },
  { slug: "coiffeur", key: "hair" },
  { slug: "beaute", key: "beauty" },
] as const;

export function SiteHeader() {
  const t = useTranslations("marketplace");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3.5 sm:px-8">
        <Link href="/" aria-label="lëtz24 — accueil" onClick={() => setOpen(false)}>
          <Logo className="h-8 w-auto" />
        </Link>

        <nav className="hidden items-center gap-5 text-sm lg:flex">
          {VERTICALS.map((v) => (
            <Link
              key={v.slug}
              href={`/${v.slug}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`verticals.${v.key}`)}
            </Link>
          ))}
          <Link href="/immo" className="text-muted-foreground transition-colors hover:text-foreground">
            {t("verticals.immo")}
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <NextLink
            href="/portal/login"
            className="hidden rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-block"
          >
            {t("proSpace")}
          </NextLink>
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            className="rounded-xl p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t px-3.5 py-3 text-sm lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {VERTICALS.map((v) => (
              <Link
                key={v.slug}
                href={`/${v.slug}`}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-muted"
              >
                {t(`verticals.${v.key}`)}
              </Link>
            ))}
            <Link href="/immo" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-muted">
              {t("verticals.immo")}
            </Link>
            <NextLink href="/portal/login" className="rounded-lg px-3 py-2 hover:bg-muted">
              {t("proSpace")}
            </NextLink>
          </div>
        </nav>
      )}
    </header>
  );
}
