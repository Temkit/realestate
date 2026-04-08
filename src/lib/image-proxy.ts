/**
 * CDN subdomain patterns that typically serve images without referrer checks.
 * og:image URLs from listing pages are usually on these CDN hosts.
 */
const CDN_PATTERNS = /(?:^|\.)(?:static|pic|img|cdn|images|media|photos|assets|uploads)\./i;

/**
 * Returns a proxied image URL for Luxembourg real estate portal images.
 * Falls through to the original URL for CDN-hosted images that don't need proxying.
 */
export function getProxiedImageUrl(imageUrl: string): string {
  try {
    const parsed = new URL(imageUrl);
    const hostname = parsed.hostname;

    // CDN subdomains (e.g. i1.static.athome.eu, pic.immotop.lu) don't check referrer
    if (CDN_PATTERNS.test(hostname)) {
      return imageUrl;
    }

    // These main-domain hosts typically block direct hotlinking via referrer checks
    const needsProxy =
      hostname.endsWith("athome.lu") ||
      hostname.endsWith("immotop.lu") ||
      hostname.endsWith("wortimmo.lu") ||
      hostname.endsWith("immobilier.lu") ||
      hostname.endsWith("vivi.lu") ||
      hostname.endsWith("habiter.lu") ||
      hostname.endsWith("remax.lu") ||
      hostname.endsWith("engelvoelkers.com");

    if (needsProxy) {
      return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }

    // Everything else (cloudfront, cloudinary, etc.) usually works directly
    return imageUrl;
  } catch {
    return imageUrl;
  }
}
