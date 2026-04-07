import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "athome.lu",
  "www.athome.lu",
  "immotop.lu",
  "www.immotop.lu",
  "wortimmo.lu",
  "www.wortimmo.lu",
  "immobilier.lu",
  "www.immobilier.lu",
  "vivi.lu",
  "www.vivi.lu",
  "habiter.lu",
  "www.habiter.lu",
  "remax.lu",
  "www.remax.lu",
  "engelvoelkers.com",
  "www.engelvoelkers.com",
]);

function isAllowedHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Allow any subdomain of allowed hosts (e.g. img.athome.lu, cdn.immotop.lu)
    const hostname = parsed.hostname;
    if (ALLOWED_HOSTS.has(hostname)) return true;
    // Check if it's a subdomain of an allowed host
    for (const allowed of ALLOWED_HOSTS) {
      if (hostname.endsWith(`.${allowed}`)) return true;
    }
    // Also allow common CDNs that host real estate images
    if (
      hostname.endsWith(".cloudfront.net") ||
      hostname.endsWith(".amazonaws.com") ||
      hostname.endsWith(".akamaized.net") ||
      hostname.endsWith(".cloudinary.com") ||
      hostname.endsWith(".imgix.net")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  if (!isAllowedHost(url)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": new URL(url).origin + "/",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
