"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  const t = useTranslations("legal");

  return (
    <>
      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("backToHome")}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[#3b5bdb] flex items-center justify-center">
              <span className="text-white text-xs font-extrabold">olu</span>
            </div>
            <span className="text-sm font-bold">
              olu<span className="text-muted-foreground font-normal">.lu</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground mt-2">{lastUpdated}</p>
          )}

          <div className="mt-8 space-y-8 text-[0.9375rem] leading-relaxed text-muted-foreground
                          [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mb-3
                          [&_p]:mb-3
                          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul]:mb-4
                          [&_li]:pl-1
                          [&_strong]:text-foreground [&_strong]:font-semibold
                          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80
                          [&_table]:w-full [&_table]:border-collapse [&_table]:mt-3 [&_table]:mb-4
                          [&_th]:text-left [&_th]:text-foreground [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:pb-2 [&_th]:border-b
                          [&_td]:py-2.5 [&_td]:pr-4 [&_td]:border-b [&_td]:border-border/50 [&_td]:text-sm [&_td]:align-top">
            {children}
          </div>
        </article>
      </main>
    </>
  );
}
