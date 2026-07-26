import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "../globals.css";

export const metadata: Metadata = {
  title: "Espace pro — lux24",
  robots: { index: false, follow: false },
};

export default function PortalRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // /portal lives outside [locale] (like /admin) — renders its own html/body.
  return (
    <html lang="fr" className={GeistSans.className}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
