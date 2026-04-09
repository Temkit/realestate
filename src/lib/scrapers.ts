import type { ScrapedListing } from "./types";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,de;q=0.7",
  "Accept-Encoding": "identity",
};

/**
 * Classify a URL as "category" (list page), "listing" (individual property), or "skip".
 */
export function classifyUrl(url: string): "category" | "listing" | "skip" {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    const isPortal =
      hostname.includes("immotop.lu") ||
      hostname.includes("wortimmo.lu") ||
      hostname.includes("athome.lu") ||
      hostname.includes("immobilier.lu") ||
      hostname.includes("vivi.lu") ||
      hostname.includes("habiter.lu") ||
      hostname.includes("remax.lu") ||
      hostname.includes("engelvoelkers.com");

    if (!isPortal) return "skip";

    // URLs with a 4+ digit numeric ID are individual listings
    if (/\d{4,}/.test(path)) return "listing";

    // Portal URLs without numeric IDs are category pages (search results / filters)
    if (hostname.includes("immotop.lu") || hostname.includes("wortimmo.lu")) {
      return "category";
    }

    // athome.lu category pages have paths like /rent/apartment/...
    if (hostname.includes("athome.lu") && path.length > 1) {
      return "category";
    }

    return "skip";
  } catch {
    return "skip";
  }
}

/**
 * Scrape an immotop.lu / wortimmo.lu category page by parsing __NEXT_DATA__.
 * Returns an array of ScrapedListing extracted from the embedded JSON.
 */
export async function scrapeImmotopCategoryPage(url: string): Promise<ScrapedListing[]> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!resp.ok) return [];

    const html = await resp.text();
    const hostname = new URL(url).hostname;

    const nextDataMatch = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!nextDataMatch) return [];

    const nextData = JSON.parse(nextDataMatch[1]);
    const queries =
      nextData?.props?.pageProps?.dehydratedState?.queries || [];
    const listings: ScrapedListing[] = [];

    for (const q of queries) {
      const results =
        q?.state?.data?.results || q?.state?.data?.realEstates || [];
      if (!Array.isArray(results)) continue;

      for (const item of results) {
        const seoUrl = item?.seo?.url;
        if (!seoUrl) continue;

        const fullUrl = seoUrl.startsWith("http")
          ? seoUrl
          : `https://${hostname}${seoUrl}`;

        // Only accept listing URLs with numeric IDs
        if (!/\/annonces\/\d{4,}/.test(fullUrl) && !/\d{4,}/.test(fullUrl))
          continue;

        const re = item?.realEstate || item;
        const props = re?.properties?.[0] || {};
        const priceValue = re?.price?.value || props?.price?.value || 0;
        const surfaceRaw = props?.surface || "";
        const surfaceNum =
          typeof surfaceRaw === "number"
            ? surfaceRaw
            : parseInt(String(surfaceRaw).replace(/[^\d]/g, "")) || 0;
        const contractRaw = re?.contract || "";
        const contractType: "rent" | "buy" =
          contractRaw === "rent" || contractRaw === "location"
            ? "rent"
            : "buy";

        const city =
          props?.location?.city || props?.location?.commune || "";
        const photoUrl = props?.photo?.urls?.medium || null;
        const title = re?.title || "";
        const rooms =
          props?.rooms || props?.numberOfRooms || props?.bedrooms || 0;
        const bathrooms = props?.bathrooms || 0;

        // Determine property type from title
        const propertyType = detectPropertyType(title);

        listings.push({
          url: fullUrl,
          source: hostname.replace("www.", ""),
          price: priceValue,
          surface: surfaceNum,
          rooms: typeof rooms === "number" ? rooms : parseInt(rooms) || 0,
          bathrooms:
            typeof bathrooms === "number"
              ? bathrooms
              : parseInt(bathrooms) || 0,
          propertyType,
          city,
          address: city, // category pages usually only have city-level location
          imageUrl: photoUrl,
          contractType,
          description: title,
        });
      }
    }

    return listings;
  } catch {
    return [];
  }
}

/**
 * Scrape an individual listing page for property data.
 * Tries embedded JSON first, then falls back to og: meta tags.
 */
