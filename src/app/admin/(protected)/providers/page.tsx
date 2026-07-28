import Link from "next/link";
import { listProviders, listVerticals } from "@/lib/marketplace/queries";
import { countDrafts } from "@/lib/marketplace/admin-queries";
import { publishDraftsAction } from "../../actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-600",
  listed: "bg-sky-500/10 text-sky-600",
  active: "bg-green-500/10 text-green-600",
  paused: "bg-amber-500/10 text-amber-600",
  churned: "bg-red-500/10 text-red-600",
};

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vertical?: string; published?: string }>;
}) {
  const { status, vertical, published } = await searchParams;
  const verticals = await listVerticals();
  const verticalId = vertical ? Number(vertical) : undefined;
  const [providers, draftCount] = await Promise.all([
    listProviders({ status, verticalId }),
    countDrafts(),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Providers ({providers.length})</h1>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <form action={publishDraftsAction}>
              <button className="rounded-lg border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-500/10">
                Publish {draftCount} drafts as listed
              </button>
            </form>
          )}
          <Link
            href="/admin/providers/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + New provider
          </Link>
        </div>
      </div>

      {published && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">
          Published {published} providers as public listings.
        </p>
      )}

      <form method="GET" className="mb-4 flex flex-wrap gap-2 text-sm">
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border bg-background px-2 py-1.5">
          <option value="">All statuses</option>
          {["draft", "listed", "active", "paused", "churned"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="vertical" defaultValue={vertical ?? ""} className="rounded-lg border bg-background px-2 py-1.5">
          <option value="">All verticals</option>
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>{v.name_en}</option>
          ))}
        </select>
        <button className="rounded-lg border px-3 py-1.5 hover:bg-muted">Filter</button>
      </form>

      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No providers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Commune</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">CPL</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/admin/providers/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
                  </td>
                  <td className="px-4 py-2">{p.commune ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-muted-foreground">{p.source ?? "manual"}</span>
                    {!p.email && (
                      <span className="ml-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600" title="No email — add one before activating">
                        no email
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{p.plan}</td>
                  <td className="px-4 py-2">
                    {p.cpl_cents === null ? "free" : `€${(p.cpl_cents / 100).toFixed(0)}`}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
