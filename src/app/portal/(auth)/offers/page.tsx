import { requireProvider } from "@/lib/marketplace/provider-auth";
import {
  getProviderCategoryIds,
  listCategories,
  listOffers,
} from "@/lib/marketplace/queries";
import { cname } from "@/lib/marketplace/display";
import {
  createOfferPortalAction,
  toggleOfferPortalAction,
  updateOfferPortalAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

const PRICE_TYPES = [
  ["fixed", "Prix fixe"],
  ["from", "À partir de"],
  ["hourly", "Par heure"],
  ["quote", "Sur devis"],
] as const;

export default async function PortalOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const providerId = await requireProvider();
  const { saved, error } = await searchParams;
  const [offers, allCategories, categoryIds] = await Promise.all([
    listOffers(providerId),
    listCategories(),
    getProviderCategoryIds(providerId),
  ]);
  const categories = allCategories.filter((c) => categoryIds.includes(c.id) && c.active);
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Vos tarifs</h1>
      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Enregistré.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error === "category" ? "Ce service ne fait pas partie de votre profil." : "Formulaire invalide."}
        </p>
      )}

      <div className="mb-8 space-y-3">
        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de tarif.</p>
        ) : (
          offers.map((o) => (
            <form
              key={o.id}
              action={updateOfferPortalAction}
              className="rounded-2xl border bg-card p-4"
            >
              <input type="hidden" name="offer_id" value={o.id} />
              <div className="mb-2 text-xs text-muted-foreground">
                {categoryById.get(o.category_id) ? cname(categoryById.get(o.category_id)!, "fr") : o.category_id}
                {!o.active && <span className="ml-2 text-red-600">· inactif</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <input name="title_fr" defaultValue={o.title_fr} placeholder="Titre FR" required className={inputCls} />
                <input name="title_en" defaultValue={o.title_en} placeholder="Titre EN" required className={inputCls} />
                <select name="price_type" defaultValue={o.price_type} className={inputCls}>
                  {PRICE_TYPES.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
                <input
                  name="price_eur"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={o.price_cents != null ? (o.price_cents / 100).toString() : ""}
                  placeholder="€"
                  className={inputCls}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                  Enregistrer
                </button>
                <button
                  formAction={toggleOfferPortalAction}
                  name="active"
                  value={o.active ? "0" : "1"}
                  className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {o.active ? "Désactiver" : "Activer"}
                </button>
              </div>
            </form>
          ))
        )}
      </div>

      {categories.length > 0 && (
        <section className="rounded-2xl border p-5">
          <h2 className="mb-3 text-base font-semibold">Ajouter un tarif</h2>
          <form action={createOfferPortalAction} className="grid gap-2 sm:grid-cols-5">
            <select name="category_id" required className={inputCls}>
              <option value="">Service…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{cname(c, "fr")}</option>
              ))}
            </select>
            <input name="title_fr" placeholder="Titre FR" required className={inputCls} />
            <input name="title_en" placeholder="Titre EN" required className={inputCls} />
            <select name="price_type" defaultValue="from" className={inputCls}>
              {PRICE_TYPES.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <input name="price_eur" type="number" step="0.01" min="0" placeholder="€" className={inputCls} />
            <div className="sm:col-span-5">
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                Ajouter
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
