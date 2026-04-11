/**
 * og:fetch — free HTTP fetch to extract og:image, og:title, and parse price/surface
 * from meta tags. Works on 3 of 4 portals (not athome which is JS-rendered).
 * Cached 7 days in Redis.
 */

import { getOgCache, setOgCache } from "@/lib/search-cache";
import type { OgData } from "@/lib/search-cache";

export type { OgData };

/**
 * Fetch og:image and og:title from a URL's HTML meta tags.
 * Streams only the first 50KB (enough for <head> section).
 * Returns cached data if available.
 */
export async function fetchOgTags(url: string): Promise<OgData | null> {
  const cached = await getOgCache(url);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });
    if (!resp.ok) return null;

    const reader = resp.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const ogImage =
      (
        html.match(/property="og:image"[^>]*content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"[^>]*property="og:image"/i) ||
        []
      )[1] || null;

    const ogTitle =
      (
        html.match(/property="og:title"[^>]*content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"[^>]*property="og:title"/i) ||
        []
      )[1] || null;

    let price = 0;
    let surface = 0;
    if (ogTitle) {
      const pm = ogTitle.match(/([\d\s.]+)\s*€/);
      if (pm) price = parseInt(pm[1].replace(/[\s.]/g, ""));
      const sm = ogTitle.match(/(\d{2,})\s*m[²2]/);
      if (sm) surface = parseInt(sm[1]);
    }

    const validImg =
      ogImage && !/logo|favicon|icon/i.test(ogImage) ? ogImage : null;
    const result: OgData = {
      ogImage: validImg,
      ogTitle,
      price,
      surface,
    };
    await setOgCache(url, result);
    return result;
  } catch {
    return null;
  }
}
