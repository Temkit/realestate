import { listCategories, listVerticals } from "@/lib/marketplace/queries";
import {
  createCategoryAction,
  createVerticalAction,
  toggleCategoryAction,
  toggleVerticalAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary";

function ToggleButton({
  id,
  flag,
  value,
  labelOn,
  labelOff,
}: {
  id: number;
  flag: "active" | "booking_enabled";
  value: boolean;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <form action={toggleVerticalAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={value ? "0" : "1"} />
      <button
        className={`rounded-full px-2 py-0.5 text-xs ${
          value ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"
        }`}
      >
        {value ? labelOn : labelOff}
      </button>
    </form>
  );
}

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const [verticals, categories] = await Promise.all([
    listVerticals(),
    listCategories(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Verticals & categories</h1>

      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Saved.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-6">
        {verticals.map((v) => (
          <section key={v.id} className="rounded-2xl border p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold">
                {v.name_en} <span className="text-sm font-normal text-muted-foreground">/{v.slug}</span>
              </h2>
              <ToggleButton id={v.id} flag="active" value={v.active} labelOn="active" labelOff="inactive" />
              <ToggleButton
                id={v.id}
                flag="booking_enabled"
                value={v.booking_enabled}
                labelOn="booking on"
                labelOff="booking off"
              />
            </div>

            <ul className="mb-4 flex flex-wrap gap-2">
              {categories
                .filter((c) => c.vertical_id === v.id)
                .map((c) => (
                  <li key={c.id}>
                    <form action={toggleCategoryAction} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                      <button
                        title={c.active ? "Click to deactivate" : "Click to activate"}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          c.active ? "" : "line-through opacity-50"
                        }`}
                      >
                        {c.name_fr} <span className="text-xs text-muted-foreground">/{c.slug}</span>
                      </button>
                    </form>
                  </li>
                ))}
            </ul>

            <form action={createCategoryAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="vertical_id" value={v.id} />
              <input name="slug" placeholder="slug" required className={inputCls} />
              <input name="name_fr" placeholder="Nom FR" required className={inputCls} />
              <input name="name_en" placeholder="Name EN" required className={inputCls} />
              <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                + Add category
              </button>
            </form>

            {v.attribute_schema.fields && v.attribute_schema.fields.length > 0 && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Offer attribute schema</summary>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/50 p-2">
                  {JSON.stringify(v.attribute_schema, null, 2)}
                </pre>
              </details>
            )}
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border p-5">
        <h2 className="mb-3 text-base font-semibold">New vertical</h2>
        <form action={createVerticalAction} className="flex flex-wrap items-end gap-2">
          <input name="slug" placeholder="slug (URL segment)" required className={inputCls} />
          <input name="name_fr" placeholder="Nom FR" required className={inputCls} />
          <input name="name_en" placeholder="Name EN" required className={inputCls} />
          <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
            + Add vertical
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Reserved slugs (route conflicts): buy, rent, acheter, louer, admin, api, pro, immo, fr, en.
          New verticals start inactive with booking off.
        </p>
      </section>
    </div>
  );
}
