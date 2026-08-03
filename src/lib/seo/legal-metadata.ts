/**
 * Metadata generators for legal pages.
 * Each page has unique title, description, canonical, hreflang.
 */

import type { Metadata } from "next";

const BASE = "https://letz24.lu";

interface LegalMeta {
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  path: string; // e.g. "privacy"
}

const LEGAL_PAGES: Record<string, LegalMeta> = {
  about: {
    titleFr: "À propos d'letz24.lu — Recherche immobilière IA au Luxembourg",
    titleEn: "About letz24.lu — AI Real Estate Search for Luxembourg",
    descFr:
      "letz24.lu agrège les annonces immobilières du Luxembourg avec une recherche IA. Découvrez comment nous aidons à trouver appartements, maisons et bureaux.",
    descEn:
      "letz24.lu aggregates Luxembourg real estate listings with AI-powered search. Learn how we help find apartments, houses and offices across all major portals.",
    path: "about",
  },
  privacy: {
    titleFr: "Politique de confidentialité | letz24.lu",
    titleEn: "Privacy Policy | letz24.lu",
    descFr:
      "Politique de confidentialité d'letz24.lu conforme RGPD et CNPD Luxembourg. Comment nous collectons, utilisons et protégeons vos données personnelles.",
    descEn:
      "letz24.lu privacy policy compliant with GDPR and Luxembourg CNPD. How we collect, use and protect your personal data in our real estate search service.",
    path: "privacy",
  },
  terms: {
    titleFr: "Conditions d'utilisation | letz24.lu",
    titleEn: "Terms of Service | letz24.lu",
    descFr:
      "Conditions d'utilisation d'letz24.lu. Service gratuit de recherche immobilière au Luxembourg. Limites de responsabilité et droits des utilisateurs.",
    descEn:
      "letz24.lu terms of service. Free Luxembourg real estate search service. Limitations of liability and user rights explained clearly.",
    path: "terms",
  },
  cookies: {
    titleFr: "Politique des cookies et stockage | letz24.lu",
    titleEn: "Cookie & Storage Policy | letz24.lu",
    descFr:
      "Politique des cookies d'letz24.lu. Aucun cookie publicitaire, aucun traceur tiers. Stockage local uniquement pour favoris et préférences.",
    descEn:
      "letz24.lu cookie policy. No advertising cookies, no third-party trackers. Local storage only for favorites and user preferences.",
    path: "cookies",
  },
  "mentions-legales": {
    titleFr: "Mentions légales | letz24.lu",
    titleEn: "Legal Notice | letz24.lu",
    descFr:
      "Mentions légales d'letz24.lu. Éditeur, hébergement, responsable du traitement. Informations légales conformes à la législation luxembourgeoise.",
    descEn:
      "letz24.lu legal notice. Publisher, hosting, data controller details. Legal information compliant with Luxembourg regulations.",
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
      siteName: "letz24.lu",
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
