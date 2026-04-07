/**
 * Returns a proxied image URL for Luxembourg real estate portal images.
 * Falls through to the original URL for CDN-hosted images that don't need proxying.
 */
export function getProxiedImageUrl(imageUrl: string): string {
  try {
    const parsed = new URL(imageUrl);
    const hostname = parsed.hostname;

    // These hosts typically block direct hotlinking via referrer checks
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

    // CDN-hosted images (cloudfront, cloudinary, etc.) usually work directly
    return imageUrl;
  } catch {
    return imageUrl;
  }
}
