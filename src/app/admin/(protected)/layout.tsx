import Link from "next/link";
import { requireAdmin } from "@/lib/marketplace/admin-auth";
import { logoutAction } from "../actions";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/admin" className="font-semibold">
            lux24 admin
          </Link>
          <Link href="/admin/providers" className="text-muted-foreground hover:text-foreground">
            Providers
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
