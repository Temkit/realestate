import { NextRequest } from "next/server";
import { verifyDispatchToken } from "@/lib/marketplace/tokens";
import { getMarketplaceDb } from "@/lib/marketplace/db";

/**
 * Provider one-click reply from the lead email:
 * "Je prends ce client" (answered) / "Pas pertinent" (disputed).
 * Renders a tiny confirmation page — providers have no account.
 */

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <meta name="robots" content="noindex, nofollow"><title>${title}</title></head>
     <body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#1c1917">
     <h1 style="font-size:20px">${title}</h1><p>${body}</p>
     <p style="margin-top:32px;font-size:12px;color:#78716c">lëtz24</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const parsed = verifyDispatchToken(token);
  if (!parsed) {
    return page("Lien invalide", "Ce lien a expiré ou n'est pas valide.");
  }

  const db = getMarketplaceDb();
  if (!db) return page("Erreur", "Service momentanément indisponible.");

  const res = await db.execute({
    sql: "SELECT id, lead_id, status FROM lead_dispatches WHERE id = ?",
    args: [parsed.dispatchId],
  });
  if (!res.rows.length) {
    return page("Lien invalide", "Cette demande n'existe plus.");
  }
  const dispatch = res.rows[0];
  const currentStatus = String(dispatch.status);

  // Terminal states are immutable from the email link
  if (currentStatus === "converted") {
    return page("Déjà traité", "Cette demande est déjà marquée comme convertie.");
  }

  const newStatus = parsed.action; // 'answered' | 'disputed'
  if (currentStatus !== newStatus) {
    await db.execute({
      sql: "UPDATE lead_dispatches SET status = ? WHERE id = ?",
      args: [newStatus, parsed.dispatchId],
    });
    if (newStatus === "disputed") {
      // disputed within the window → not billable (spec §9)
      await db.execute({
        sql: "UPDATE lead_dispatches SET billable = 0 WHERE id = ?",
        args: [parsed.dispatchId],
      });
    }
    await db.execute({
      sql: `INSERT INTO lead_events (lead_id, dispatch_id, event, actor, meta)
            VALUES (?, ?, ?, 'provider', '{}')`,
      args: [String(dispatch.lead_id), parsed.dispatchId, `provider_${newStatus}`],
    });
    if (newStatus === "answered") {
      await db.execute({
        sql: "UPDATE leads SET status = 'answered' WHERE id = ? AND status = 'dispatched'",
        args: [String(dispatch.lead_id)],
      });
    }
  }

  return newStatus === "answered"
    ? page("C'est noté ✓", "Merci ! Contactez le client rapidement — ses coordonnées sont dans l'email.")
    : page("C'est noté", "La demande a été marquée comme non pertinente. Elle ne vous sera pas facturée.");
}
