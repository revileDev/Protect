// app/api/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export async function GET() {
  const sessions = await dbService.getSessions();
  const bannedIps = await dbService.getBannedIps();

  // Annotate sessions with live status and active duration
  const now = Date.now();
  const enriched = sessions.map((s) => {
    const lastPing = new Date(s.last_heartbeat).getTime();
    const isOnline = s.status === "active" && now - lastPing < 6000;
    const durationSeconds = Math.max(0, Math.floor((now - new Date(s.session_started).getTime()) / 1000));
    return {
      ...s,
      is_online: isOnline,
      duration_seconds: durationSeconds,
      is_banned: Boolean(bannedIps[s.ip_address]),
    };
  });

  return NextResponse.json({
    sessions: enriched,
    banned_ips: bannedIps,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, session_id, ip_address, reason, message } = body;

    if (action === "kick") {
      if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
      await dbService.addSessionCommand(session_id, {
        type: "kick",
        reason: reason || "Kicked by dashboard administrator.",
      });
      return NextResponse.json({ success: true, message: "Player kicked." });
    }

    if (action === "message") {
      if (!session_id || !message) return NextResponse.json({ error: "Missing session_id or message" }, { status: 400 });
      await dbService.addSessionCommand(session_id, {
        type: "message",
        message,
      });
      return NextResponse.json({ success: true, message: "Message dispatched." });
    }

    if (action === "ban_ip") {
      if (!ip_address) return NextResponse.json({ error: "Missing ip_address" }, { status: 400 });
      await dbService.banIp(ip_address, reason || "Manual IP ban from Players dashboard");
      return NextResponse.json({ success: true, message: `IP ${ip_address} has been banned.` });
    }

    if (action === "unban_ip") {
      if (!ip_address) return NextResponse.json({ error: "Missing ip_address" }, { status: 400 });
      await dbService.unbanIp(ip_address);
      return NextResponse.json({ success: true, message: `IP ${ip_address} unbanned.` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error executing player action";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
