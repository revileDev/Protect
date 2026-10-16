// app/api/ip-bans/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const bannedIps = await dbService.getBannedIps();
    return NextResponse.json({ banned_ips: bannedIps });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching banned IPs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ip_address, reason } = body;

    if (!ip_address || typeof ip_address !== "string" || !ip_address.trim()) {
      return NextResponse.json({ error: "A valid IP address is required." }, { status: 400 });
    }

    const cleanIp = ip_address.trim();
    const banReason = reason && typeof reason === "string" && reason.trim()
      ? reason.trim()
      : "Manual IP ban from Admin Dashboard";

    await dbService.banIp(cleanIp, banReason);

    return NextResponse.json({
      success: true,
      message: `IP ${cleanIp} has been permanently blacklisted.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error banning IP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    let ip = searchParams.get("ip_address") || searchParams.get("ip");

    if (!ip) {
      try {
        const body = await req.json();
        ip = body.ip_address || body.ip;
      } catch {
        // query param fallback
      }
    }

    if (!ip || typeof ip !== "string" || !ip.trim()) {
      return NextResponse.json({ error: "A valid IP address is required to unban." }, { status: 400 });
    }

    const cleanIp = ip.trim();
    await dbService.unbanIp(cleanIp);

    return NextResponse.json({
      success: true,
      message: `IP ${cleanIp} has been unbanned.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error unbanning IP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
