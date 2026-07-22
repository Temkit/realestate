import { NEARBY_COMMUNES } from "@/lib/communes";
import type { Category, Provider, Vertical } from "@/lib/marketplace/types";
import { saveProviderAction } from "../../actions";

const LANGUAGES = ["fr", "de", "lb", "en", "pt"] as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

export function ProviderForm({
  provider,
  verticals,
  categories,
  selectedCategoryIds,
  coverage,
}: {
  provider: Provider | null;
  verticals: Vertical[];
  categories: Category[];
  selectedCategoryIds: number[];
  coverage: string[];
}) {
  const p = provider;
  const communes = Object.keys(NEARBY_COMMUNES).sort();
  const coversAll = coverage.includes("*");

  return (
    <form action={saveProviderAction} className="space-y-8">
      {p && <input type="hidden" name="id" value={p.id} />}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name *">
          <input name="name" defaultValue={p?.name ?? ""} required className={inputCls} />
        </Field>
        <Field label="Slug * (URL, e.g. garage-muller-esch)">
          <input name="slug" defaultValue={p?.slug ?? ""} required className={inputCls} />
        </Field>
        <Field label="Email (lead delivery) *">
          <input name="email" type="email" defaultValue={p?.email ?? ""} required className={inputCls} />
        </Field>
        <Field label="VAT number">
          <input name="vat_number" defaultValue={p?.vat_number ?? ""} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={p?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="WhatsApp">
          <input name="whatsapp" defaultValue={p?.whatsapp ?? ""} className={inputCls} />
        </Field>
        <Field label="Website (https://…)">
          <input name="website" defaultValue={p?.website ?? ""} className={inputCls} />
        </Field>
        <Field label="Logo URL (https://…)">
          <input name="logo_url" defaultValue={p?.logo_url ?? ""} className={inputCls} />
        </Field>
        <Field label="Address">
          <input name="address" defaultValue={p?.address ?? ""} className={inputCls} />
        </Field>
        <Field label="Commune (seat)">
          <select name="commune" defaultValue={p?.commune ?? ""} className={inputCls}>
            <option value="">—</option>
            {communes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Description (FR)">
          <textarea name="description_fr" rows={3} defaultValue={p?.description_fr ?? ""} className={inputCls} />
        </Field>
        <Field label="Description (EN)">
          <textarea name="description_en" rows={3} defaultValue={p?.description_en ?? ""} className={inputCls} />
        </Field>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Languages spoken</h2>
        <div className="flex gap-4 text-sm">
          {LANGUAGES.map((l) => (
            <label key={l} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="languages"
                value={l}
                defaultChecked={p?.languages.includes(l) ?? l === "fr"}
              />
              {l.toUpperCase()}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {verticals.map((v) => (
            <div key={v.id} className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium">{v.name_en}</div>
              <div className="space-y-1 text-sm">
                {categories
                  .filter((c) => c.vertical_id === v.id && c.active)
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        name="category_ids"
                        value={c.id}
                        defaultChecked={selectedCategoryIds.includes(c.id)}
                      />
                      {c.name_fr}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Coverage area</h2>
        <label className="mb-2 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="coverage_all" defaultChecked={coversAll || coverage.length === 0} />
          All of Luxembourg
        </label>
        <p className="mb-1 text-xs text-muted-foreground">
          …or select communes (Cmd/Ctrl-click for multiple; ignored when “All” is checked):
        </p>
        <select name="coverage" multiple size={10} className={inputCls} defaultValue={coversAll ? [] : coverage}>
          {communes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Status">
          <select name="status" defaultValue={p?.status ?? "draft"} className={inputCls}>
            {["draft", "active", "paused", "churned"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Plan">
          <select name="plan" defaultValue={p?.plan ?? "free"} className={inputCls}>
            {["free", "starter", "pro"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="CPL € per lead (empty = free period)">
          <input
            name="cpl_eur"
            type="number"
            step="0.01"
            min="0"
            defaultValue={p?.cpl_cents != null ? (p.cpl_cents / 100).toString() : ""}
            className={inputCls}
          />
        </Field>
        <Field label="Signed on">
          <input name="signed_at" type="date" defaultValue={p?.signed_at ?? ""} className={inputCls} />
        </Field>
        <Field label="Sales rep">
          <input name="sales_rep" defaultValue={p?.sales_rep ?? ""} className={inputCls} />
        </Field>
      </section>

      <section>
        <Field label="Internal notes (never shown publicly)">
          <textarea name="notes" rows={3} defaultValue={p?.notes ?? ""} className={inputCls} />
        </Field>
      </section>

      <button
        type="submit"
        className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {p ? "Save changes" : "Create provider"}
      </button>
    </form>
  );
}
