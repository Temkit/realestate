import { submitBookingAction } from "@/lib/marketplace/public-actions";
import type { Category } from "@/lib/marketplace/types";
import { cname } from "@/lib/marketplace/display";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

/**
 * Level-1 booking request: contact details + up to two preferred time
 * windows; the provider confirms one by email magic link (spec §10).
 */
export function BookingForm({
  locale,
  providerId,
  categories,
  backTo,
}: {
  locale: string;
  providerId: number;
  categories: Category[];
  backTo: string;
}) {
  const fr = locale !== "en";

  return (
    <form action={submitBookingAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back_to" value={backTo} />
      <input type="hidden" name="provider_id" value={providerId} />
      <input
        type="text"
        name="website2"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.length === 1 ? (
          <input type="hidden" name="category_id" value={categories[0].id} />
        ) : (
          <select name="category_id" required className={inputCls}>
            <option value="">{fr ? "Service…" : "Service…"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {cname(c, locale)}
              </option>
            ))}
          </select>
        )}
        <input name="name" required placeholder={fr ? "Votre nom *" : "Your name *"} className={inputCls} />
        <input name="email" type="email" placeholder="Email" className={inputCls} />
        <input name="phone" placeholder={fr ? "Téléphone" : "Phone"} className={inputCls} />
      </div>

      <fieldset className="rounded-xl border p-3">
        <legend className="px-1 text-xs text-muted-foreground">
          {fr ? "Vos disponibilités (le prestataire confirme un créneau)" : "Your availability (the provider confirms one slot)"}
        </legend>
        {[0, 1].map((i) => (
          <div key={i} className="mb-2 grid grid-cols-2 gap-2">
            <input name={`window_date_${i}`} type="date" required={i === 0} className={inputCls} />
            <select name={`window_period_${i}`} className={inputCls} defaultValue={i === 0 ? "morning" : "afternoon"}>
              <option value="morning">{fr ? "Matin" : "Morning"}</option>
              <option value="afternoon">{fr ? "Après-midi" : "Afternoon"}</option>
            </select>
          </div>
        ))}
      </fieldset>

      <textarea
        name="message"
        rows={2}
        placeholder={fr ? "Précisions (optionnel)…" : "Details (optional)…"}
        className={inputCls}
      />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>
          {fr
            ? "J'accepte que ma demande soit transmise à ce prestataire. Voir la politique de confidentialité."
            : "I agree that my request is sent to this provider. See the privacy policy."}
        </span>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {fr ? "Demander un rendez-vous" : "Request an appointment"}
      </button>
    </form>
  );
}
