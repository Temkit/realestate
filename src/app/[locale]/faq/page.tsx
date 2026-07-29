import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/marketplace/site-header";
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
    title: fr ? "Questions fréquentes | lux24" : "FAQ | lux24",
    description: fr
      ? "Comment fonctionne lux24, est-ce gratuit, comment recevoir des devis et prendre rendez-vous."
      : "How lux24 works, is it free, how to get quotes and book appointments.",
    alternates: { canonical: `/${locale}/faq` },
  };
}

const FAQ = {
  fr: [
    ["Qu'est-ce que lux24 ?", "lux24 est une plateforme qui vous met en relation avec des prestataires de services au Luxembourg : garages, artisans, coiffeurs, déménagement, beauté et plus. Comparez, demandez des devis et prenez rendez-vous en un endroit."],
    ["Est-ce gratuit pour moi ?", "Oui, l'utilisation de lux24 est entièrement gratuite et sans engagement pour les particuliers."],
    ["Comment recevoir des devis ?", "Décrivez votre besoin depuis la page d'un service ou d'un prestataire. Nous transmettons votre demande jusqu'à 3 prestataires qui vous répondent directement."],
    ["Comment prendre rendez-vous ?", "De nombreux prestataires proposent la réservation en ligne : choisissez un créneau depuis leur fiche et recevez une confirmation par email."],
    ["Que signifie le badge « Vérifié » ?", "Il indique qu'un prestataire a revendiqué et confirmé sa fiche. Ces prestataires sont joignables directement et peuvent recevoir vos demandes."],
    ["Je suis un professionnel, comment me référencer ?", "Rendez-vous sur la page « Espace pro » pour revendiquer ou créer votre fiche. C'est gratuit pour démarrer."],
  ],
  en: [
    ["What is lux24?", "lux24 connects you with service providers in Luxembourg: garages, tradespeople, hairdressers, movers, beauty and more. Compare, request quotes and book — all in one place."],
    ["Is it free for me?", "Yes, using lux24 is completely free and no-obligation for individuals."],
    ["How do I get quotes?", "Describe your need from a service or provider page. We forward your request to up to 3 providers who reply directly."],
    ["How do I book an appointment?", "Many providers offer online booking: pick a slot from their listing and get an email confirmation."],
    ["What does the “Verified” badge mean?", "It means a provider has claimed and confirmed their listing. These providers are reachable directly and can receive your requests."],
    ["I'm a professional — how do I get listed?", "Head to the “Pro area” to claim or create your listing. It's free to start."],
  ],
} as const;

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const fr = locale !== "en";
  const items = fr ? FAQ.fr : FAQ.en;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-3.5 py-10 sm:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
          {fr ? "Questions fréquentes" : "Frequently asked questions"}
        </h1>
        <dl className="space-y-6">
          {items.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd className="mt-1.5 leading-relaxed text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </main>
      <Footer />
    </div>
  );
}
