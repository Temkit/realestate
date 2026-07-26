import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getMarketplaceDb } from "@/lib/marketplace/db";
import { getAppointmentByToken, getAppointmentContext } from "@/lib/marketplace/leads";
import { appointmentHasReview } from "@/lib/marketplace/reviews";
import { ReviewForm } from "@/components/marketplace/review-form";

export const metadata: Metadata = {
  title: "Laisser un avis | lux24",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  await connection();
  const { locale, token } = await params;
  const { done, error } = await searchParams;
  const fr = locale !== "en";
  if (!getMarketplaceDb()) notFound();

  const appt = await getAppointmentByToken("manage", token);
  if (!appt) notFound();
  const ctx = await getAppointmentContext(appt);
  if (!ctx) notFound();

  const alreadyReviewed = done === "1" || (await appointmentHasReview(appt.id));
  const notCompleted = appt.status !== "completed";

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="mb-4 text-xl font-semibold">
          {fr ? "Votre avis" : "Your review"}
        </h1>

        {alreadyReviewed ? (
          <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-700">
            {fr
              ? "Merci ! Votre avis a bien été enregistré et sera publié après vérification."
              : "Thank you! Your review was recorded and will be published after verification."}
          </p>
        ) : notCompleted ? (
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Vous pourrez laisser un avis une fois votre rendez-vous terminé."
              : "You can leave a review once your appointment is completed."}
          </p>
        ) : (
          <>
            {error === "rating" && (
              <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
                {fr ? "Choisissez une note." : "Please choose a rating."}
              </p>
            )}
            <ReviewForm token={token} locale={locale} providerName={ctx.providerName} />
          </>
        )}
      </div>
    </div>
  );
}
