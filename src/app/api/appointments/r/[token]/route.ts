import { NextRequest } from "next/server";
import {
  afterConfirm,
  confirmAppointment,
  getAppointmentByToken,
  getAppointmentContext,
  setAppointmentStatus,
  windowToStartsAt,
} from "@/lib/marketplace/leads";

/**
 * Provider one-click booking reply: ?action=confirm&w=<windowIndex> or
 * ?action=decline. Confirm sets starts_at from the chosen preferred window,
 * emails the user and schedules reminders.
 */

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <meta name="robots" content="noindex, nofollow"><title>${title}</title></head>
     <body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#1c1917">
     <h1 style="font-size:20px">${title}</h1><p>${body}</p>
     <p style="margin-top:32px;font-size:12px;color:#78716c">lux24</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  let appt;
  try {
    appt = await getAppointmentByToken("confirm", token);
  } catch {
    return page("Erreur", "Service momentanément indisponible.");
  }
  if (!appt) return page("Lien invalide", "Ce lien a expiré ou n'est pas valide.");

  const action = req.nextUrl.searchParams.get("action");

  if (appt.status === "cancelled_user") {
    return page("Demande annulée", "Le client a annulé cette demande de rendez-vous.");
  }
  if (appt.status === "confirmed") {
    return page("Déjà confirmé ✓", "Ce rendez-vous est déjà confirmé.");
  }
  if (appt.status !== "requested") {
    return page("Demande clôturée", "Cette demande n'est plus active.");
  }

  if (action === "decline") {
    await setAppointmentStatus(appt, "declined", "provider");
    return page("C'est noté", "La demande de rendez-vous a été refusée.");
  }

  if (action === "confirm") {
    const ctx = await getAppointmentContext(appt);
    if (!ctx) return page("Erreur", "Données introuvables.");
    const idx = Number(req.nextUrl.searchParams.get("w"));
    const window = ctx.windows[idx];
    if (!window) return page("Lien invalide", "Créneau introuvable.");

    const startsAt = windowToStartsAt(window);
    await confirmAppointment(appt, startsAt, ctx.slotMinutes);
    await afterConfirm(appt, startsAt);
    return page(
      "Rendez-vous confirmé ✓",
      `Le client a été prévenu par email. Créneau : ${window.date}, ${window.period === "morning" ? "matin" : "après-midi"}.`
    );
  }

  return page("Action inconnue", "Utilisez les boutons de l'email.");
}
