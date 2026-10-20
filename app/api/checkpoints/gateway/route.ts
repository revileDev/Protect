// app/api/checkpoints/gateway/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { antiBypassService } from "@/lib/anti-bypass";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session = searchParams.get("session");
    const step = searchParams.get("step");
    const token = searchParams.get("token");
    const ip = getClientIp(req);

    if (!session || step === null || !token) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0d0d12;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;max-width:400px;padding:20px;border:1px solid #333;border-radius:12px;"><h2>Invalid Gateway Link</h2><p style="color:#aaa;">Missing checkpoint session parameters. Please return to the claim page and try again.</p></div></body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const result = antiBypassService.registerGatewayVisit(
      session,
      Number(step),
      token,
      ip
    );

    if (!result.success || !result.targetUrl) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0d0d12;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;max-width:400px;padding:20px;border:1px solid #e11d48;border-radius:12px;"><h2 style="color:#f43f5e;">Access Blocked</h2><p style="color:#aaa;">${
          result.error || "Gateway validation failed."
        }</p></div></body></html>`,
        { status: 403, headers: { "Content-Type": "text/html" } }
      );
    }

    // Redirect to the actual task URL (YouTube, Discord, Linkvertise, Lootlabs, etc.)
    return NextResponse.redirect(result.targetUrl, 307);
  } catch (err: unknown) {
    return new NextResponse("Internal Gateway Error", { status: 500 });
  }
}
