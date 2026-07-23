import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadDetail } from "@/lib/marketplace/admin-queries";
import {
  retryDispatchAction,
  setDispatchStatusAction,
  setLeadStatusAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Lead — {lead.name}{" "}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{lead.status}</span>
        </h1>
        <Link href="/admin/leads" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
          ← Inbox
        </Link>
      </div>

      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Saved.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5">
          <h2 className="mb-3 text-base font-semibold">Details</h2>
          <dl className="space-y-1.5 text-sm">
            {(
              [
                ["Category", lead.category_name],
                ["Email", lead.email],
                ["Phone", lead.phone],
                ["Commune", lead.commune],
                ["Message", lead.message],
                ["Locale", lead.locale],
                ["Source", lead.source_page],
                ["Created", lead.created_at],
                ["Consent + answers", lead.answers !== "{}" ? lead.answers : null],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
          </dl>
          <div className="mt-4 flex gap-2">
            {(["converted", "invalid"] as const)
              .filter((s) => s !== lead.status)
              .map((s) => (
                <form key={s} action={setLeadStatusAction}>
                  <input type="hidden" name="lead_id" value={lead.id} />
                  <input type="hidden" name="status" value={s} />
                  <button className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                    Mark {s}
                  </button>
                </form>
              ))}
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="mb-3 text-base font-semibold">Dispatches</h2>
          {lead.dispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-2">
              {lead.dispatches.map((d) => (
                <li key={d.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{d.provider_name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {d.status}
                      {d.billable ? " · billable" : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {d.provider_email} {d.sent_at ? `· sent ${d.sent_at.slice(0, 16)}` : "· not sent"}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {(d.status === "pending" || d.status === "bounced") && (
                      <form action={retryDispatchAction}>
                        <input type="hidden" name="dispatch_id" value={d.id} />
                        <input type="hidden" name="lead_id" value={lead.id} />
                        <button className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
                          Retry send
                        </button>
                      </form>
                    )}
                    {d.status !== "converted" && d.status !== "disputed" && (
                      <form action={setDispatchStatusAction}>
                        <input type="hidden" name="dispatch_id" value={d.id} />
                        <input type="hidden" name="lead_id" value={lead.id} />
                        <input type="hidden" name="status" value="converted" />
                        <button className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">
                          Mark converted
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border p-5">
        <h2 className="mb-3 text-base font-semibold">Timeline</h2>
        <ul className="space-y-1 text-sm">
          {lead.events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-36 shrink-0 text-muted-foreground">
                {e.created_at.slice(0, 16)}
              </span>
              <span className="font-medium">{e.event}</span>
              <span className="text-muted-foreground">{e.actor}</span>
              {e.meta !== "{}" && (
                <span className="break-all text-xs text-muted-foreground">{e.meta}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
