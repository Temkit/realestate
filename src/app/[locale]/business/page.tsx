import type { Metadata } from "next";
import NextLink from "next/link";
import { setRequestLocale } from "next-intl/server";
import { BadgeCheck, CalendarCheck, Euro, MessageSquare } from "lucide-react";
import { SiteHeader } from "@/components/marketplace/site-header";
import { SectionDots } from "@/components/marketplace/dots";
import { Footer } from "@/components/footer";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === "fr";
  return {
    title: fr ? "Référencez votre entreprise | lëtz24" : "List your business | lëtz24",
    description: fr
      ? "Recevez des demandes de clients au Luxembourg. Gratuit pour démarrer, sans commission cachée."
      : "Receive customer requests in Luxembourg. Free to start, no hidden commission.",
    alternates: { canonical: `/${locale}/business` },
  };
}

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const fr = locale !== "en";

  const benefits = [
    {
      Icon: MessageSquare,
      t: fr ? "Des demandes qualifiées" : "Qualified leads",
      d: fr
        ? "Recevez par email les demandes de clients de votre secteur et de votre commune."
        : "Get customer requests from your trade and commune, straight to your inbox.",
    },
    {
      Icon: CalendarCheck,
      t: fr ? "Rendez-vous en ligne" : "Online booking",
      d: fr
        ? "Laissez vos clients réserver un créneau directement — vous confirmez d'un clic."
        : "Let clients book a slot directly — you confirm in one click.",
    },
    {
      Icon: BadgeCheck,
      t: fr ? "Badge « Vérifié »" : "“Verified” badge",
      d: fr
        ? "Une fiche revendiquée inspire confiance et remonte dans les résultats."
        : "A claimed listing builds trust and ranks higher in results.",
    },
    {
      Icon: Euro,
      t: fr ? "Gratuit pour démarrer" : "Free to start",
      d: fr
        ? "Vos premiers clients sont offerts. Ensuite, un tarif simple et transparent."
        : "Your first customers are on us. Then a simple, transparent price.",
    },
  ];

  const steps = fr
    ? [
        ["Trouvez votre fiche", "Votre entreprise est peut-être déjà listée sur lëtz24."],
        ["Revendiquez-la", "Confirmez que vous la gérez — c'est gratuit et immédiat."],
        ["Recevez des clients", "Complétez vos tarifs et horaires, et commencez à recevoir des demandes."],
      ]
    : [
        ["Find your listing", "Your business may already be listed on lëtz24."],
        ["Claim it", "Confirm you manage it — free and instant."],
        ["Get customers", "Add your prices and hours, and start receiving requests."],
      ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <section className="hero-mesh px-3.5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <SectionDots className="mb-4" />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {fr ? "Développez votre activité au Luxembourg" : "Grow your business in Luxembourg"}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              {fr
                ? "lëtz24 met votre entreprise devant des clients qui cherchent exactement votre service. Gratuit pour démarrer, sans commission cachée."
                : "lëtz24 puts your business in front of customers looking for exactly your service. Free to start, no hidden commission."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <NextLink href="/portal/login" className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                {fr ? "Accéder à mon espace" : "Go to my dashboard"}
              </NextLink>
              <a href="mailto:pro@letz24.lu" className="rounded-xl border px-6 py-3 text-sm font-medium hover:bg-muted">
                {fr ? "Nous contacter" : "Contact us"}
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-3.5 py-14 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border bg-card p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <h2 className="mt-3 font-semibold">{t}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/30 px-3.5 py-14 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">
              {fr ? "Comment ça marche" : "How it works"}
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map(([t, d], i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-semibold text-primary">
                    {i + 1}
                  </div>
                  <h3 className="mb-1 font-semibold">{t}</h3>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
