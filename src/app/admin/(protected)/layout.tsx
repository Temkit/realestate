import Link from "next/link";
import { requireAdmin } from "@/lib/marketplace/admin-auth";
import { countPendingReviews } from "@/lib/marketplace/reviews";
import { countPendingClaims } from "@/lib/marketplace/admin-queries";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  const [pendingReviews, pendingClaims] = await Promise.all([
    countPendingReviews().catch(() => 0),
    countPendingClaims().catch(() => 0),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/admin" className="font-semibold">
            lëtz24 admin
          </Link>
          <Link href="/admin/providers" className="text-muted-foreground hover:text-foreground">
            Providers
          </Link>
          <Link href="/admin/leads" className="text-muted-foreground hover:text-foreground">
            Leads
          </Link>
          <Link href="/admin/appointments" className="text-muted-foreground hover:text-foreground">
            Appointments
          </Link>
          <Link href="/admin/claims" className="text-muted-foreground hover:text-foreground">
            Claims
            {pendingClaims > 0 && (
              <span className="ml-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-600">
                {pendingClaims}
              </span>
            )}
          </Link>
          <Link href="/admin/reviews" className="text-muted-foreground hover:text-foreground">
            Reviews
            {pendingReviews > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600">
                {pendingReviews}
              </span>
            )}
          </Link>
          <Link href="/admin/stats" className="text-muted-foreground hover:text-foreground">
            Stats
          </Link>
          <Link href="/admin/config" className="text-muted-foreground hover:text-foreground">
            Config
          </Link>
        </nav>
        <form action={logoutAction}>
          <button className="text-sm text-muted-foreground hover:text-foreground">
            Log out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
