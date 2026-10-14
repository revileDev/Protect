// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, AUTH_COOKIE_NAME, AUTH_TOKEN_VALUE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    if (!verifyCredentials(username.trim(), password.trim())) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, redirect: "/dashboard/scripts" });
    const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: AUTH_TOKEN_VALUE,
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Login route error:", err);
    const msg = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
