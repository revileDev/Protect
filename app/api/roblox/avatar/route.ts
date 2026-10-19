import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || searchParams.get("id");

  if (!userId || !/^\d+$/.test(userId)) {
    return new NextResponse("Invalid user ID", { status: 400 });
  }

  try {
    const thumbUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`;
    const res = await fetch(thumbUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const targetUrl = data?.data?.[0]?.imageUrl;

      if (targetUrl) {
        // Fetch actual image bytes to avoid third-party cross-origin referrer restrictions
        const imgRes = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });

        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
            },
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Roblox Avatar Proxy Error]", err);
  }

  // Fallback to default avatar SVG
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
    <rect width="150" height="150" fill="#1e2230"/>
    <circle cx="75" cy="55" r="30" fill="#4a5568"/>
    <path d="M25 135 C25 100 50 90 75 90 C100 90 125 100 125 135 Z" fill="#4a5568"/>
  </svg>`;

  return new NextResponse(fallbackSvg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
