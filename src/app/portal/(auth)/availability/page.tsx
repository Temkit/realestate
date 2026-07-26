import { requireProvider } from "@/lib/marketplace/provider-auth";
import { getBookingSettings } from "@/lib/marketplace/queries";
import {
  listAvailabilityExceptions,
  listAvailabilityRules,
} from "@/lib/marketplace/admin-queries";
import {
  addExceptionPortalAction,
  addRulePortalAction,
  deleteExceptionPortalAction,
  deleteRulePortalAction,
  saveBookingModeAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";
const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default async function PortalAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const providerId = await requireProvider();
  const { saved, error } = await searchParams;
  const [booking, rules, exceptions] = await Promise.all([
    getBookingSettings(providerId),
    listAvailabilityRules(providerId),
    listAvailabilityExceptions(providerId),
  ]);
  const mode = booking?.mode ?? "request";

  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold">Disponibilités & réservation</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        En mode <strong>demande</strong>, vous confirmez chaque rendez-vous par email.
        En mode <strong>automatique</strong>, les clients réservent directement un créneau
        libre (nécessite des horaires ci-dessous).
      </p>
      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Enregistré.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">Formulaire invalide.</p>
      )}

      <section className="mb-8 rounded-2xl border p-5">
        <h2 className="mb-3 text-base font-semibold">Mode de réservation</h2>
        <form action={saveBookingModeAction} className="grid gap-3 sm:grid-cols-5">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Mode</span>
            <select name="mode" defaultValue={mode} className={inputCls + " w-full"}>
              <option value="request">Demande (je confirme)</option>
              <option value="auto">Automatique</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Durée créneau (min)</span>
            <input name="slot_minutes" type="number" defaultValue={booking?.slot_minutes ?? 60} className={inputCls + " w-full"} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Pause entre RDV (min)</span>
            <input name="buffer_minutes" type="number" defaultValue={booking?.buffer_minutes ?? 0} className={inputCls + " w-full"} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Délai mini (h)</span>
            <input name="min_lead_hours" type="number" defaultValue={booking?.min_lead_hours ?? 24} className={inputCls + " w-full"} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Horizon (jours)</span>
            <input name="max_horizon_days" type="number" defaultValue={booking?.max_horizon_days ?? 60} className={inputCls + " w-full"} />
          </label>
          <div className="sm:col-span-5">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Enregistrer le mode
            </button>
          </div>
        </form>
        {mode === "auto" && rules.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            Ajoutez au moins un horaire ci-dessous pour activer la réservation automatique.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-base font-semibold">Horaires d&apos;ouverture</h2>
          {rules.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">Aucun horaire.</p>
          ) : (
            <ul className="mb-3 space-y-1">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm">
                  <span>{WEEKDAYS[r.weekday]} {r.open_time}–{r.close_time}</span>
                  <form action={deleteRulePortalAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-red-600 hover:underline">supprimer</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addRulePortalAction} className="flex flex-wrap items-end gap-2">
            <select name="weekday" className={inputCls}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <input name="open_time" type="time" defaultValue="09:00" required className={inputCls} />
            <input name="close_time" type="time" defaultValue="17:00" required className={inputCls} />
            <button className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Ajouter</button>
          </form>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Jours de fermeture</h2>
          {exceptions.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">Aucun à venir.</p>
          ) : (
            <ul className="mb-3 space-y-1">
              {exceptions.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm">
                  <span>{e.date}</span>
                  <form action={deleteExceptionPortalAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="text-xs text-red-600 hover:underline">supprimer</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addExceptionPortalAction} className="flex items-end gap-2">
            <input name="date" type="date" required className={inputCls} />
            <button className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Fermer ce jour</button>
          </form>
        </section>
      </div>
    </div>
  );
}
