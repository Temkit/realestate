/**
 * Marketplace transactional email via Resend.
 * Degrades gracefully: without RESEND_API_KEY nothing is sent and callers
 * get { sent: false } — dispatches then stay `pending` for manual retry
 * from the admin inbox (spec §5, no silent drops).
 */

import { Resend } from "resend";
import type { BookingWindow } from "./types";

const FROM = process.env.MARKETPLACE_EMAIL_FROM || "lux24 <onboarding@resend.dev>";

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://olu.lu";
}

let resend: Resend | null | undefined;

function getResend(): Resend | null {
  if (resend !== undefined) return resend;
  const key = process.env.RESEND_API_KEY;
  resend = key ? new Resend(key) : null;
  return resend;
}

async function send(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.warn(`[marketplace-email] RESEND_API_KEY missing — not sent: "${subject}" → ${to}`);
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function layout(body: string): string {
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#1c1917">
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#78716c">lux24 — services au Luxembourg</p>
  </div>`;
}

function button(href: string, label: string, color = "#3b5bdb"): string {
  return `<a href="${href}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 18px;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-size:14px">${esc(label)}</a>`;
}

export const PERIOD_LABELS: Record<string, string> = {
  morning: "matin (à partir de 9h)",
  afternoon: "après-midi (à partir de 14h)",
};

export interface LeadEmailData {
  name: string;
  email: string | null;
  phone: string | null;
  commune: string | null;
  message: string | null;
  categoryNameFr: string;
}

/** Lead notification to the provider, with one-click reply links. */
export async function sendLeadToProvider(opts: {
  to: string;
  providerName: string;
  lead: LeadEmailData;
  answeredUrl: string | null;
  disputedUrl: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const { lead } = opts;
  const rows = [
    ["Service", lead.categoryNameFr],
    ["Nom", lead.name],
    ["Email", lead.email ?? "—"],
    ["Téléphone", lead.phone ?? "—"],
    ["Commune", lead.commune ?? "—"],
    ["Message", lead.message ?? "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#78716c">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`
    )
    .join("");

  const links =
    opts.answeredUrl && opts.disputedUrl
      ? `<p style="margin-top:16px">${button(opts.answeredUrl, "Je prends ce client")}${button(opts.disputedUrl, "Pas pertinent", "#78716c")}</p>`
      : "";

  return send(
    opts.to,
    `Nouvelle demande client — ${lead.categoryNameFr}`,
    layout(`
      <h2 style="font-size:18px">Bonjour ${esc(opts.providerName)},</h2>
      <p>Vous avez reçu une nouvelle demande via lux24 :</p>
      <table style="font-size:14px">${rows}</table>
      ${links}
      <p style="font-size:13px;color:#78716c">Répondez directement au client par email ou téléphone.</p>
    `)
  );
}

/** Confirmation to the user that the request was forwarded. */
export async function sendLeadConfirmationToUser(opts: {
  to: string;
  name: string;
  categoryName: string;
  providerCount: number;
  locale: string;
}): Promise<{ sent: boolean; error?: string }> {
  const fr = opts.locale !== "en";
  return send(
    opts.to,
    fr ? "Votre demande a bien été transmise" : "Your request has been forwarded",
    layout(
      fr
        ? `<h2 style="font-size:18px">Merci ${esc(opts.name)} !</h2>
           <p>Votre demande « ${esc(opts.categoryName)} » a été transmise à ${opts.providerCount} prestataire${opts.providerCount > 1 ? "s" : ""} au Luxembourg. Ils vous contacteront directement.</p>`
        : `<h2 style="font-size:18px">Thank you ${esc(opts.name)}!</h2>
           <p>Your "${esc(opts.categoryName)}" request was forwarded to ${opts.providerCount} provider${opts.providerCount > 1 ? "s" : ""} in Luxembourg. They will contact you directly.</p>`
    )
  );
}

