// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthed = isValidSessionToken(session);

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
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
