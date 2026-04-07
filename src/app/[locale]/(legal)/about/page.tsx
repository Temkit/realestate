"use client";

import { useLocale } from "next-intl";
import { LegalPage } from "@/components/legal-page";

export default function AboutPage() {
  const locale = useLocale();
  const isFr = locale === "fr";

  return (
    <LegalPage
      title={isFr ? "À propos d'olu.lu" : "About olu.lu"}
      lastUpdated=""
    >
      <h2>{isFr ? "Qu'est-ce qu'olu.lu ?" : "What is olu.lu?"}</h2>
      <p>
        {isFr
          ? "olu.lu est un moteur de recherche immobilière dédié au Luxembourg. Grâce à l'intelligence artificielle, il vous permet de décrire le bien que vous recherchez en langage naturel et de trouver des annonces correspondantes sur les principaux portails luxembourgeois."
          : "olu.lu is a real estate search engine dedicated to Luxembourg. Using artificial intelligence, it lets you describe the property you're looking for in natural language and find matching listings across major Luxembourg portals."}
      </p>

      <h2>{isFr ? "Comment ça marche ?" : "How does it work?"}</h2>
      <p>
        {isFr
          ? "Lorsque vous effectuez une recherche, olu.lu interroge en temps réel les annonces disponibles sur athome.lu, immotop.lu, wortimmo.lu, immobilier.lu, et d'autres portails luxembourgeois. Les résultats sont agrégés, structurés et enrichis d'insights IA pour vous aider à trouver le bien idéal."
          : "When you search, olu.lu queries available listings in real-time from athome.lu, immotop.lu, wortimmo.lu, immobilier.lu, and other Luxembourg portals. Results are aggregated, structured, and enriched with AI insights to help you find the ideal property."}
      </p>

      <h2>{isFr ? "Ce que nous ne sommes pas" : "What we are not"}</h2>
      <p>
        {isFr
          ? "olu.lu n'est pas une agence immobilière. Nous ne proposons aucun bien à la vente ou à la location. Nous ne participons à aucune transaction. Les annonces et leurs prix appartiennent aux portails et agences sources."
          : "olu.lu is not a real estate agency. We do not offer any property for sale or rent. We do not participate in any transaction. Listings and their prices belong to the source portals and agencies."}
      </p>

      <h2>{isFr ? "Contact" : "Contact"}</h2>
      <p>
        {isFr ? "Pour toute question :" : "For any questions:"}{" "}
        <a href="mailto:contact@olu.lu">contact@olu.lu</a>
      </p>
    </LegalPage>
  );
}
