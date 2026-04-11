import { NextRequest } from "next/server";
import { analyzeQueryCompleteness } from "@/lib/search/query-analyzer";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  if (!query.trim()) {
    return Response.json({ complete: true, missing: null, options: [], summary: "" });
  }
  const analysis = await analyzeQueryCompleteness(query);
  return Response.json(analysis);
}
