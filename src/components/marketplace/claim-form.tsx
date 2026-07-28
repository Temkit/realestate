import { submitClaimAction } from "@/lib/marketplace/public-actions";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

/** "Claim this listing" form for an unclaimed directory provider. */
export function ClaimForm({
  locale,
  providerId,
  providerName,
  backTo,
}: {
  locale: string;
  providerId: number;
  providerName: string;
  backTo: string;
}) {
  const fr = locale !== "en";
  return (
    <form action={submitClaimAction} className="space-y-3">
      <input type="hidden" name="provider_id" value={providerId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back_to" value={backTo} />
      <input type="text" name="website2" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <input name="contact_name" required placeholder={fr ? "Votre nom *" : "Your name *"} className={inputCls} />
      <input name="email" type="email" required placeholder={fr ? "Email professionnel *" : "Business email *"} className={inputCls} />
      <input name="phone" placeholder={fr ? "Téléphone" : "Phone"} className={inputCls} />
      <textarea
        name="message"
        rows={2}
        placeholder={fr ? `Un mot pour confirmer que vous gérez ${providerName}…` : `A note confirming you manage ${providerName}…`}
        className={inputCls}
      />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>
          {fr
            ? "Je confirme être autorisé à gérer cette entreprise. Voir la politique de confidentialité."
            : "I confirm I'm authorised to manage this business. See the privacy policy."}
        </span>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {fr ? "Revendiquer cette fiche" : "Claim this listing"}
      </button>
    </form>
  );
}
