import { submitAutoBookAction } from "@/lib/marketplace/public-actions";
import type { SlotDay } from "@/lib/marketplace/slots";
import type { Category } from "@/lib/marketplace/types";
import { cname } from "@/lib/marketplace/display";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

/**
 * Level-2 auto-confirm booking: pick a real open slot (grouped by day),
 * booking confirms instantly (spec §10). Plain HTML — no client JS.
 */
export function SlotPickerForm({
  locale,
  providerId,
  categories,
  days,
  backTo,
}: {
  locale: string;
  providerId: number;
  categories: Category[];
  days: SlotDay[];
  backTo: string;
}) {
  const fr = locale !== "en";
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Europe/Luxembourg",
    }).format(new Date(`${date}T12:00:00`));

  return (
    <form action={submitAutoBookAction} className="space-y-3">
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

      <select name="slot" required className={inputCls} size={8}>
        {days.map((d) => (
          <optgroup key={d.date} label={dayLabel(d.date)}>
            {d.slots.map((s) => (
              <option key={s.iso} value={s.iso}>
                {dayLabel(d.date)} — {s.time}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder={fr ? "Votre nom *" : "Your name *"} className={inputCls} />
        <input name="email" type="email" placeholder="Email" className={inputCls} />
        <input name="phone" placeholder={fr ? "Téléphone" : "Phone"} className={inputCls} />
      </div>
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
            ? "J'accepte que ma réservation soit transmise à ce prestataire. Voir la politique de confidentialité."
            : "I agree that my booking is sent to this provider. See the privacy policy."}
        </span>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {fr ? "Réserver ce créneau" : "Book this slot"}
      </button>
    </form>
  );
}
