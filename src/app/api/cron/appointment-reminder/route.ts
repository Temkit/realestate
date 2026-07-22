import { Receiver } from "@upstash/qstash";
import { getMarketplaceDb } from "@/lib/marketplace/db";
import { sendAppointmentReminder } from "@/lib/marketplace/email";

/**
 * QStash-delivered appointment reminder (scheduled at confirm time for
 * T-24h and T-2h). Checks status at fire time — cancelled appointments
 * simply no-op, so nothing needs to be un-scheduled on cancellation.
 */

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const isValid = await receiver.verify({
      signature: req.headers.get("upstash-signature") || "",
      body,
    });
    if (!isValid) return Response.json({ error: "Invalid signature" }, { status: 401 });
  } catch {
    return Response.json({ error: "Signature verification failed" }, { status: 401 });
  }

  let appointmentId: string;
  try {
    ({ appointmentId } = JSON.parse(body));
  } catch {
    return Response.json({ error: "Bad payload" }, { status: 400 });
  }

  const db = getMarketplaceDb();
  if (!db) return Response.json({ error: "DB unavailable" }, { status: 500 });

  const res = await db.execute({
    sql: `SELECT a.status, a.starts_at,
                 l.name AS user_name, l.email AS user_email, l.locale,
                 p.name AS provider_name, p.email AS provider_email
          FROM appointments a
          JOIN providers p ON p.id = a.provider_id
          LEFT JOIN leads l ON l.id = a.lead_id
          WHERE a.id = ?`,
    args: [appointmentId],
  });
  if (!res.rows.length) return Response.json({ skipped: "not found" });
  const r = res.rows[0];

  if (String(r.status) !== "confirmed" || !r.starts_at) {
    return Response.json({ skipped: `status=${r.status}` });
  }
  const startsAt = String(r.starts_at);
  if (new Date(startsAt).getTime() < Date.now()) {
    return Response.json({ skipped: "in the past" });
  }

  const results: Record<string, boolean> = {};
  if (r.user_email) {
    const { sent } = await sendAppointmentReminder({
      to: String(r.user_email),
      recipientName: String(r.user_name ?? ""),
      otherPartyName: String(r.provider_name),
      startsAt,
      locale: String(r.locale ?? "fr"),
    });
    results.user = sent;
  }
  const { sent } = await sendAppointmentReminder({
    to: String(r.provider_email),
    recipientName: String(r.provider_name),
    otherPartyName: String(r.user_name ?? "client lux24"),
    startsAt,
    locale: "fr",
  });
  results.provider = sent;

  return Response.json({ ok: true, results });
}
