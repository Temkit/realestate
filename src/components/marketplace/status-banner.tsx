"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Success/error banner driven by ?lead= / ?error= after a form redirect.
 * Reads the query client-side so the host pages can stay static (ISR).
 */
function BannerInner({ locale }: { locale: string }) {
  const params = useSearchParams();
  const lead = params.get("lead") ?? undefined;
  const error = params.get("error") ?? undefined;
  const fr = locale !== "en";

  if (lead) {
    const msg =
      lead === "confirmed"
        ? fr
          ? "Rendez-vous confirmé ! Vous recevez un email de confirmation avec le détail."
          : "Appointment confirmed! A confirmation email with the details is on its way."
        : lead === "booking"
        ? fr
          ? "Demande de rendez-vous envoyée ! Le prestataire confirme un créneau par email."
          : "Appointment request sent! The provider will confirm a slot by email."
        : lead === "queued"
          ? fr
            ? "Demande enregistrée — nous la transmettons au plus vite."
            : "Request recorded — we are forwarding it shortly."
          : fr
            ? "Demande envoyée ! Les prestataires vous contacteront directement."
            : "Request sent! Providers will contact you directly.";
    return (
      <p className="mb-6 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-700" role="status">
        {msg}
      </p>
    );
  }
  if (error) {
    const msgs: Record<string, [string, string]> = {
      consent: ["Veuillez accepter la transmission de votre demande.", "Please accept the consent checkbox."],
      rate: ["Trop de demandes — réessayez dans quelques minutes.", "Too many requests — try again in a few minutes."],
      invalid: ["Formulaire invalide — vérifiez vos coordonnées (email ou téléphone requis).", "Invalid form — check your details (email or phone required)."],
      windows: ["Choisissez au moins un créneau valide (date future).", "Pick at least one valid (future) time slot."],
      slot_taken: ["Ce créneau vient d'être pris — choisissez-en un autre.", "That slot was just taken — please pick another."],
    };
    const [frMsg, enMsg] = msgs[error] ?? ["Une erreur est survenue.", "Something went wrong."];
    return (
      <p className="mb-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600" role="alert">
        {fr ? frMsg : enMsg}
      </p>
    );
  }
  return null;
}

export function StatusBanner({ locale }: { locale: string }) {
  return (
    <Suspense fallback={null}>
      <BannerInner locale={locale} />
    </Suspense>
  );
}
