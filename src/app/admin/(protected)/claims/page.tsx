import Link from "next/link";
import { listClaims } from "@/lib/marketplace/admin-queries";
import { moderateClaimAction } from "../../actions";

export const dynamic = "force-dynamic";

const TABS = ["pending", "approved", "rejected"] as const;

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string }>;
}) {
  const { status, saved } = await searchParams;
  const active = (TABS as readonly string[]).includes(status ?? "") ? status! : "pending";
  const claims = await listClaims(active);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Listing claims ({claims.length})</h1>
        <div className="flex gap-1 text-sm">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/admin/claims?status=${t}`}
              className={`rounded-lg px-3 py-1.5 ${active === t ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      {saved && <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Updated.</p>}

      {claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {active} claims.</p>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/admin/providers/${c.provider_id}`} className="font-medium hover:underline">
                    {c.provider_name}
                  </Link>
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{c.provider_status}</span>
                </div>
                <span className="text-xs text-muted-foreground">{c.created_at.slice(0, 16)}</span>
              </div>
              <div className="mb-3 text-sm">
                <span className="font-medium">{c.contact_name}</span> ·{" "}
                <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>
                {c.phone && <> · {c.phone}</>}
              </div>
              {c.message && <p className="mb-3 text-sm text-muted-foreground">{c.message}</p>}
              {active === "pending" && (
                <div className="flex gap-2">
                  <form action={moderateClaimAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                      Approve → activate + set email
                    </button>
                  </form>
                  <form action={moderateClaimAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