export async function scrapeListingPage(
  url: string
): Promise<ScrapedListing | null> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!resp.ok) return null;

    // Stream read up to 150KB to avoid downloading full pages
    const reader = resp.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    const maxBytes = 150_000;

    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const hostname = new URL(url).hostname.replace("www.", "");

    // Try embedded JSON data (immotop.lu / wortimmo.lu pattern)
    let price = 0;
    let contract: "rent" | "buy" = "buy";
    let surface = 0;
    let rooms = 0;
    let bathrooms = 0;

    const priceMatch = html.match(/"price":\{"visible":true,"value":(\d+)/);
    if (priceMatch) price = parseInt(priceMatch[1]);

    const contractMatch = html.match(
      /"contract":"(rent|sale|buy|location|vente)"/i
    );
    if (contractMatch) {
      const val = contractMatch[1].toLowerCase();
      contract = val === "rent" || val === "location" ? "rent" : "buy";
    }

    const surfaceMatch = html.match(
      /"(?:surface|surfaceValue|floorSize|area)":"?([\d.,]+)\s*m?²?"?/
    );
    if (surfaceMatch) {
      surface = parseFloat(surfaceMatch[1].replace(",", ".")) || 0;
    }
    // Also try numeric surface fields
    if (!surface) {
      const surfaceNumMatch = html.match(
        /"(?:surface|surfaceValue|floorSize|area)":(\d+)/
      );
      if (surfaceNumMatch) surface = parseInt(surfaceNumMatch[1]);
    }

    const roomsMatch = html.match(
      /"(?:rooms|numberOfRooms|bedrooms)":(\d+)/
    );
    if (roomsMatch && parseInt(roomsMatch[1]) > 0) {
      rooms = parseInt(roomsMatch[1]);
    }

    const bathroomsMatch = html.match(/"bathrooms":(\d+)/);
    if (bathroomsMatch) bathrooms = parseInt(bathroomsMatch[1]);

    // Extract og:image
    let imageUrl = extractMeta(html, "og:image");
    if (imageUrl && !isPropertyImage(imageUrl)) imageUrl = null;
    if (!imageUrl) {
      const twitterImg = extractMeta(html, "twitter:image");
      if (twitterImg && isPropertyImage(twitterImg)) imageUrl = twitterImg;
    }

    // Extract og:title
    const ogTitle = extractMeta(html, "og:title") || "";

    // Parse title for additional data
    const titleParsed = parseTitleForData(ogTitle);
    if (!price && titleParsed.price) price = titleParsed.price;
    if (!surface && titleParsed.surface) surface = titleParsed.surface;
    if (!rooms && titleParsed.rooms) rooms = titleParsed.rooms;
    if (titleParsed.contractType) contract = titleParsed.contractType;

    const propertyType = titleParsed.propertyType || detectPropertyType(ogTitle);

    // Extract city from __NEXT_DATA__ or og:title
    let city = "";
    const cityMatch = html.match(
      /"location":\{[^}]*"city":"([^"]+)"/
    );
    if (cityMatch) city = cityMatch[1];
    if (!city) {
      // Try to get city from og:title (e.g., "Bureau | Mondorf-Les-Bains")
      const parts = ogTitle.split(/[|•]/);
      if (parts.length >= 2) city = parts[1].trim();
    }

    // Must have at least a price or URL to be useful
    if (price === 0 && !imageUrl && !ogTitle) return null;

    return {
      url,
      source: hostname,
      price,
      surface,
      rooms,
      bathrooms,
      propertyType,
      city,
      address: city,
      imageUrl: imageUrl || null,
      contractType: contract,
      description: ogTitle || "",
    };
  } catch {
    return null;
  }
}

/**
 * Parse athome.lu search result titles for property data.
 * Format: "Bureau à louer - Mondorf-Les-Bains - 165 m² - 3 900 - atHome.lu"
 */
