/**
 * Firecrawl image fallback — fetches images for URLs that have no og:image.
 * Only called for URLs where og:fetch returned no image (mainly athome.lu).
 * Cached 7 days in Redis. Max 3 Firecrawl calls per search to control costs.
 */

import { getImageCache, setImageCache } from "@/lib/search-cache";

/**
 * Fetch images for URLs using Firecrawl. Checks Redis cache first.
 * Returns a map of URL → image URL.
 */
export async function firecrawlForImages(
  urls: string[]
): Promise<Record<string, string>> {
  if (urls.length === 0) return {};
  const images: Record<string, string> = {};

  // Check cache first
  const uncachedUrls: string[] = [];
  for (const url of urls) {
    const cached = await getImageCache(url);
    if (cached) {
      images[url] = cached;
    } else {
      uncachedUrls.push(url);
    }
  }
  if (uncachedUrls.length === 0) return images;

  try {
    const Firecrawl = (await import("firecrawl")).default;
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return images;
    const app = new Firecrawl({ apiKey });

    for (const url of uncachedUrls.slice(0, 6)) {
      try {
        const result = await app.scrape(url);
        const meta = result.metadata || {};
        const md = result.markdown || "";
        const ogImg = meta.ogImage as string | undefined;
        const mdImg = md.match(
          /!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp)[^)]*)\)/i
        )?.[1];
        const img = ogImg || mdImg;
        if (img && !/logo|favicon|icon/i.test(img)) {
          images[url] = img;
          await setImageCache(url, img);
        }
      } catch {
        /* skip failed */
      }
    }
    return images;
  } catch {
    return images;
  }
}
