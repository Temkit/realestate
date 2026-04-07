"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  const switchTo = locale === "fr" ? "en" : "fr";

  const handleSwitch = () => {
    // Replace /fr/ or /en/ prefix with the target locale
    const newPath = pathname.replace(/^\/(fr|en)/, `/${switchTo}`);
    window.location.href = newPath;
  };

  return (
    <button
      onClick={handleSwitch}
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
