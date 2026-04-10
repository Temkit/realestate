import { Receiver } from "@upstash/qstash";
import { getTopSearches } from "@/lib/analytics";
import { buildSearchCacheKey, getSearchCache, setSearchCache } from "@/lib/search-cache";

// Verify QStash signature to prevent unauthorized calls
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

// Allow up to 5 minutes for the warm-up
export const maxDuration = 300;

export async function POST(req: Request) {
  // Verify QStash signature
  try {
    const body = await req.text();
    const isValid = await receiver.verify({
      signature: req.headers.get("upstash-signature") || "",
      body,
    });
    if (!isValid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Signature verification failed" }, { status: 401 });
  }

  // Import runPipeline dynamically to avoid circular deps
  const { searchAction } = await import("@/app/actions");

  const startTime = Date.now();
  const results: { query: string; mode: string; status: string; ms: number }[] = [];

  try {
    // Get top searches from last 7 days
    const topSearches = await getTopSearches(7, 30);

    if (!topSearches || topSearches.length === 0) {
      return Response.json({ message: "No searches to warm", warmed: 0 });
    }

    for (const row of topSearches) {
      const query = row.query as string;
      const mode = row.mode as "buy" | "rent";
      const queryStart = Date.now();

      try {
        // Check if already cached
        const cacheKey = buildSearchCacheKey(query, mode);
        const existing = await getSearchCache(cacheKey);

        if (existing) {
          results.push({ query, mode, status: "already_cached", ms: Date.now() - queryStart });
          continue;
        }

        // Run the pipeline to warm the cache
        const result = await searchAction(query, mode);
        await setSearchCache(cacheKey, result);

        results.push({
          query, mode,
          status: `warmed_${result.properties.length}_results`,
          ms: Date.now() - queryStart,
        });

        // 1 second delay between calls to avoid rate limits
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        results.push({ query, mode, status: "failed", ms: Date.now() - queryStart });
      }
    }
  } catch (err) {
    return Response.json({
      error: "Warm-up failed",
      detail: err instanceof Error ? err.message : "Unknown error",
      partial: results,
    }, { status: 500 });
  }

  const totalMs = Date.now() - startTime;
  const warmed = results.filter((r) => r.status.startsWith("warmed")).length;
  const cached = results.filter((r) => r.status === "already_cached").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return Response.json({
    warmed,
    alreadyCached: cached,
    failed,
    totalMs,
    results,
  });
}
