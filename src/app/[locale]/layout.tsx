import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { routing } from "@/i18n/routing";
import { ConsentBanner } from "@/components/consent-banner";
import type { Metadata, Viewport } from "next";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export const viewport: Viewport = {
  themeColor: "#1554e8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://letz24.lu";

  const titles: Record<string, string> = {
    fr: "lëtz24 — Tous vos services au Luxembourg",
    en: "lëtz24 — Every service in Luxembourg",
  };
  const descriptions: Record<string, string> = {
    fr: "Comparez et réservez tous les services au Luxembourg : garages, artisans, coiffeurs, déménagement, beauté et immobilier. Devis gratuits, rendez-vous en ligne.",
    en: "Compare and book every service in Luxembourg: garages, tradespeople, hairdressers, moving, beauty and real estate. Free quotes, online booking.",
  };

  const title = titles[locale] || titles.fr;
  const description = descriptions[locale] || descriptions.fr;
  const canonical = `${base}/${locale}`;

  return {
    metadataBase: new URL(base),
    title,
    description,
    applicationName: "lëtz24",
    authors: [{ name: "lëtz24" }],
    keywords: [
      "Luxembourg",
      "services",
      "devis",
      "garage",
      "artisan",
      "plombier",
      "coiffeur",
      "déménagement",
      "nettoyage",
      "rendez-vous",
      "immobilier",
      "check24",
    ],
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
    },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: "lëtz24",
      url: canonical,
      locale: locale === "fr" ? "fr_LU" : "en_US",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "lëtz24 — services au Luxembourg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    alternates: {
      canonical,
      languages: {
        fr: `${base}/fr`,
        en: `${base}/en`,
        "x-default": `${base}/fr`,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://letz24.lu";

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"){document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}})()`,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
        >
          Skip to content
        </a>
        {/* Organization + WebSite schema (site-wide) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}/#organization`,
                  name: "lëtz24",
                  url: siteUrl,
                  logo: {
                    "@type": "ImageObject",
                    url: `${siteUrl}/icon-512.png`,
                    width: 512,
                    height: 512,
                  },
                  description:
                    "Compare and book every service in Luxembourg — garages, tradespeople, hairdressers, moving, beauty and real estate.",
                  email: "contact@letz24.lu",
                  address: {
                    "@type": "PostalAddress",
                    addressCountry: "LU",
                    addressLocality: "Luxembourg",
                  },
                  areaServed: {
                    "@type": "Country",
                    name: "Luxembourg",
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl}/#website`,
                  url: siteUrl,
                  name: "lëtz24",
                  description:
                    "Marketplace to compare and book services in Luxembourg.",
                  publisher: { "@id": `${siteUrl}/#organization` },
                  inLanguage: [locale === "fr" ? "fr-LU" : "en-US"],
                },
              ],
            }),
          }}
        />
        <NextIntlClientProvider messages={messages}>
          {children}
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
