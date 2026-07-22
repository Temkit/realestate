import { NEARBY_COMMUNES } from "@/lib/communes";
import { submitLeadAction } from "@/lib/marketplace/public-actions";
import { communeDisplay } from "@/lib/marketplace/display";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

/**
 * Quote-request form. Fan-out (no providerId) or pinned to one provider.
 * Plain HTML form → server action; works without client JS.
 */
export function LeadForm({
  locale,
  categoryId,
  backTo,
  providerId,
  defaultCommune,
  showCommune = true,
}: {
  locale: string;
  categoryId: number;
  backTo: string;
  providerId?: number;
  defaultCommune?: string;
  showCommune?: boolean;
}) {
  const fr = locale !== "en";
  const communes = Object.keys(NEARBY_COMMUNES).sort();

  return (
    <form action={submitLeadAction} className="space-y-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back_to" value={backTo} />
      {providerId && <input type="hidden" name="provider_id" value={providerId} />}
      {/* Honeypot — hidden from humans, bots fill it */}
      <input
        type="text"
        name="website2"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder={fr ? "Votre nom *" : "Your name *"} className={inputCls} />
        <input name="email" type="email" placeholder="Email" className={inputCls} />
        <input name="phone" placeholder={fr ? "Téléphone" : "Phone"} className={inputCls} />
        {showCommune && (
          <select name="commune" defaultValue={defaultCommune ?? ""} className={inputCls}>
            <option value="">{fr ? "Commune…" : "Commune…"}</option>
            {communes.map((c) => (
              <option key={c} value={c}>
                {communeDisplay(c)}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        name="message"
        rows={3}
        placeholder={fr ? "Décrivez votre besoin…" : "Describe what you need…"}
        className={inputCls}
      />
      <p className="text-xs text-muted-foreground">
        {fr
          ? "Email ou téléphone requis — les prestataires vous répondent directement."
          : "Email or phone required — providers reply to you directly."}
      </p>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>
          {fr
            ? "J'accepte que ma demande soit transmise aux prestataires concernés (max. 3). Voir la politique de confidentialité."
            : "I agree that my request is forwarded to matching providers (max. 3). See the privacy policy."}
        </span>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {fr ? "Recevoir des devis gratuits" : "Get free quotes"}
      </button>
    </form>
  );
}
