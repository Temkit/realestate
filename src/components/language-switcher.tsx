"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = locale === "fr" ? "en" : "fr";

  return (
    <button
      onClick={() => router.replace(pathname, { locale: switchTo })}
      className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors
                 px-2.5 py-1.5 rounded-lg hover:bg-muted tabular-nums"
      aria-label={`Switch to ${switchTo === "fr" ? "French" : "English"}`}
    >
      <span className={locale === "fr" ? "text-foreground font-semibold" : ""}>FR</span>
      <span className="text-muted-foreground/40 mx-1">|</span>
      <span className={locale === "en" ? "text-foreground font-semibold" : ""}>EN</span>
    </button>
  );
}
