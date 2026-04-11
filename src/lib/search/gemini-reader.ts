/**
 * Gemini URL Context — reads listing pages in batch via Gemini's url_context tool.
 * Extracts price, surface, type, city, mode, address, rooms from up to 20 URLs in one call.
 * Does NOT extract images (Gemini fabricates image URLs).
 */

import type { ScrapedListing } from "@/lib/types";

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

/**
 * Read multiple listing URLs in a single Gemini call using URL Context.
 * Returns ScrapedListing[] with data extracted from the pages.
 * imageUrl is always null — Gemini fabricates images, never trust them.
 */
export async function geminiReadUrls(
  urls: string[]
): Promise<ScrapedListing[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || urls.length === 0) return [];

  const urlList = urls.map((u, i) => `${i + 1}. ${u}`).join("\n");

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Read these listing pages. For EACH return one line:\nURL | PRICE (number only in euros) | SURFACE (m² number only, realistic: studio 20-50, apartment 40-200, house 80-400, office 10-500) | TYPE | CITY | MODE (rent or buy) | ADDRESS | ROOMS (number, 0 if unknown)\n\n${urlList}\n\nReturn ONLY the lines, no other text.`,
                },
              ],
            },
          ],
          tools: [{ url_context: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!resp.ok) return [];

    const data = await resp.json();
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text)
        .join("") || "";

    const results: ScrapedListing[] = [];
    for (const line of text.split("\n")) {
      const parts = line.split("|").map((s: string) => s.trim());
      if (parts.length < 6) continue;

      const url = parts[0].replace(/^\d+\.\s*/, "").trim();
      if (!url.startsWith("http")) continue;

      const price = parseInt((parts[1] || "0").replace(/[^\d]/g, "")) || 0;
      const surface = parseInt((parts[2] || "0").replace(/[^\d]/g, "")) || 0;
      if (price === 0 && surface === 0) continue;

      const mode = /rent|location|louer|mois/i.test(parts[5] || "")
        ? ("rent" as const)
        : ("buy" as const);
      const hostname = new URL(url).hostname.replace("www.", "");

      results.push({
        url,
        source: hostname,
        price,
        surface,
        rooms: parseInt(parts[7] || "0") || 0,
        bathrooms: 0,
        propertyType: parts[3] || "Property",
        city: parts[4] || "",
        address: parts[6] || parts[4] || "",
        imageUrl: null,
        contractType: mode,
        description: "",
      });
    }
    return results;
  } catch {
    return [];
  }
}
