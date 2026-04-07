"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded bg-[#3b5bdb] flex items-center justify-center">
                <span className="text-white text-[10px] font-extrabold">olu</span>
              </div>
              <span className="text-sm font-bold">
                olu<span className="text-muted-foreground font-normal">.lu</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {t("disclaimer")}
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link href="/about" className="hover:text-foreground transition-colors">
              {t("about")}
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              {t("terms")}
            </Link>
            <Link href="/mentions-legales" className="hover:text-foreground transition-colors">
              {t("legalNotice")}
            </Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">
              {t("cookies")}
            </Link>
            <a href="mailto:contact@olu.lu" className="hover:text-foreground transition-colors">
              {t("contact")}
            </a>
          </nav>
        </div>

        <div className="mt-6 pt-6 border-t text-xs text-muted-foreground/60">
          {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
