import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/marketplace/admin-auth";
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  cred: "Wrong password.",
  rate: "Too many attempts — try again in a minute.",
  config: "ADMIN_PASSWORD is not configured on the server.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8"
      >
        <h1 className="text-xl font-semibold">lëtz24 admin</h1>
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {ERRORS[error] ?? "Login failed."}
          </p>
        )}
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoFocus
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
