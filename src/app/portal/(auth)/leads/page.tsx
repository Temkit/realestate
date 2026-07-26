import { requireProvider } from "@/lib/marketplace/provider-auth";
import { listProviderLeads } from "@/lib/marketplace/provider-queries";
import { communeDisplay } from "@/lib/marketplace/display";
import { respondLeadAction } from "../../actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  sent: "Nouveau",
  answered: "Répondu",
  converted: "Client gagné",
  disputed: "Non pertinent",
  bounced: "Échec email",
};
const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-500/10 text-blue-600",
  answered: "bg-amber-500/10 text-amber-600",
  converted: "bg-emerald-500/10 text-emerald-700",
  disputed: "bg-gray-500/10 text-gray-500",
  bounced: "bg-red-500/10 text-red-600",
};

export default async function PortalLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const providerId = await requireProvider();
  const { saved } = await searchParams;
  const leads = await listProviderLeads(providerId);

  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold">Demandes clients</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Contactez le client directement par email ou téléphone, puis mettez à jour le statut.
      </p>
      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Mis à jour.</p>
      )}

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de demande.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <div key={l.dispatch_id} className="rounded-2xl border bg-card p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{l.name}</span>
                  {l.category_name && (
                    <span className="ml-2 text-sm text-muted-foreground">· {l.category_name}</span>
                  )}
                  {l.commune && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      · {communeDisplay(l.commune)}
                    </span>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[l.status] ?? ""}`}>
                  {STATUS_LABELS[l.status] ?? l.status}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {l.email && (
                  <a href={`mailto:${l.email}`} className="text-primary hover:underline">
                    {l.email}
                  </a>
                )}
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="text-primary hover:underline">
                    {l.phone}
                  </a>
                )}
                <span className="text-muted-foreground">{l.created_at.slice(0, 16).replace("T", " ")}</span>
              </div>

              {l.message && <p className="mb-3 text-sm">{l.message}</p>}

              <div className="flex flex-wrap gap-2">
                {l.status !== "converted" && (
                  <form action={respondLeadAction}>
                    <input type="hidden" name="dispatch_id" value={l.dispatch_id} />
                    <input type="hidden" name="status" value="converted" />
                    <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                      Marquer « client gagné »
                    </button>
                  </form>
                )}
                {l.status === "sent" && (
                  <>
                    <form action={respondLeadAction}>
                      <input type="hidden" name="dispatch_id" value={l.dispatch_id} />
                      <input type="hidden" name="status" value="answered" />
                      <button className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                        J&apos;ai répondu
                      </button>
                    </form>
                    <form action={respondLeadAction}>
                      <input type="hidden" name="dispatch_id" value={l.dispatch_id} />
                      <input type="hidden" name="status" value="disputed" />
                      <button className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                        Non pertinent
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
