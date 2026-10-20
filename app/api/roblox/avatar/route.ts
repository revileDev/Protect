import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let userId = searchParams.get("userId") || searchParams.get("id");
  const username = searchParams.get("username") || searchParams.get("name");

  // Fallback SVG placeholder (clean minimalist player silhouette, no robot)
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
    <rect width="150" height="150" fill="#181a24"/>
    <circle cx="75" cy="55" r="30" fill="#5865f2" opacity="0.85"/>
    <path d="M25 135 C25 98 48 88 75 88 C102 88 125 98 125 135 Z" fill="#5865f2" opacity="0.85"/>
  </svg>`;

  try {
    // If no userId, but username is provided, resolve username to userId via Roblox API
    if ((!userId || !/^\d+$/.test(userId)) && username && username !== "Anonymous" && username !== "Player") {
      try {
        const userRes = await fetch("https://users.roblox.com/v1/usernames/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
          body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: false,
          }),
          next: { revalidate: 86400 },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData?.data?.[0]?.id) {
            userId = String(userData.data[0].id);
          }
        }
      } catch (userErr) {
        console.warn("[Roblox Username Lookup Error]", userErr);
      }
    }

    if (!userId || !/^\d+$/.test(userId) || userId === "0") {
      return new NextResponse(fallbackSvg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

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
        // Fetch actual image bytes to prevent cross-origin referrer blocks in browser
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
              "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
            },
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Roblox Avatar Proxy Error]", err);
  }

  return new NextResponse(fallbackSvg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
