import Link from "next/link";
import { listAppointments } from "@/lib/marketplace/admin-queries";
import { setAppointmentStatusAdminAction } from "../../actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-blue-500/10 text-blue-600",
  confirmed: "bg-green-500/10 text-green-600",
  declined: "bg-gray-500/10 text-gray-500",
  cancelled_user: "bg-gray-500/10 text-gray-500",
  cancelled_provider: "bg-amber-500/10 text-amber-600",
  completed: "bg-emerald-500/10 text-emerald-700",
  no_show: "bg-red-500/10 text-red-600",
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const appointments = await listAppointments(status);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Appointments ({appointments.length})</h1>
        <form method="GET" className="flex gap-2 text-sm">
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border bg-background px-2 py-1.5">
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="rounded-lg border px-3 py-1.5 hover:bg-muted">Filter</button>
        </form>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">
                    {a.starts_at ? a.starts_at.slice(0, 16).replace("T", " ") : "(windows)"}
                  </td>
                  <td className="px-4 py-2 font-medium">{a.provider_name}</td>
                  <td className="px-4 py-2">
                    {a.lead_id ? (
                      <Link href={`/admin/leads/${a.lead_id}`} className="hover:underline">
                        {a.user_name ?? "—"}
                      </Link>
                    ) : (
                      (a.user_name ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-2">{a.category_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[a.status] ?? ""}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {a.status === "confirmed" && (
                      <div className="flex gap-1.5">
                        {(["completed", "no_show", "cancelled_provider"] as const).map((s) => (
                          <form key={s} action={setAppointmentStatusAdminAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value={s} />
                            <button className="rounded-lg border px-2 py-1 text-xs hover:bg-muted">
                              {s.replace("cancelled_provider", "cancel").replace("_", " ")}
                            </button>
                          </form>
                        ))}
                      </div>
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
