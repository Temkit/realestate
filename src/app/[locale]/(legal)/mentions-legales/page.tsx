"use client";

import { useLocale } from "next-intl";
import { LegalPage } from "@/components/legal-page";

export default function MentionsLegales() {
  const locale = useLocale();
  const isFr = locale === "fr";

  return (
    <LegalPage
      title={isFr ? "Mentions Légales" : "Legal Notice"}
      lastUpdated={isFr ? "Dernière mise à jour : avril 2026" : "Last updated: April 2026"}
    >
      <h2>{isFr ? "Éditeur du site" : "Site Publisher"}</h2>
      <p>
        <strong>olu.lu</strong><br />
        {isFr ? "Projet personnel" : "Personal project"}<br />
        {isFr ? "Responsable" : "Responsible person"}: [Nom à compléter]<br />
        {isFr ? "Contact" : "Contact"}: <a href="mailto:contact@olu.lu">contact@olu.lu</a>
      </p>

      <h2>{isFr ? "Hébergement" : "Hosting"}</h2>
      <p>
        Vercel Inc.<br />
        340 S Lemon Ave #4133<br />
        Walnut, CA 91789, USA<br />
        {isFr ? "Région de déploiement" : "Deployment region"}: Europe (EU)
      </p>

      <h2>{isFr ? "Droit applicable" : "Applicable Law"}</h2>
      <p>
        {isFr
          ? "Le présent site est soumis au droit luxembourgeois. Tout litige relatif à l'utilisation du site sera de la compétence des tribunaux du Grand-Duché de Luxembourg."
          : "This website is subject to Luxembourg law. Any dispute relating to the use of this website shall fall under the jurisdiction of the courts of the Grand Duchy of Luxembourg."}
      </p>

      <h2>{isFr ? "Nature du service" : "Nature of Service"}</h2>
      <p>
        {isFr
          ? "olu.lu est un agrégateur de recherche immobilière. Les annonces affichées proviennent de sources publiques (athome.lu, immotop.lu, wortimmo.lu, etc.). olu.lu n'est pas une agence immobilière et ne participe à aucune transaction."
          : "olu.lu is a real estate search aggregator. Listings displayed come from public sources (athome.lu, immotop.lu, wortimmo.lu, etc.). olu.lu is not a real estate agency and does not participate in any transaction."}
      </p>
    </LegalPage>
  );
}
