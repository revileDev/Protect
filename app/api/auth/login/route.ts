import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400, headers: corsHeaders });
    }

    if (!verifyCredentials(username.trim(), password.trim())) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401, headers: corsHeaders });
    }

    const sessionToken = createSessionToken();
    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      redirect: "/dashboard/scripts",
    }, { headers: corsHeaders });
    const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
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
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
