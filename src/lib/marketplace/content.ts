/**
 * Templated marketing/SEO copy for category and category×commune pages.
 * Kept deterministic (no LLM) so pages are stable and cache well; the phrasing
 * reads naturally and varies by category/commune name.
 */

export function categoryIntro(
  catName: string,
  communeName: string | null,
  locale: string
): string {
  const fr = locale !== "en";
  const where = communeName ? (fr ? `à ${communeName}` : `in ${communeName}`) : fr ? "au Luxembourg" : "in Luxembourg";
  const cat = catName.toLowerCase();
  return fr
    ? `Vous cherchez un ${cat} ${where} ? Comparez les prestataires près de chez vous — avis, horaires, tarifs et localisation — puis demandez jusqu'à 3 devis gratuits en quelques minutes. La prise de rendez-vous en ligne est disponible chez de nombreux prestataires, et les fiches « Vérifiées » ont été confirmées par leur propriétaire.`
    : `Looking for a ${cat} ${where}? Compare providers near you — reviews, hours, prices and location — then request up to 3 free quotes in minutes. Many providers accept online booking, and "Verified" listings have been confirmed by their owner.`;
}

export interface Faq {
  q: string;
  a: string;
}

export function categoryFaq(
  catName: string,
  communeName: string | null,
  locale: string
): Faq[] {
  const fr = locale !== "en";
  const cat = catName.toLowerCase();
  const where = communeName ? (fr ? `à ${communeName}` : `in ${communeName}`) : fr ? "au Luxembourg" : "in Luxembourg";
  if (fr) {
    return [
      {
        q: `Combien coûte un ${cat} ${where} ?`,
        a: `Les tarifs varient selon la prestation, le prestataire et l'urgence. Le plus simple est de demander plusieurs devis gratuits sur lux24 et de les comparer sans engagement.`,
      },
      {
        q: `Comment choisir un bon ${cat} ${where} ?`,
        a: `Regardez les avis clients, les horaires d'ouverture, la proximité et la réactivité. Privilégiez les prestataires « Vérifiés » et demandez un devis détaillé avant de vous décider.`,
      },
      {
        q: `Puis-je prendre rendez-vous en ligne ?`,
        a: `Oui. De nombreux prestataires acceptent la demande de rendez-vous directement depuis leur fiche ; vous recevez une confirmation par email.`,
      },
      {
        q: `Le service lux24 est-il gratuit ?`,
        a: `Oui, pour vous c'est entièrement gratuit et sans engagement. Vous décrivez votre besoin, nous transmettons votre demande aux prestataires concernés.`,
      },
    ];
  }
  return [
    {
      q: `How much does a ${cat} cost ${where}?`,
      a: `Prices vary by service, provider and urgency. The easiest way is to request several free quotes on lux24 and compare them with no obligation.`,
    },
    {
      q: `How do I choose a good ${cat} ${where}?`,
      a: `Check customer reviews, opening hours, proximity and responsiveness. Prefer "Verified" providers and ask for a detailed quote before deciding.`,
    },
    {
      q: `Can I book online?`,
      a: `Yes. Many providers accept appointment requests directly from their listing; you get an email confirmation.`,
    },
    {
      q: `Is lux24 free to use?`,
      a: `Yes, it's completely free and no-obligation for you. Describe your need and we forward your request to matching providers.`,
    },
  ];
}
