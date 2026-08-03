import Link from "next/link";
import { requireProvider } from "@/lib/marketplace/provider-auth";
import { getProviderDashboard } from "@/lib/marketplace/provider-queries";
import { getProvider } from "@/lib/marketplace/queries";
import { getRatingSummary } from "@/lib/marketplace/reviews";
import { StarRating } from "@/components/marketplace/star-rating";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const providerId = await requireProvider();
  const [stats, provider, rating] = await Promise.all([
    getProviderDashboard(providerId),
    getProvider(providerId),
    getRatingSummary(providerId),
  ]);

  const tiles = [
    { label: "Demandes reçues (total)", value: stats.totalLeads, href: "/portal/leads" },
    { label: "Nouvelles (7 jours)", value: stats.newLeads7d, href: "/portal/leads" },
    { label: "Rendez-vous à venir", value: stats.upcomingAppointments, href: "/portal/appointments" },
    { label: "Tarifs actifs", value: stats.activeOffers, href: "/portal/offers" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Bonjour {provider?.name} 👋</h1>
        {rating.avg != null && <StarRating value={rating.avg} count={rating.count} />}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded-2xl border bg-card p-5 hover:border-foreground/30"
          >
            <div className="text-3xl font-semibold">{t.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
          </Link>
        ))}
      </div>

      {provider && provider.plan === "free" && (
        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm">
          <p className="font-medium">Passez au plan Premium</p>
          <p className="mt-1 text-muted-foreground">
            Mise en avant dans les résultats, réservation automatique en ligne,
            et badge « vérifié ». Contactez votre conseiller lëtz24.
          </p>
        </div>
      )}
    </div>
  );
}
