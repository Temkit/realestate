import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";

/**
 * Redirect /api/go/{hash} to real listing URL.
 * The hash maps to a listing_tracker entry in Turso.
 * This hides real portal URLs from the static HTML source.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;

  if (!hash || hash.length !== 12) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  try {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      return NextResponse.redirect("https://olu.lu", { status: 302 });
    }

    const db = createClient({ url, authToken });

    // Look up the hash in a dedicated redirect table
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS url_redirects (
        hash TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    });

    const result = await db.execute({
      sql: "SELECT url FROM url_redirects WHERE hash = ?",
      args: [hash],
    });

    if (result.rows.length > 0 && result.rows[0].url) {
      return NextResponse.redirect(result.rows[0].url as string, {
        status: 302,
        headers: {
          "Cache-Control": "private, max-age=3600",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    // Not found — redirect to home
    return NextResponse.redirect("https://olu.lu", { status: 302 });
  } catch {
    return NextResponse.redirect("https://olu.lu", { status: 302 });
  }
}
