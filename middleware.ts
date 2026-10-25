// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight options
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    return response;
  }

  // Check authentication via cookie OR Authorization Bearer header
  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let isAuthed = isValidSessionToken(session);

  if (!isAuthed) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.substring(7).trim();
      isAuthed = isValidSessionToken(bearerToken);
    }
  }

  // Protect /dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!isAuthed) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect sensitive management APIs (except public execution/loader/claim/login endpoints)
  const isProtectedApi =
    pathname.startsWith("/api/keys") ||
    pathname.startsWith("/api/players") ||
    pathname.startsWith("/api/loader-configs") ||
    pathname.startsWith("/api/analytics") ||
    (pathname.startsWith("/api/scripts") && request.method !== "GET") ||
    (pathname.startsWith("/api/settings") && request.method !== "GET") ||
    (pathname === "/api/checkpoints" && request.method !== "GET") ||
    (pathname.startsWith("/api/checkpoints/bypass-attempts") && request.method === "GET") ||
    (pathname.startsWith("/api/creator-profile") && request.method !== "GET");

  if (isProtectedApi && !isAuthed) {
    const errRes = NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    errRes.headers.set("Access-Control-Allow-Origin", "*");
    return errRes;
  }

  const res = NextResponse.next();
  if (pathname.startsWith("/api/")) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
