// app/api/checkpoints/gateway/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { antiBypassService } from "@/lib/anti-bypass";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gt = searchParams.get("gt") || searchParams.get("token");
    const ip = getClientIp(req);

    if (gt) {
      const result = antiBypassService.resolveGateway(gt, ip);
      if (result.success && result.targetUrl) {
        // Instant 307 redirect to target external URL (YouTube, Discord, Linkvertise, Lootlabs, etc.)
        return NextResponse.redirect(result.targetUrl, 307);
      }
    }

    // Backwards compatibility for older format with session/step/token
    const session = searchParams.get("session");
    const step = searchParams.get("step");
    if (session && step !== null && gt) {
      const result = antiBypassService.registerGatewayVisit(session, Number(step), gt, ip);
      if (result.success && result.targetUrl) {
        return NextResponse.redirect(result.targetUrl, 307);
      }
    }

    // Clean, user-friendly fallback if token is expired or malformed
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gateway Link Expired - AtomProtect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #121217;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .icon {
      width: 52px;
      height: 52px;
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fb7185;
      font-size: 22px;
      margin-bottom: 18px;
    }
    h2 {
      font-size: 19px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }
    p {
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 12px 20px;
      background: #ffffff;
      color: #09090b;
      font-size: 13px;
      font-weight: 600;
      border-radius: 12px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #e4e4e7;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h2>Checkpoint Link Expired</h2>
    <p>This task gateway link has expired or is invalid. Please return to the claim page and click <strong>Visit Task</strong> again to continue.</p>
    <a href="/claim" class="btn">Return to Claim Page</a>
  </div>
</body>
</html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err: unknown) {
    return new NextResponse("Internal Gateway Error", { status: 500 });
  }
}
