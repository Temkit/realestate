import { Receiver } from "@upstash/qstash";
import { getMarketplaceDb } from "@/lib/marketplace/db";

/**
 * GDPR retention (spec §3): anonymize PII on leads older than 12 months.
 * Runs monthly via QStash cron — see scripts/ops/2026-07-22-register-marketplace-crons.sh
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

  const db = getMarketplaceDb();
  if (!db) return Response.json({ error: "DB unavailable" }, { status: 500 });

  const res = await db.execute({
    sql: `UPDATE leads SET
            name = '[purged]', email = NULL, phone = NULL,
            message = NULL, answers = '{}'
          WHERE created_at < datetime('now', '-12 months')
            AND name != '[purged]'`,
    args: [],
  });

  return Response.json({ ok: true, purged: res.rowsAffected });
}
