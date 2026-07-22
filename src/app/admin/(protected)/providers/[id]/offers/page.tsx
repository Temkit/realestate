import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProvider,
  getProviderCategoryIds,
  listCategories,
  listOffers,
  listVerticals,
} from "@/lib/marketplace/queries";
import type { AttributeField } from "@/lib/marketplace/types";
import { createOfferAction, toggleOfferAction } from "../../../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

function formatPrice(priceType: string, cents: number | null): string {
  if (priceType === "quote" || cents === null) return "on quote";
  const eur = `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  if (priceType === "from") return `from ${eur}`;
  if (priceType === "hourly") return `${eur}/h`;
  return eur;
}

export default async function ProviderOffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; cat?: string }>;
}) {
  const { id } = await params;
  const { error, saved, cat } = await searchParams;
  const providerId = Number(id);
  if (!Number.isInteger(providerId)) notFound();

  const [provider, offers, categories, verticals, providerCategoryIds] =
    await Promise.all([
      getProvider(providerId),
      listOffers(providerId),
      listCategories(),
      listVerticals(),
      getProviderCategoryIds(providerId),
    ]);
  if (!provider) notFound();

  const providerCategories = categories.filter((c) =>
    providerCategoryIds.includes(c.id)
  );
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Offer creation is category-first (?cat=): the category fixes the vertical,
  // whose attribute_schema decides which extra fields the form shows.
  const selectedCat = cat ? categoryById.get(Number(cat)) : undefined;
  const selectedVertical = selectedCat
    ? verticals.find((v) => v.id === selectedCat.vertical_id)
    : undefined;
  const attributeFields: AttributeField[] =
    selectedVertical?.attribute_schema.fields ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Offers — {provider.name} ({offers.length})
        </h1>
        <Link
          href={`/admin/providers/${provider.id}`}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          ← Provider
        </Link>
      </div>

      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Saved.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {offers.length > 0 && (
        <div className="mb-8 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Title (FR)</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Attributes</th>
                <th className="px-4 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{o.title_fr}</td>
                  <td className="px-4 py-2">{categoryById.get(o.category_id)?.name_fr ?? o.category_id}</td>
                  <td className="px-4 py-2">{formatPrice(o.price_type, o.price_cents)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {Object.entries(o.attributes)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <form action={toggleOfferAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="provider_id" value={provider.id} />
                      <input type="hidden" name="active" value={o.active ? "0" : "1"} />
                      <button
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          o.active
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-500/10 text-gray-500"
                        }`}
                      >
                        {o.active ? "active" : "inactive"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded-2xl border p-5">
        <h2 className="mb-3 text-base font-semibold">Add offer</h2>
        {providerCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Assign categories to this provider first.
          </p>
        ) : !selectedCat ? (
          <div className="flex flex-wrap gap-2">
            {providerCategories.map((c) => (
              <Link
                key={c.id}
                href={`/admin/providers/${provider.id}/offers?cat=${c.id}`}
                className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
              >
                + {c.name_fr}
              </Link>
            ))}
          </div>
        ) : (
          <form action={createOfferAction} className="space-y-4">
            <input type="hidden" name="provider_id" value={provider.id} />
            <input type="hidden" name="category_id" value={selectedCat.id} />
            <input
              type="hidden"
              name="attribute_fields"
              value={JSON.stringify(attributeFields)}
            />
            <p className="text-sm">
              Category: <strong>{selectedCat.name_fr}</strong>{" "}
              <Link
                href={`/admin/providers/${provider.id}/offers`}
                className="text-muted-foreground hover:underline"
              >
                (change)
              </Link>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Title (FR) *</span>
                <input name="title_fr" required className={inputCls} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Title (EN) *</span>
                <input name="title_en" required className={inputCls} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Price type</span>
                <select name="price_type" defaultValue="from" className={inputCls}>
                  <option value="fixed">fixed</option>
                  <option value="from">from</option>
                  <option value="hourly">hourly</option>
                  <option value="quote">on quote</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Price € (empty for on-quote)</span>
                <input name="price_eur" type="number" step="0.01" min="0" className={inputCls} />
              </label>
            </div>
            {attributeFields.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {attributeFields.map((f) => (
                  <label key={f.key} className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">{f.label}</span>
                    {f.type === "boolean" ? (
                      <input type="checkbox" name={`attr_${f.key}`} className="h-4 w-4" />
                    ) : f.type === "select" ? (
                      <select name={`attr_${f.key}`} className={inputCls} defaultValue="">
                        <option value="">—</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={`attr_${f.key}`}
                        type={f.type === "number" ? "number" : "text"}
                        className={inputCls}
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Create offer
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
