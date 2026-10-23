// app/api/checkpoints/bypass-attempts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get("script_id") || searchParams.get("script") || undefined;

    const attempts = await dbService.getBypassAttempts();
    const bannedIps = await dbService.getBannedIps();
    const bannedHwids = await dbService.getBannedHwids();
    const checkpointAnalytics = await dbService.getCheckpointAnalytics(scriptId);

    // Group attempts by IP and HWID for quick summary
    const ipCounts: Record<string, number> = {};
    const hwidCounts: Record<string, number> = {};

    attempts.forEach((a) => {
      if (a.ip_address) {
        ipCounts[a.ip_address] = (ipCounts[a.ip_address] || 0) + 1;
      }
      if (a.hwid) {
        hwidCounts[a.hwid] = (hwidCounts[a.hwid] || 0) + 1;
      }
    });

    const lockedIpsList = Object.entries(bannedIps).map(([ip, data]) => ({
      ip,
      reason: data.reason,
      banned_at: data.banned_at,
      attemptCount: ipCounts[ip] || 0,
    }));

    const lockedHwidsList = Object.entries(bannedHwids).map(([hwid, data]) => ({
      hwid,
      ip: data.ip_address || null,
      reason: data.reason,
      banned_at: data.banned_at,
      attemptCount: hwidCounts[hwid] || 0,
    }));

    return NextResponse.json({
      success: true,
      attempts,
      locked_ips: lockedIpsList,
      locked_hwids: lockedHwidsList,
      summary: {
        total_attempts: attempts.length,
        total_locked_ips: Object.keys(bannedIps).length,
        total_locked_hwids: Object.keys(bannedHwids).length,
        lockout_threshold: 3,
      },
      checkpoint_analytics: checkpointAnalytics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error fetching bypass records";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, ip, hwid, reason } = body;

    if (action === "ban_ip" && ip) {
      await dbService.banIp(ip, reason || "Manual IP Lockout from Admin Dashboard");
      return NextResponse.json({ success: true, message: `IP ${ip} locked out.` });
    }

    if (action === "unban_ip" && ip) {
      await dbService.unbanIp(ip);
      return NextResponse.json({ success: true, message: `IP ${ip} unlocked.` });
    }

    if (action === "ban_hwid" && hwid) {
      await dbService.banHwid(hwid, ip, reason || "Manual HWID Lockout from Admin Dashboard");
      return NextResponse.json({ success: true, message: `HWID ${hwid} locked out.` });
    }

    if (action === "unban_hwid" && hwid) {
      await dbService.unbanHwid(hwid);
      return NextResponse.json({ success: true, message: `HWID ${hwid} unlocked.` });
    }

    if (action === "clear_attempts") {
      await dbService.clearBypassAttempts({ ip, hwid });
      return NextResponse.json({ success: true, message: "Bypass attempts cleared." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error executing action";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
