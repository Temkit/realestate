/**
 * Editorial guides — bilingual content for SEO + user trust. Data-driven so
 * new guides are one object; each renders at /[locale]/guides/[slug].
 */

export interface GuideSection {
  h: { fr: string; en: string };
  p: { fr: string; en: string };
}

export interface Guide {
  slug: string;
  title: { fr: string; en: string };
  excerpt: { fr: string; en: string };
  /** Optional related vertical slug for a CTA at the end. */
  vertical?: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "choisir-un-garage",
    vertical: "garages",
    title: { fr: "Comment choisir un bon garage au Luxembourg", en: "How to choose a good garage in Luxembourg" },
    excerpt: {
      fr: "Avis, transparence des prix, proximité : les critères qui comptent avant de confier votre voiture.",
      en: "Reviews, price transparency, proximity: what matters before trusting a garage with your car.",
    },
    sections: [
      {
        h: { fr: "Vérifiez les avis et la réputation", en: "Check reviews and reputation" },
        p: {
          fr: "Les avis clients donnent une bonne idée du sérieux d'un garage. Sur lux24, les prestataires « Vérifiés » ont confirmé leur fiche et sont joignables directement.",
          en: "Customer reviews give a good sense of a garage's reliability. On lux24, 'Verified' providers have confirmed their listing and are reachable directly.",
        },
      },
      {
        h: { fr: "Demandez un devis avant l'intervention", en: "Ask for a quote before the work" },
        p: {
          fr: "Un bon garage établit un devis clair. Comparez plusieurs devis gratuits pour un même service (vidange, freins, pneus) afin d'éviter les mauvaises surprises.",
          en: "A good garage provides a clear quote. Compare several free quotes for the same service (oil change, brakes, tyres) to avoid surprises.",
        },
      },
      {
        h: { fr: "Privilégiez la proximité et les horaires", en: "Favour proximity and opening hours" },
        p: {
          fr: "Un garage proche de chez vous ou de votre travail simplifie le dépôt et la récupération du véhicule. Vérifiez les horaires et la possibilité de prendre rendez-vous en ligne.",
          en: "A garage near your home or work makes dropping off and picking up easier. Check the hours and whether online booking is available.",
        },
      },
    ],
  },
  {
    slug: "prix-plombier",
    vertical: "artisans",
    title: { fr: "Prix d'un plombier au Luxembourg : à quoi s'attendre", en: "Plumber prices in Luxembourg: what to expect" },
    excerpt: {
      fr: "Tarif horaire, déplacement, urgence : comprendre ce qui compose la facture d'un plombier.",
      en: "Hourly rate, call-out, emergency: understanding what makes up a plumber's bill.",
    },
    sections: [
      {
        h: { fr: "Tarif horaire et frais de déplacement", en: "Hourly rate and call-out fee" },
        p: {
          fr: "La plupart des plombiers facturent un tarif horaire auquel s'ajoute un forfait de déplacement. Demandez toujours si le déplacement est inclus dans le devis.",
          en: "Most plumbers charge an hourly rate plus a call-out fee. Always ask whether the call-out is included in the quote.",
        },
      },
      {
        h: { fr: "Urgences et interventions le week-end", en: "Emergencies and weekend work" },
        p: {
          fr: "Une fuite un dimanche coûte plus cher qu'un rendez-vous planifié. Pour les urgences, privilégiez les artisans indiquant une disponibilité 24/7.",
          en: "A leak on a Sunday costs more than a planned appointment. For emergencies, prefer tradespeople listing 24/7 availability.",
        },
      },
      {
        h: { fr: "Comparez plusieurs devis", en: "Compare several quotes" },
        p: {
          fr: "Pour les travaux non urgents, demandez trois devis gratuits sur lux24 et comparez le détail des prestations, pas seulement le prix total.",
          en: "For non-urgent work, request three free quotes on lux24 and compare the breakdown, not just the total price.",
        },
      },
    ],
  },
  {
    slug: "reserver-coiffeur-en-ligne",
    vertical: "coiffeur",
    title: { fr: "Réserver un coiffeur en ligne au Luxembourg", en: "Booking a hairdresser online in Luxembourg" },
    excerpt: {
      fr: "Trouver un salon, voir les disponibilités et réserver un créneau en quelques clics.",
      en: "Find a salon, see availability and book a slot in a few clicks.",
    },
    sections: [
      {
        h: { fr: "Trouvez un salon près de chez vous", en: "Find a salon near you" },
        p: {
          fr: "Filtrez par commune et consultez les avis, les horaires et les prestations proposées avant de choisir votre salon.",
          en: "Filter by commune and check reviews, hours and services offered before choosing your salon.",
        },
      },
      {
        h: { fr: "Réservez un créneau qui vous convient", en: "Book a slot that suits you" },
        p: {
          fr: "Les salons proposant la réservation en ligne affichent leurs créneaux disponibles. Choisissez l'heure et recevez une confirmation par email.",
          en: "Salons offering online booking show their available slots. Pick a time and get an email confirmation.",
        },
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
