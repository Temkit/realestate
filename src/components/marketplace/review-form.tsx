import { Star } from "lucide-react";
import { submitReviewAction } from "@/lib/marketplace/public-actions";

/**
 * Star-rating form. Radio inputs (reverse-ordered with a CSS peer trick) give
 * a hover/checked highlight with zero client JS — works in the server form.
 */
export function ReviewForm({
  token,
  locale,
  providerName,
}: {
  token: string;
  locale: string;
  providerName: string;
}) {
  const fr = locale !== "en";

  return (
    <form action={submitReviewAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />

      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          {fr ? `Votre note pour ${providerName}` : `Your rating for ${providerName}`}
        </p>
        {/* Reverse order so ~ sibling selector can light up lower stars */}
        <div dir="rtl" className="inline-flex flex-row-reverse gap-1">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                required
                defaultChecked={n === 5}
                className="peer sr-only"
              />
              <Star
                className="h-8 w-8 text-muted-foreground/30 peer-checked:fill-amber-400 peer-checked:text-amber-400 hover:fill-amber-300 hover:text-amber-300"
              />
            </label>
          ))}
        </div>
      </div>

      <textarea
        name="comment"
        rows={4}
        maxLength={2000}
        placeholder={fr ? "Votre commentaire (optionnel)…" : "Your comment (optional)…"}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
      />

      <button
        type="submit"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {fr ? "Publier mon avis" : "Publish my review"}
      </button>
      <p className="text-xs text-muted-foreground">
        {fr
          ? "Votre avis sera vérifié avant publication."
          : "Your review will be checked before publication."}
      </p>
    </form>
  );
}
