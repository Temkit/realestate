import { getStats } from "@/lib/marketplace/admin-queries";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function StatsPage() {
  const stats = await getStats();
  const month = currentMonth();
  const maxDay = Math.max(1, ...stats.leadsByDay.map((d) => d.count));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Stats & billing</h1>
        <a
          href={`/admin/billing-export?month=${month}`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Billing CSV — {month}
        </a>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-3xl font-semibold">
            {stats.leadsByDay.reduce((a, d) => a + d.count, 0)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Leads (30 days)</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-3xl font-semibold">
            {stats.answerRatePercent === null ? "—" : `${stats.answerRatePercent}%`}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Dispatch answer rate</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-3xl font-semibold">
            {stats.dispatchByStatus.find((d) => d.status === "pending")?.count ?? 0}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Pending dispatches</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5">
          <h2 className="mb-3 text-base font-semibold">Leads per day (30d)</h2>
          {stats.leadsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.leadsByDay.map((d) => (
                <li key={d.day} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-muted-foreground">{d.day}</span>
                  <span
                    className="h-3 rounded bg-primary/60"
                    style={{ width: `${(d.count / maxDay) * 100}%`, minWidth: 4 }}
                  />
                  <span>{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="mb-3 text-base font-semibold">Top categories & communes</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <ul className="space-y-1">
              {stats.topCategories.map((c) => (
                <li key={c.name} className="flex justify-between gap-2">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-1">
              {stats.topCommunes.map((c) => (
                <li key={c.commune} className="flex justify-between gap-2">
                  <span>{c.commune}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-6 overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">CPL</th>
              <th className="px-4 py-2 font-medium">Dispatches</th>
              <th className="px-4 py-2 font-medium">Billable</th>
              <th className="px-4 py-2 font-medium">Answered</th>
            </tr>
          </thead>
          <tbody>
            {stats.perProvider.map((p) => (
              <tr key={p.provider_id} className="border-t">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2">{p.plan}</td>
                <td className="px-4 py-2">
                  {p.cpl_cents === null ? "free" : `€${(p.cpl_cents / 100).toFixed(0)}`}
                </td>
                <td className="px-4 py-2">{p.total}</td>
                <td className="px-4 py-2">{p.billable}</td>
                <td className="px-4 py-2">{p.answered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