/** Booking request to the provider with per-window confirm links + decline. */
export async function sendBookingRequestToProvider(opts: {
  to: string;
  providerName: string;
  lead: LeadEmailData;
  windows: BookingWindow[];
  confirmUrls: string[]; // same order as windows
  declineUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const windowButtons = opts.windows
    .map((w, i) =>
      button(opts.confirmUrls[i], `Confirmer ${w.date} ${PERIOD_LABELS[w.period] ?? w.period}`)
    )
    .join("");

  return send(
    opts.to,
    `Demande de rendez-vous — ${opts.lead.categoryNameFr}`,
    layout(`
      <h2 style="font-size:18px">Bonjour ${esc(opts.providerName)},</h2>
      <p><strong>${esc(opts.lead.name)}</strong> souhaite un rendez-vous (${esc(opts.lead.categoryNameFr)}).</p>
      <p>Contact : ${esc(opts.lead.email ?? "—")} / ${esc(opts.lead.phone ?? "—")}<br/>
      ${opts.lead.message ? `Message : ${esc(opts.lead.message)}` : ""}</p>
      <p>Choisissez un créneau (un clic suffit) :</p>
      <p>${windowButtons}</p>
      <p>${button(opts.declineUrl, "Refuser la demande", "#78716c")}</p>
    `)
  );
}

/** Appointment confirmation to the user, with a manage (cancel) link. */
export async function sendBookingConfirmedToUser(opts: {
  to: string;
  name: string;
  providerName: string;
  startsAt: string; // ISO
  manageUrl: string;
  locale: string;
}): Promise<{ sent: boolean; error?: string }> {
  const fr = opts.locale !== "en";
  const when = formatDateTime(opts.startsAt, fr ? "fr-FR" : "en-GB");
  return send(
    opts.to,
    fr ? `Rendez-vous confirmé — ${opts.providerName}` : `Appointment confirmed — ${opts.providerName}`,
    layout(
      fr
        ? `<h2 style="font-size:18px">Rendez-vous confirmé ✓</h2>
           <p><strong>${esc(opts.providerName)}</strong> vous attend le <strong>${when}</strong>.</p>
           <p>${button(opts.manageUrl, "Gérer / annuler le rendez-vous", "#78716c")}</p>`
        : `<h2 style="font-size:18px">Appointment confirmed ✓</h2>
           <p><strong>${esc(opts.providerName)}</strong> expects you on <strong>${when}</strong>.</p>
           <p>${button(opts.manageUrl, "Manage / cancel appointment", "#78716c")}</p>`
    )
  );
}

/** Notify ops that someone wants to claim a directory listing. */
export async function sendClaimToOps(opts: {
  providerName: string;
  providerId: number;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const to = process.env.MARKETPLACE_OPS_EMAIL || "pro@lux24.lu";
  const rows = [
    ["Entreprise", `${opts.providerName} (#${opts.providerId})`],
    ["Contact", opts.contactName],
    ["Email", opts.email],
    ["Téléphone", opts.phone ?? "—"],
    ["Message", opts.message ?? "—"],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#78716c">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join("");
  return send(
    to,
    `Revendication de fiche — ${opts.providerName}`,
    layout(`<h2 style="font-size:18px">Nouvelle demande de revendication</h2>
      <table style="font-size:14px">${rows}</table>
      <p style="font-size:13px;color:#78716c">Vérifiez puis activez la fiche dans /admin/claims.</p>`)
  );
}

/** Review request to the customer after a completed appointment (P3b). */
export async function sendReviewRequest(opts: {
  to: string;
  name: string;
  providerName: string;
  reviewUrl: string;
  locale: string;
}): Promise<{ sent: boolean; error?: string }> {
  const fr = opts.locale !== "en";
  return send(
    opts.to,
    fr ? `Votre avis sur ${opts.providerName} ?` : `How was ${opts.providerName}?`,
    layout(
      fr
        ? `<h2 style="font-size:18px">Bonjour ${esc(opts.name)},</h2>
           <p>Comment s'est passé votre rendez-vous chez <strong>${esc(opts.providerName)}</strong> ?
           Votre avis aide d'autres personnes au Luxembourg.</p>
           <p style="margin-top:16px">${button(opts.reviewUrl, "Laisser un avis")}</p>`
        : `<h2 style="font-size:18px">Hello ${esc(opts.name)},</h2>
           <p>How was your appointment with <strong>${esc(opts.providerName)}</strong>?
           Your review helps others in Luxembourg.</p>
           <p style="margin-top:16px">${button(opts.reviewUrl, "Leave a review")}</p>`
    )
  );
}

/** Passwordless login link for the provider portal (P3). */
export async function sendProviderLoginLink(opts: {
  to: string;
  providerName: string;
  loginUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  return send(
    opts.to,
    "Votre lien de connexion — Espace pro lux24",
    layout(`
      <h2 style="font-size:18px">Bonjour ${esc(opts.providerName)},</h2>
      <p>Cliquez pour accéder à votre espace pro lux24 (leads, rendez-vous, tarifs, disponibilités) :</p>
      <p style="margin-top:16px">${button(opts.loginUrl, "Ouvrir mon espace pro")}</p>
      <p style="font-size:13px;color:#78716c">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `)
  );
}

/** Auto-confirmed booking notice to the provider, with a cancel link. */
export async function sendAutoBookingToProvider(opts: {
  to: string;
  providerName: string;
  lead: LeadEmailData;
  startsAt: string;
  cancelUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const when = formatDateTime(opts.startsAt, "fr-FR");
  return send(
    opts.to,
    `Nouveau rendez-vous confirmé — ${when}`,
    layout(`
      <h2 style="font-size:18px">Bonjour ${esc(opts.providerName)},</h2>
      <p><strong>${esc(opts.lead.name)}</strong> a réservé un créneau (${esc(opts.lead.categoryNameFr)}) :</p>
      <p style="font-size:16px"><strong>${when}</strong></p>
      <p>Contact : ${esc(opts.lead.email ?? "—")} / ${esc(opts.lead.phone ?? "—")}<br/>
      ${opts.lead.message ? `Message : ${esc(opts.lead.message)}` : ""}</p>
      <p>${button(opts.cancelUrl, "Annuler ce rendez-vous", "#78716c")}</p>
    `)
  );
}

/** Provider-side cancellation notice to the user. */
export async function sendBookingCancelledToUser(opts: {
  to: string;
  name: string;
  providerName: string;
  startsAt: string | null;
  locale: string;
}): Promise<{ sent: boolean; error?: string }> {
  const fr = opts.locale !== "en";
  const when = opts.startsAt
    ? formatDateTime(opts.startsAt, fr ? "fr-FR" : "en-GB")
    : null;
  return send(
    opts.to,
    fr ? `Rendez-vous annulé — ${opts.providerName}` : `Appointment cancelled — ${opts.providerName}`,
    layout(
      fr
        ? `<p>Bonjour ${esc(opts.name)}, <strong>${esc(opts.providerName)}</strong> a dû annuler votre rendez-vous${when ? ` du <strong>${when}</strong>` : ""}. N'hésitez pas à réserver un autre créneau sur lux24.</p>`
        : `<p>Hello ${esc(opts.name)}, <strong>${esc(opts.providerName)}</strong> had to cancel your appointment${when ? ` on <strong>${when}</strong>` : ""}. Feel free to book another slot on lux24.</p>`
    )
  );
}

/** Reminder (24h / 2h before) to user or provider. */
export async function sendAppointmentReminder(opts: {
  to: string;
  recipientName: string;
  otherPartyName: string;
  startsAt: string;
  locale: string;
}): Promise<{ sent: boolean; error?: string }> {
  const fr = opts.locale !== "en";
  const when = formatDateTime(opts.startsAt, fr ? "fr-FR" : "en-GB");
  return send(
    opts.to,
    fr ? `Rappel : rendez-vous ${when}` : `Reminder: appointment ${when}`,
    layout(
      fr
        ? `<p>Bonjour ${esc(opts.recipientName)}, rappel de votre rendez-vous avec <strong>${esc(opts.otherPartyName)}</strong> le <strong>${when}</strong>.</p>`
        : `<p>Hello ${esc(opts.recipientName)}, reminder of your appointment with <strong>${esc(opts.otherPartyName)}</strong> on <strong>${when}</strong>.</p>`
    )
  );
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Luxembourg",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
