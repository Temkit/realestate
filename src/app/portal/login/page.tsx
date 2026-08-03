import { redirect } from "next/navigation";
import { getSessionProviderId } from "@/lib/marketplace/provider-auth";
import { requestLoginLinkAction } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  expired: "Ce lien a expiré. Demandez-en un nouveau ci-dessous.",
  inactive: "Ce compte n'est pas actif. Contactez lëtz24.",
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (await getSessionProviderId()) redirect("/portal");
  const { sent, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8">
        <div>
          <h1 className="text-xl font-semibold">Espace pro lëtz24</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recevez un lien de connexion par email.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            {ERRORS[error] ?? "Une erreur est survenue."}
          </p>
        )}

        {sent ? (
          <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">
            Si un compte existe pour cette adresse, un lien de connexion vient
            d&apos;être envoyé. Vérifiez votre boîte mail.
          </p>
        ) : (
          <form action={requestLoginLinkAction} className="space-y-3">
            <input
              type="email"
              name="email"
              placeholder="Votre email professionnel"
              required
              autoFocus
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Envoyer le lien
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
