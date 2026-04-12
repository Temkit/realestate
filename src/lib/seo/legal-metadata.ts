/**
 * Metadata generators for legal pages.
 * Each page has unique title, description, canonical, hreflang.
 */

import type { Metadata } from "next";

const BASE = "https://olu.lu";

interface LegalMeta {
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  path: string; // e.g. "privacy"
}

const LEGAL_PAGES: Record<string, LegalMeta> = {
  about: {
    titleFr: "À propos d'olu.lu — Recherche immobilière IA au Luxembourg",
    titleEn: "About olu.lu — AI Real Estate Search for Luxembourg",
    descFr:
      "olu.lu agrège les annonces immobilières du Luxembourg avec une recherche IA. Découvrez comment nous aidons à trouver appartements, maisons et bureaux.",
    descEn:
      "olu.lu aggregates Luxembourg real estate listings with AI-powered search. Learn how we help find apartments, houses and offices across all major portals.",
    path: "about",
  },
  privacy: {
    titleFr: "Politique de confidentialité | olu.lu",
    titleEn: "Privacy Policy | olu.lu",
    descFr:
      "Politique de confidentialité d'olu.lu conforme RGPD et CNPD Luxembourg. Comment nous collectons, utilisons et protégeons vos données personnelles.",
    descEn:
      "olu.lu privacy policy compliant with GDPR and Luxembourg CNPD. How we collect, use and protect your personal data in our real estate search service.",
    path: "privacy",
  },
  terms: {
    titleFr: "Conditions d'utilisation | olu.lu",
    titleEn: "Terms of Service | olu.lu",
    descFr:
      "Conditions d'utilisation d'olu.lu. Service gratuit de recherche immobilière au Luxembourg. Limites de responsabilité et droits des utilisateurs.",
    descEn:
      "olu.lu terms of service. Free Luxembourg real estate search service. Limitations of liability and user rights explained clearly.",
    path: "terms",
  },
  cookies: {
    titleFr: "Politique des cookies et stockage | olu.lu",
    titleEn: "Cookie & Storage Policy | olu.lu",
    descFr:
      "Politique des cookies d'olu.lu. Aucun cookie publicitaire, aucun traceur tiers. Stockage local uniquement pour favoris et préférences.",
    descEn:
      "olu.lu cookie policy. No advertising cookies, no third-party trackers. Local storage only for favorites and user preferences.",
    path: "cookies",
  },
  "mentions-legales": {
    titleFr: "Mentions légales | olu.lu",
    titleEn: "Legal Notice | olu.lu",
    descFr:
      "Mentions légales d'olu.lu. Éditeur, hébergement, responsable du traitement. Informations légales conformes à la législation luxembourgeoise.",
    descEn:
      "olu.lu legal notice. Publisher, hosting, data controller details. Legal information compliant with Luxembourg regulations.",
    path: "mentions-legales",
  },
};

export function getLegalMetadata(page: keyof typeof LEGAL_PAGES, locale: string): Metadata {
  const meta = LEGAL_PAGES[page];
  if (!meta) return {};
  const title = locale === "fr" ? meta.titleFr : meta.titleEn;
  const description = locale === "fr" ? meta.descFr : meta.descEn;
  const canonical = `${BASE}/${locale}/${meta.path}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        fr: `${BASE}/fr/${meta.path}`,
        en: `${BASE}/en/${meta.path}`,
        "x-default": `${BASE}/fr/${meta.path}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "olu.lu",
      locale: locale === "fr" ? "fr_LU" : "en_US",
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    robots: { index: true, follow: true },
  };
}
