"use client";

import { useLocale } from "next-intl";
import { LegalPage } from "@/components/legal-page";

export default function CookiePolicy() {
  const locale = useLocale();
  const isFr = locale === "fr";

  return (
    <LegalPage
      title={isFr ? "Politique de Cookies et Stockage" : "Cookie & Storage Policy"}
      lastUpdated={isFr ? "Dernière mise à jour : avril 2026" : "Last updated: April 2026"}
    >
      <h2>{isFr ? "Qu'utilisons-nous ?" : "What do we use?"}</h2>
      <p>
        {isFr
          ? "olu.lu utilise le stockage local de votre navigateur (localStorage) et un cookie pour fonctionner. Nous n'utilisons aucun cookie de suivi ou publicitaire."
          : "olu.lu uses your browser's local storage (localStorage) and one cookie to operate. We do not use any tracking or advertising cookies."}
      </p>

      <h2>{isFr ? "Détail du stockage" : "Storage Details"}</h2>
      <table>
        <thead>
          <tr>
            <th>{isFr ? "Nom" : "Name"}</th>
            <th>{isFr ? "Type" : "Type"}</th>
            <th>{isFr ? "Catégorie" : "Category"}</th>
            <th>{isFr ? "Description" : "Description"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>olu-consent</td>
            <td>Cookie</td>
            <td>{isFr ? "Nécessaire" : "Necessary"}</td>
            <td>{isFr ? "Enregistre vos choix de consentement. Durée : 1 an." : "Records your consent choices. Duration: 1 year."}</td>
          </tr>
          <tr>
            <td>theme</td>
            <td>localStorage</td>
            <td>{isFr ? "Nécessaire" : "Necessary"}</td>
            <td>{isFr ? "Votre préférence de thème (clair/sombre)." : "Your theme preference (light/dark)."}</td>
          </tr>
          <tr>
            <td>olu-favorites</td>
            <td>localStorage</td>
            <td>{isFr ? "Fonctionnel" : "Functional"}</td>
            <td>{isFr ? "Vos biens sauvegardés." : "Your saved properties."}</td>
          </tr>
          <tr>
            <td>olu-user-preferences</td>
            <td>localStorage</td>
            <td>{isFr ? "Fonctionnel" : "Functional"}</td>
            <td>{isFr ? "Préférences de recherche apprises." : "Learned search preferences."}</td>
          </tr>
          <tr>
            <td>olu-recent-searches</td>
            <td>localStorage</td>
            <td>{isFr ? "Fonctionnel" : "Functional"}</td>
            <td>{isFr ? "Vos 5 dernières recherches." : "Your 5 most recent searches."}</td>
          </tr>
        </tbody>
      </table>

      <h2>{isFr ? "Gérer vos préférences" : "Manage Your Preferences"}</h2>
      <p>
        {isFr
          ? "Vous pouvez modifier vos choix à tout moment en supprimant le cookie « olu-consent » dans les paramètres de votre navigateur. La bannière de consentement réapparaîtra lors de votre prochaine visite."
          : "You can change your choices at any time by deleting the \"olu-consent\" cookie in your browser settings. The consent banner will reappear on your next visit."}
      </p>
      <p>
        {isFr
          ? "Vous pouvez également supprimer toutes les données locales en effaçant les données du site dans les paramètres de votre navigateur."
          : "You can also delete all local data by clearing site data in your browser settings."}
      </p>
    </LegalPage>
  );
}
