import { requireProvider } from "@/lib/marketplace/provider-auth";
import { listProviderAppointments } from "@/lib/marketplace/provider-queries";
import type { BookingWindow } from "@/lib/marketplace/types";
import {
  confirmAppointmentPortalAction,
  setAppointmentStatusPortalAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  requested: "À confirmer",
  confirmed: "Confirmé",
  declined: "Refusé",
  cancelled_user: "Annulé (client)",
  cancelled_provider: "Annulé (vous)",
  completed: "Terminé",
  no_show: "Absence",
};
const STATUS_COLORS: Record<string, string> = {
  requested: "bg-blue-500/10 text-blue-600",
  confirmed: "bg-green-500/10 text-green-600",
  completed: "bg-emerald-500/10 text-emerald-700",
  no_show: "bg-red-500/10 text-red-600",
  cancelled_user: "bg-gray-500/10 text-gray-500",
  cancelled_provider: "bg-amber-500/10 text-amber-600",
  declined: "bg-gray-500/10 text-gray-500",
};

const PERIOD_FR: Record<string, string> = { morning: "matin", afternoon: "après-midi" };

function parseWindows(answers: string): BookingWindow[] {
  try {
    const a = JSON.parse(answers);
    return Array.isArray(a.windows) ? a.windows : [];
  } catch {
    return [];
  }
}

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Luxembourg",
  }).format(new Date(iso));
}

export default async function PortalAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const providerId = await requireProvider();
  const { saved, error } = await searchParams;
  const appointments = await listProviderAppointments(providerId);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Rendez-vous</h1>
      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Mis à jour.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          Action impossible sur ce rendez-vous.
        </p>
      )}

      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de rendez-vous.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => {
            const windows = parseWindows(a.answers);
            return (
              <div key={a.id} className="rounded-2xl border bg-card p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{a.user_name ?? "Client"}</span>
                    {a.category_name && (
                      <span className="ml-2 text-sm text-muted-foreground">· {a.category_name}</span>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[a.status] ?? ""}`}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {a.user_email && (
                    <a href={`mailto:${a.user_email}`} className="text-primary hover:underline">
                      {a.user_email}
                    </a>
                  )}
                  {a.user_phone && (
                    <a href={`tel:${a.user_phone}`} className="text-primary hover:underline">
                      {a.user_phone}
                    </a>
                  )}
                </div>

                {a.starts_at && (
                  <p className="mb-3 text-sm font-medium">{fmt(a.starts_at)}</p>
                )}

                {a.status === "requested" && (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      Créneaux souhaités — confirmez-en un :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {windows.map((w, i) => (
                        <form key={i} action={confirmAppointmentPortalAction}>
                          <input type="hidden" name="appointment_id" value={a.id} />
                          <input type="hidden" name="window" value={i} />
                          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                            Confirmer {w.date} {PERIOD_FR[w.period] ?? w.period}
                          </button>
                        </form>
                      ))}
                      <form action={setAppointmentStatusPortalAction}>
                        <input type="hidden" name="appointment_id" value={a.id} />
                        <input type="hidden" name="status" value="declined" />
                        <button className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                          Refuser
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {a.status === "confirmed" && (
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["completed", "Terminé"],
                        ["no_show", "Absence"],
                        ["cancelled_provider", "Annuler"],
                      ] as const
                    ).map(([s, label]) => (
                      <form key={s} action={setAppointmentStatusPortalAction}>
                        <input type="hidden" name="appointment_id" value={a.id} />
                        <input type="hidden" name="status" value={s} />
                        <button className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                          {label}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
