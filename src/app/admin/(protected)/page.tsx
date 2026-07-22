import Link from "next/link";
import { getDashboardCounts } from "@/lib/marketplace/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let counts: Awaited<ReturnType<typeof getDashboardCounts>> | null = null;
  let dbError: string | null = null;
  try {
    counts = await getDashboardCounts();
  } catch (e) {
    dbError = e instanceof Error ? e.message : "database unavailable";
  }

  if (dbError) {
    return (
      <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
        Database not reachable: {dbError}. Run{" "}
        <code>npm run marketplace:migrate</code> and check TURSO env vars.
      </p>
    );
  }

  const tiles = [
    { label: "Providers", value: counts!.providers, href: "/admin/providers" },
    { label: "Active providers", value: counts!.activeProviders, href: "/admin/providers?status=active" },
    { label: "Active offers", value: counts!.offers, href: "/admin/providers" },
    { label: "Leads", value: counts!.leads, href: "/admin" },
  ];

  return (
    <div>
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
      <div className="mt-8">
        <Link
          href="/admin/providers/new"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + New provider
        </Link>
      </div>
    </div>
  );
}
