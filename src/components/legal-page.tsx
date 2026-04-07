"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  const t = useTranslations("legal");

  return (
    <>
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToHome")}
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-8">{lastUpdated}</p>
          <div className="prose prose-sm dark:prose-invert max-w-none
                          prose-headings:font-semibold prose-headings:tracking-tight
                          prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
                          prose-p:text-muted-foreground prose-p:leading-relaxed
                          prose-li:text-muted-foreground
                          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                          prose-strong:text-foreground prose-strong:font-semibold
                          prose-table:text-sm">
            {children}
          </div>
        </article>
      </main>
    </>
  );
}
