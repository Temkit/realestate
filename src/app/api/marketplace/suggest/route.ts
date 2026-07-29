import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/marketplace/public-queries";

/** Autocomplete endpoint for the marketplace search box. */
export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("q") ?? "";
  const data = await suggest(term, 6);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
