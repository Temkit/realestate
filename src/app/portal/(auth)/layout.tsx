import Link from "next/link";
import { requireProvider } from "@/lib/marketplace/provider-auth";
import { getProvider } from "@/lib/marketplace/queries";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/portal", label: "Tableau de bord" },
  { href: "/portal/leads", label: "Demandes" },
  { href: "/portal/appointments", label: "Rendez-vous" },
  { href: "/portal/offers", label: "Tarifs" },
  { href: "/portal/availability", label: "Disponibilités" },
  { href: "/portal/profile", label: "Profil" },
];

export default async function PortalAuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const providerId = await requireProvider();
  const provider = await getProvider(providerId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-8 border-b pb-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">
            {provider?.name ?? "Espace pro"}{" "}
            <span className="font-normal text-muted-foreground">· lux24</span>
          </span>
          <form action={logoutAction}>
            <button className="text-sm text-muted-foreground hover:text-foreground">
              Se déconnecter
            </button>
          </form>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
