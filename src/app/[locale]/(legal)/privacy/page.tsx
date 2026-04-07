"use client";

import { useLocale } from "next-intl";
import { LegalPage } from "@/components/legal-page";

export default function PrivacyPolicy() {
  const locale = useLocale();
  const isFr = locale === "fr";

  return (
    <LegalPage
      title={isFr ? "Politique de Confidentialité" : "Privacy Policy"}
      lastUpdated={isFr ? "Dernière mise à jour : avril 2026" : "Last updated: April 2026"}
    >
      <h2>{isFr ? "Responsable du traitement" : "Data Controller"}</h2>
      <p>
        olu.lu — <a href="mailto:contact@olu.lu">contact@olu.lu</a>
      </p>

      <h2>{isFr ? "Données collectées" : "Data Collected"}</h2>
      <p>{isFr ? "olu.lu collecte et traite les données suivantes :" : "olu.lu collects and processes the following data:"}</p>
      <ul>
        <li><strong>{isFr ? "Requêtes de recherche" : "Search queries"}</strong> — {isFr ? "envoyées à l'API Perplexity pour traitement. Non stockées sur nos serveurs." : "sent to the Perplexity API for processing. Not stored on our servers."}</li>
        <li><strong>{isFr ? "Stockage local (localStorage)" : "Local storage (localStorage)"}</strong> — {isFr ? "favoris, préférences de recherche, historique des recherches récentes. Stocké uniquement dans votre navigateur." : "favorites, search preferences, recent search history. Stored only in your browser."}</li>
        <li><strong>{isFr ? "Cookie de consentement" : "Consent cookie"}</strong> — {isFr ? "enregistre vos choix de consentement. Durée : 1 an." : "records your consent choices. Duration: 1 year."}</li>
        <li><strong>{isFr ? "Adresse IP" : "IP address"}</strong> — {isFr ? "utilisée pour la limitation de débit (protection contre les abus). Non stockée." : "used for rate limiting (abuse protection). Not stored."}</li>
      </ul>

      <h2>{isFr ? "Base légale" : "Legal Basis"}</h2>
      <ul>
        <li><strong>{isFr ? "Consentement" : "Consent"}</strong> — {isFr ? "pour le stockage fonctionnel (favoris, préférences, historique)" : "for functional storage (favorites, preferences, history)"}</li>
        <li><strong>{isFr ? "Intérêt légitime" : "Legitimate interest"}</strong> — {isFr ? "pour le stockage nécessaire (thème d'affichage) et la limitation de débit" : "for necessary storage (display theme) and rate limiting"}</li>
      </ul>

      <h2>{isFr ? "Sous-traitants" : "Third-Party Processors"}</h2>
      <ul>
        <li><strong>Perplexity AI</strong> — {isFr ? "API de recherche (États-Unis). Les requêtes de recherche sont envoyées pour traitement." : "Search API (United States). Search queries are sent for processing."}</li>
        <li><strong>Vercel Inc.</strong> — {isFr ? "Hébergement (région Europe)." : "Hosting (Europe region)."}</li>
      </ul>

      <h2>{isFr ? "Transferts internationaux" : "International Transfers"}</h2>
      <p>
        {isFr
          ? "Les requêtes de recherche sont transmises à Perplexity AI (États-Unis) dans le cadre de clauses contractuelles types."
          : "Search queries are transmitted to Perplexity AI (United States) under standard contractual clauses."}
      </p>

      <h2>{isFr ? "Durée de conservation" : "Data Retention"}</h2>
      <ul>
        <li>{isFr ? "Stockage local : jusqu'à ce que l'utilisateur efface les données de son navigateur" : "Local storage: until the user clears their browser data"}</li>
        <li>{isFr ? "Cookie de consentement : 1 an" : "Consent cookie: 1 year"}</li>
        <li>{isFr ? "Requêtes de recherche : non conservées" : "Search queries: not retained"}</li>
      </ul>

      <h2>{isFr ? "Vos droits" : "Your Rights"}</h2>
      <p>
        {isFr
          ? "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression, de portabilité et d'opposition. Pour exercer ces droits, contactez-nous à"
          : "Under the GDPR, you have the right to access, rectify, delete, port, and object to your data. To exercise these rights, contact us at"}{" "}
        <a href="mailto:contact@olu.lu">contact@olu.lu</a>.
      </p>

      <h2>{isFr ? "Autorité de contrôle" : "Supervisory Authority"}</h2>
      <p>
        Commission Nationale pour la Protection des Données (CNPD)<br />
        15, Boulevard du Jazz, L-4370 Belvaux<br />
        <a href="https://cnpd.public.lu">cnpd.public.lu</a>
      </p>
    </LegalPage>
  );
}
