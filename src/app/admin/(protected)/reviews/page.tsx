import Link from "next/link";
import { Star } from "lucide-react";
import { listReviews, type ReviewStatus } from "@/lib/marketplace/reviews";
import { moderateReviewAction } from "../../actions";

export const dynamic = "force-dynamic";

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default async function ReviewsModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string }>;
}) {
  const { status, saved } = await searchParams;
  const active: ReviewStatus =
    status === "approved" || status === "rejected" ? status : "pending";
  const reviews = await listReviews(active);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reviews ({reviews.length})</h1>
        <div className="flex gap-1 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/reviews?status=${t.key}`}
              className={`rounded-lg px-3 py-1.5 ${
                active === t.key ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Updated.</p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {active} reviews.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-medium">{r.author_name}</span>
                  <span className="text-sm text-muted-foreground">→ {r.provider_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 16)}</span>
              </div>
              {r.comment && <p className="mb-3 text-sm">{r.comment}</p>}
              {active === "pending" && (
                <div className="flex gap-2">
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                      Approve
                    </button>
                  </form>
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="rejected" />
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
