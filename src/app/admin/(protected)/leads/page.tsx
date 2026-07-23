import Link from "next/link";
import { listLeads } from "@/lib/marketplace/admin-queries";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  dispatched: "bg-amber-500/10 text-amber-600",
  answered: "bg-green-500/10 text-green-600",
  converted: "bg-emerald-500/10 text-emerald-700",
  invalid: "bg-gray-500/10 text-gray-500",
};

export default async function LeadsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const leads = await listLeads(status);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Leads ({leads.length})</h1>
        <form method="GET" className="flex gap-2 text-sm">
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border bg-background px-2 py-1.5">
            <option value="">All statuses</option>
            {["new", "dispatched", "answered", "converted", "invalid"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="rounded-lg border px-3 py-1.5 hover:bg-muted">Filter</button>
        </form>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Commune</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Dispatches</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">
                    {l.created_at.slice(0, 16)}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/leads/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {l.email ?? l.phone ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {l.category_name ?? "—"}
                    <div className="text-xs text-muted-foreground">{l.vertical_name}</div>
                  </td>
                  <td className="px-4 py-2">{l.commune ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[l.status] ?? ""}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {l.dispatch_count}
                    {l.pending_count > 0 && (
                      <span className="ml-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-xs text-red-600">
                        {l.pending_count} pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
