import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  getAppointmentByToken,
  getAppointmentContext,
} from "@/lib/marketplace/leads";
import { cancelAppointmentAction } from "@/lib/marketplace/public-actions";
import { getMarketplaceDb } from "@/lib/marketplace/db";

export const metadata: Metadata = {
  title: "Rendez-vous | lux24",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, [string, string]> = {
  requested: ["En attente de confirmation du prestataire", "Awaiting provider confirmation"],
  confirmed: ["Confirmé", "Confirmed"],
  declined: ["Refusé par le prestataire", "Declined by the provider"],
  cancelled_user: ["Annulé (par vous)", "Cancelled (by you)"],
  cancelled_provider: ["Annulé par le prestataire", "Cancelled by the provider"],
  completed: ["Terminé", "Completed"],
  no_show: ["Non honoré", "No-show"],
};

/** User-side appointment management (from the confirmation email). */
export default async function AppointmentManagePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  await connection();
  const { locale, token } = await params;
  if (!getMarketplaceDb()) notFound();

  const appt = await getAppointmentByToken("manage", token);
  if (!appt) notFound();
  const ctx = await getAppointmentContext(appt);
  if (!ctx) notFound();

  const fr = locale !== "en";
  const [frLabel, enLabel] = STATUS_LABELS[appt.status] ?? [appt.status, appt.status];
  const cancellable = appt.status === "requested" || appt.status === "confirmed";

  const when = appt.starts_at
    ? new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Luxembourg",
      }).format(new Date(appt.starts_at))
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="mb-4 text-xl font-semibold">
          {fr ? "Votre rendez-vous" : "Your appointment"}
        </h1>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{fr ? "Prestataire" : "Provider"}</dt>
            <dd className="font-medium">{ctx.providerName}</dd>
          </div>
          {when && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{fr ? "Date" : "Date"}</dt>
              <dd className="text-right font-medium">{when}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{fr ? "Statut" : "Status"}</dt>
            <dd className="font-medium">{fr ? frLabel : enLabel}</dd>
          </div>
        </dl>

        {cancellable && (
          <form action={cancelAppointmentAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="locale" value={locale} />
            <button className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-500/10">
              {fr ? "Annuler le rendez-vous" : "Cancel the appointment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
