import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import {
  Car,
  Hammer,
  Sparkles,
  Truck,
  Scissors,
  Sparkle,
  Home,
  MessageSquare,
  ScrollText,
  CalendarCheck,
  BadgeCheck,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/marketplace/site-header";
import { ServiceSearch } from "@/components/marketplace/service-search";
import { Footer } from "@/components/footer";
import {
  getVerticalCounts,
  listActiveVerticals,
  listProvidersForVertical,
} from "@/lib/marketplace/public-queries";
import { vname } from "@/lib/marketplace/display";
import { ProviderCard } from "@/components/marketplace/provider-card";

// Refresh homepage counts + featured hourly (DB-backed).
export const revalidate = 3600;

// Static launch verticals (spec §2) — resilient, no DB dependency on the
// marketing homepage. The DB remains the source of truth for which pages exist.
const VERTICALS = [
  { slug: "garages", key: "garages", Icon: Car },
  { slug: "artisans", key: "artisans", Icon: Hammer },
  { slug: "cleaning", key: "cleaning", Icon: Sparkles },
  { slug: "demenagement", key: "moving", Icon: Truck },
  { slug: "coiffeur", key: "hair", Icon: Scissors },
  { slug: "beaute", key: "beauty", Icon: Sparkle },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplace");
  const [counts, activeVerticals] = await Promise.all([
    getVerticalCounts().catch(() => ({}) as Record<string, number>),
    listActiveVerticals().catch(() => []),
  ]);
  const total = Object.values(counts).reduce((a, n) => a + n, 0);

  // Featured providers per vertical (a few each) for the homepage rows
  const featuredByVertical = (
    await Promise.all(
      activeVerticals.map(async (v) => {
        const { providers } = await listProvidersForVertical(v.id, { limit: 4 }).catch(
          () => ({ providers: [] })
        );
        return { vertical: v, providers };
      })
    )
  ).filter((f) => f.providers.length > 0);

  const steps = [
    { Icon: MessageSquare, key: "describe" },
    { Icon: ScrollText, key: "compare" },
    { Icon: CalendarCheck, key: "book" },
  ];
  const trust = [
    { Icon: BadgeCheck, key: "free" },
    { Icon: ShieldCheck, key: "verified" },
    { Icon: Wallet, key: "noCommitment" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main-content">
        {/* Hero */}
        <section className="hero-mesh px-3.5 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("hero.title")}{" "}
              <span className="text-primary">{t("hero.titleHighlight")}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t("hero.subtitle")}
            </p>
            <div className="mt-8">
              <ServiceSearch />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {trust.map(({ Icon, key }) => (
                <span key={key} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-primary" />
                  {t(`trust.${key}`)}
                </span>
              ))}
            </div>
            {total > 0 && (
              <p className="mt-4 text-sm font-medium text-primary">
                {t("hero.count", { count: total })}
              </p>
            )}
          </div>
        </section>

        {/* Verticals grid */}
        <section id="services" className="mx-auto max-w-7xl scroll-mt-20 px-3.5 py-14 sm:px-8">
          <h2 className="mb-2 text-center text-2xl font-bold tracking-tight">
            {t("verticalsSection.title")}
          </h2>
          <p className="mb-8 text-center text-muted-foreground">
            {t("verticalsSection.subtitle")}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {VERTICALS.map(({ slug, key, Icon }) => (
              <Link
                key={slug}
                href={`/${slug}`}
                className="group flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-semibold transition-colors group-hover:text-primary">
                    {t(`verticals.${key}`)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`verticalTaglines.${key}`)}
                  </p>
                  {counts[slug] > 0 && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {t("countBadge", { count: counts[slug] })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {/* Real estate — the immo search, kept as a vertical */}
            <Link
              href="/immo"
              className="group flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Home className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold transition-colors group-hover:text-primary">
                  {t("verticals.immo")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("verticalTaglines.immo")}
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Featured providers — a row per vertical */}
        {featuredByVertical.length > 0 && (
          <section className="mx-auto max-w-7xl px-3.5 pb-8 sm:px-8">
            <h2 className="mb-4 text-lg font-semibold">{t("featured.title")}</h2>
            <div className="space-y-8">
              {featuredByVertical.map(({ vertical, providers }) => (
                <div key={vertical.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">{vname(vertical, locale)}</h3>
                    <Link
                      href={`/${vertical.slug}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {t("featured.seeAll")}
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {providers.map((p) => (
                      <ProviderCard key={p.id} provider={p} locale={locale} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="border-y bg-muted/30 px-3.5 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">
              {t("howItWorks.title")}
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map(({ Icon, key }, i) => (
                <div key={key} className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-7 w-7" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-primary">
                    {t("howItWorks.step")} {i + 1}
                  </p>
                  <h3 className="mb-1 font-semibold">{t(`howItWorks.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`howItWorks.${key}.body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* List your business CTA */}
        <section className="mx-auto max-w-5xl px-3.5 py-16 sm:px-8">
          <div className="rounded-3xl border bg-card p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight">{t("pro.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("pro.subtitle")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="mailto:pro@lux24.lu"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {t("pro.cta")}
              </a>
              <NextLink
                href="/portal/login"
                className="rounded-xl border px-6 py-3 text-sm font-medium hover:bg-muted"
              >
                {t("pro.login")}
              </NextLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
