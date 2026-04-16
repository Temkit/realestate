/**
 * Gemini URL Context — reads listing pages in batch via Gemini's url_context tool.
 * Extracts price, surface, type, city, mode, address, rooms, bathrooms, description.
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
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Read these real estate listing pages. For EACH return one line with fields separated by |

FORMAT: URL | PRICE | SURFACE | TYPE | CITY | MODE | ADDRESS | ROOMS | BATHROOMS | DESCRIPTION

RULES:
- PRICE: number only in euros, no decimals (e.g. 750000 or 2600)
- SURFACE: m² number only. Realistic ranges: studio 15-50, apartment 40-200, house 80-400, office 10-500. If the page shows an unrealistic number, use 0.
- TYPE: apartment, house, office, studio, land, commercial, duplex, penthouse
- CITY: exact city/commune name as shown on the page
- MODE: "rent" or "buy"
- ADDRESS: full street address if shown, otherwise neighborhood or city
- ROOMS: number of bedrooms/rooms, 0 if unknown
- BATHROOMS: number of bathrooms/salle de bain, 0 if unknown
- DESCRIPTION: first 1-2 sentences describing the property (max 150 chars). Copy from the listing, do NOT invent.

${urlList}

Return ONLY the data lines, no headers, no explanation.`,
                },
              ],
            },
          ],
          tools: [{ url_context: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 4000 },
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

      let hostname = "";
      try { hostname = new URL(url).hostname.replace("www.", ""); } catch { /* skip */ }

      const rooms = parseInt((parts[7] || "0").replace(/[^\d]/g, "")) || 0;
      const bathrooms = parseInt((parts[8] || "0").replace(/[^\d]/g, "")) || 0;
      const description = (parts[9] || "").slice(0, 200);

      results.push({
        url,
        source: hostname,
        price,
        surface,
        rooms,
        bathrooms,
        propertyType: parts[3] || "Property",
        city: parts[4] || "",
        address: parts[6] || parts[4] || "",
        imageUrl: null,
        contractType: mode,
        description,
      });
    }
    return results;
  } catch {
    return [];
  }
}
