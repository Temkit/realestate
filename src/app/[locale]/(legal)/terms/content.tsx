"use client";

import { useLocale } from "next-intl";
import { LegalPage } from "@/components/legal-page";

export function TermsOfService() {
  const locale = useLocale();
  const isFr = locale === "fr";

  return (
    <LegalPage
      title={isFr ? "Conditions Générales d'Utilisation" : "Terms of Service"}
      lastUpdated={isFr ? "Dernière mise à jour : avril 2026" : "Last updated: April 2026"}
    >
      <h2>{isFr ? "Objet" : "Purpose"}</h2>
      <p>
        {isFr
          ? "Les présentes conditions régissent l'utilisation du site olu.lu, un agrégateur de recherche immobilière au Luxembourg."
          : "These terms govern the use of olu.lu, a real estate search aggregator in Luxembourg."}
      </p>

      <h2>{isFr ? "Nature du service" : "Nature of Service"}</h2>
      <p>
        {isFr
          ? "olu.lu est un outil de recherche qui agrège des annonces immobilières provenant de sources publiques (athome.lu, immotop.lu, wortimmo.lu, etc.). olu.lu n'est pas une agence immobilière, ne propose aucun bien à la vente ou à la location, et ne participe à aucune transaction immobilière."
          : "olu.lu is a search tool that aggregates real estate listings from public sources (athome.lu, immotop.lu, wortimmo.lu, etc.). olu.lu is not a real estate agency, does not offer any property for sale or rent, and does not participate in any real estate transaction."}
      </p>

      <h2>{isFr ? "Exactitude des informations" : "Accuracy of Information"}</h2>
      <p>
        {isFr
          ? "Les prix, descriptions, surfaces et autres informations affichés sont fournis à titre indicatif. Ils proviennent de sources tierces et peuvent contenir des erreurs ou ne plus être à jour. L'utilisateur doit vérifier toute information directement auprès du portail source ou de l'agence immobilière concernée avant toute décision."
          : "Prices, descriptions, surfaces, and other information displayed are provided for informational purposes only. They come from third-party sources and may contain errors or be outdated. Users must verify all information directly with the source portal or the relevant real estate agency before making any decision."}
      </p>

      <h2>{isFr ? "Propriété intellectuelle" : "Intellectual Property"}</h2>
      <p>
        {isFr
          ? "Les annonces immobilières appartiennent à leurs portails et agences respectifs. olu.lu fournit uniquement des liens vers les annonces originales."
          : "Real estate listings belong to their respective portals and agencies. olu.lu only provides links to the original listings."}
      </p>

      <h2>{isFr ? "Limitation de responsabilité" : "Limitation of Liability"}</h2>
      <p>
        {isFr
          ? "olu.lu ne pourra être tenu responsable des dommages directs ou indirects résultant de l'utilisation du site, notamment en cas d'informations inexactes, d'indisponibilité du service, ou de décisions prises sur la base des informations affichées."
          : "olu.lu shall not be held liable for any direct or indirect damages resulting from the use of the site, including inaccurate information, service unavailability, or decisions made based on displayed information."}
      </p>

      <h2>{isFr ? "Droit applicable" : "Applicable Law"}</h2>
      <p>
        {isFr
          ? "Les présentes conditions sont régies par le droit luxembourgeois. Tout litige sera de la compétence exclusive des tribunaux du Grand-Duché de Luxembourg."
          : "These terms are governed by Luxembourg law. Any dispute shall fall under the exclusive jurisdiction of the courts of the Grand Duchy of Luxembourg."}
      </p>
    </LegalPage>
  );
}
