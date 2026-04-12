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
  themeColor: "#3b5bdb",
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

  const titles: Record<string, string> = {
    fr: "olu.lu — Recherche immobilière au Luxembourg",
    en: "olu.lu — Luxembourg Real Estate Search",
  };
  const descriptions: Record<string, string> = {
    fr: "Trouvez votre prochain logement au Luxembourg. Recherche IA sur athome.lu, immotop.lu, wortimmo.lu et vivi.lu.",
    en: "Find your next home in Luxembourg. AI-powered search across athome.lu, immotop.lu, wortimmo.lu and vivi.lu.",
  };

  const title = titles[locale] || titles.fr;
  const description = descriptions[locale] || descriptions.fr;
  const canonical = `https://olu.lu/${locale}`;

  return {
    metadataBase: new URL("https://olu.lu"),
    title,
    description,
    applicationName: "olu.lu",
    authors: [{ name: "olu.lu" }],
    keywords: [
      "Luxembourg",
      "immobilier",
      "real estate",
      "appartement",
      "maison",
      "bureau",
      "location",
      "vente",
      "athome",
      "immotop",
      "Kirchberg",
      "Mondorf",
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
      siteName: "olu.lu",
      url: canonical,
      locale: locale === "fr" ? "fr_LU" : "en_US",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "olu.lu — Luxembourg Real Estate Search",
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
        fr: "https://olu.lu/fr",
        en: "https://olu.lu/en",
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
        <NextIntlClientProvider messages={messages}>
          {children}
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