export function parseSearchResultTitle(
  title: string,
  url: string
): Partial<ScrapedListing> | null {
  if (!title) return null;

  const lower = title.toLowerCase();

  // Detect contract type
  let contractType: "rent" | "buy" = "buy";
  if (/\b(louer|location|rent|à louer|en location|for rent)\b/i.test(lower)) {
    contractType = "rent";
  }

  // Detect property type
  const propertyType = detectPropertyType(title);

  // Extract price — look for numbers at end or after last bullet
  let price = 0;
  // Pattern: "3 900" or "3.900" or "850000" near end
  const pricePatterns = [
    /(\d[\d\s.,]*\d)\s*(?:€|eur)/i,
    /[•\-]\s*(\d[\d\s.,]*)\s*(?:-\s*atHome|$)/i,
    /(\d{3,}[\d\s.,]*)\s*$/,
  ];
  for (const pattern of pricePatterns) {
    const m = title.match(pattern);
    if (m) {
      price = parseInt(m[1].replace(/[\s.,]/g, "")) || 0;
      if (price > 0) break;
    }
  }

  // Extract surface
  let surface = 0;
  const surfaceMatch = title.match(/([\d.,]+)\s*m²/i);
  if (surfaceMatch) {
    surface = parseFloat(surfaceMatch[1].replace(",", ".")) || 0;
  }

  // Extract city from title (typically second segment separated by bullets or dashes)
  let city = "";
  const segments = title.split(/[•\-|]/);
  if (segments.length >= 2) {
    city = segments[1].trim();
    // Remove "atHome.lu" if it leaked into city
    if (/athome/i.test(city)) city = "";
  }

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "athome.lu";
    }
  })();

  return {
    url,
    source: hostname,
    price,
    surface,
    propertyType,
    city,
    address: city,
    contractType,
    description: title.replace(/\s*-\s*atHome\.lu\s*$/i, "").trim(),
    rooms: 0,
    bathrooms: 0,
    imageUrl: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectPropertyType(text: string): string {
  const lower = text.toLowerCase();
  if (/bureau|office|cabinet/i.test(lower)) return "Office";
  if (/appartement|apartment|flat/i.test(lower)) return "Apartment";
  if (/maison|house|villa/i.test(lower)) return "House";
  if (/studio/i.test(lower)) return "Studio";
  if (/terrain|land/i.test(lower)) return "Land";
  if (/commerce|commercial|retail|magasin/i.test(lower)) return "Commercial";
  if (/duplex/i.test(lower)) return "Duplex";
  if (/penthouse/i.test(lower)) return "Penthouse";
  if (/loft/i.test(lower)) return "Loft";
  if (/garage|parking/i.test(lower)) return "Parking";
  return "Property";
}

function parseTitleForData(title: string): {
  price: number;
  surface: number;
  rooms: number;
  propertyType: string;
  contractType: "rent" | "buy" | null;
} {
  const lower = title.toLowerCase();

  let contractType: "rent" | "buy" | null = null;
  if (/\b(location|louer|rent|en location|à louer|for rent)\b/i.test(lower)) {
    contractType = "rent";
  } else if (/\b(vente|vendre|sale|buy|à vendre|for sale)\b/i.test(lower)) {
    contractType = "buy";
  }

  let rooms = 0;
  const roomMatch = lower.match(/(\d+)\s*(?:rooms?|chambres?|pièces?|ch\b)/);
  if (roomMatch) rooms = parseInt(roomMatch[1]);
  if (!rooms) {
    const dashRoom = lower.match(/(\d+)-room/);
    if (dashRoom) rooms = parseInt(dashRoom[1]);
  }

  let surface = 0;
  const sqmMatch = title.match(/([\d.,]+)\s*m²/i);
  if (sqmMatch) surface = parseFloat(sqmMatch[1].replace(",", "."));

  let price = 0;
  const priceMatch = title.match(/([\d\s.,]+)\s*€/);
  if (priceMatch) price = parseInt(priceMatch[1].replace(/[\s.,]/g, "")) || 0;

  const propertyType = detectPropertyType(title);

  return { price, surface, rooms, propertyType, contractType };
}

function extractMeta(html: string, property: string): string | null {
  const p1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const p2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );
  const match = html.match(p1) || html.match(p2);
  if (match?.[1] && match[1].startsWith("http")) return match[1];
  // For non-URL metas (titles etc), return as-is
  if (match?.[1]) return match[1];
  return null;
}

function isPropertyImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    /logo|favicon|icon|placeholder|default|banner|sprite|no[-_]?image/i.test(
      lower
    )
  )
    return false;
  if (/\/\d{1,2}x\d{1,2}[/.]/i.test(lower)) return false;
  if (lower.endsWith(".svg")) return false;
  return lower.startsWith("http");
}
