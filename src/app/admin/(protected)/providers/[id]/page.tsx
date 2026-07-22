import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBookingSettings,
  getProvider,
  getProviderCategoryIds,
  getProviderCoverage,
  listCategories,
  listVerticals,
} from "@/lib/marketplace/queries";
import { saveBookingSettingsAction } from "../../../actions";
import { ProviderForm } from "../provider-form";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

export default async function EditProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const providerId = Number(id);
  if (!Number.isInteger(providerId)) notFound();

  const [provider, verticals, categories, selectedCategoryIds, coverage, booking] =
    await Promise.all([
      getProvider(providerId),
      listVerticals(),
      listCategories(),
      getProviderCategoryIds(providerId),
      getProviderCoverage(providerId),
      getBookingSettings(providerId),
    ]);
  if (!provider) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{provider.name}</h1>
        <Link
          href={`/admin/providers/${provider.id}/offers`}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Offers →
        </Link>
      </div>

      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">
          Saved.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <ProviderForm
        provider={provider}
        verticals={verticals}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        coverage={coverage}
      />

      <section className="mt-12 border-t pt-8">
        <h2 className="mb-1 text-base font-semibold">Booking settings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          `request` = provider confirms each appointment by email (default, safe).
          `auto` = slot picker auto-confirms (premium, needs availability rules — P2).
        </p>
        <form
          action={saveBookingSettingsAction}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input type="hidden" name="provider_id" value={provider.id} />
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Mode</span>
            <select name="mode" defaultValue={booking?.mode ?? "request"} className={inputCls}>
              <option value="request">request</option>
              <option value="auto">auto</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Slot (min)</span>
            <input name="slot_minutes" type="number" defaultValue={booking?.slot_minutes ?? 60} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Buffer (min)</span>
            <input name="buffer_minutes" type="number" defaultValue={booking?.buffer_minutes ?? 0} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Min lead (h)</span>
            <input name="min_lead_hours" type="number" defaultValue={booking?.min_lead_hours ?? 24} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Horizon (days)</span>
            <input name="max_horizon_days" type="number" defaultValue={booking?.max_horizon_days ?? 60} className={inputCls} />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              Save booking settings
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
