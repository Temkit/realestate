import Link from "next/link";
import { Home } from "lucide-react";
import type { Metadata } from "next";
import { LogoIcon } from "@/components/marketplace/logo";

export const metadata: Metadata = {
  title: "Page not found | lëtz24",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <LogoIcon className="h-14 w-14 mx-auto mb-6 drop-shadow-lg" />
        <h1 className="text-5xl font-bold tracking-tight mb-3">404</h1>
        <p className="text-lg font-semibold mb-2">Page introuvable</p>
        <p className="text-muted-foreground text-sm mb-8">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
