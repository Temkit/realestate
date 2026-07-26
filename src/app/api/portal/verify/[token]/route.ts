import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/marketplace/queries";
import { getMarketplaceDb } from "@/lib/marketplace/db";
import {
  setProviderSession,
  verifyLoginToken,
} from "@/lib/marketplace/provider-auth";

/**
 * Magic-link landing: verify the signed login token, atomically claim it
 * (single-use), confirm the provider is still active, set the session cookie,
 * and send them into the portal.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const loginFail = (reason: string) =>
    NextResponse.redirect(new URL(`/portal/login?error=${reason}`, req.url));

  const { token } = await params;
  const parsed = verifyLoginToken(token);
  if (!parsed) return loginFail("expired");

  const db = getMarketplaceDb();
  if (!db) return loginFail("expired");

  // Single-use: claim the token hash; a second click finds it already present.
  const hash = createHash("sha256").update(token).digest("hex");
  const claim = await db.execute({
    sql: `INSERT INTO consumed_login_tokens (token_hash, expires_at)
          VALUES (?, ?) ON CONFLICT(token_hash) DO NOTHING`,
    args: [hash, new Date(parsed.exp).toISOString()],
  });
  if (claim.rowsAffected === 0) return loginFail("expired"); // already used

  // Opportunistic cleanup of expired rows (fire-and-forget)
  db.execute({
    sql: "DELETE FROM consumed_login_tokens WHERE expires_at < datetime('now')",
    args: [],
  }).catch(() => {});

  // Revalidate active status at click time (a paused provider can't log in)
  const provider = await getProvider(parsed.providerId).catch(() => null);
  if (!provider || provider.status !== "active") return loginFail("inactive");

  await setProviderSession(parsed.providerId);
  return NextResponse.redirect(new URL("/portal", req.url));
}
