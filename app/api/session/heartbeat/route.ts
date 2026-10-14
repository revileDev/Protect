// app/api/session/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_token } = body;

    if (!session_token) {
      return NextResponse.json({ error: "Missing session_token" }, { status: 400 });
    }

    const session = await dbService.updateHeartbeat(session_token);
    if (!session) {
      return NextResponse.json({ error: "Session invalid or expired" }, { status: 403 });
    }

    if (session.status === "kicked") {
      return NextResponse.json({
        action: "kick",
        reason: "You were kicked by the dashboard administrator.",
      });
    }

    // Check if IP was banned while in-game
    const isBanned = await dbService.isIpBanned(session.ip_address);
    if (isBanned) {
      return NextResponse.json({
        action: "kick",
        reason: "Your IP address was banned by an administrator.",
      });
    }

    // Check for pending commands (remote kicks, dismissable billboard messages)
    const commands = await dbService.clearPendingCommands(session.id);
    let action = "ok";
    let message: string | undefined;
    let reason: string | undefined;

    for (const cmd of commands) {
      if (cmd.type === "kick") {
        action = "kick";
        reason = cmd.reason || "Kicked by admin";
        break;
      } else if (cmd.type === "message") {
        action = "message";
        message = cmd.message;
      }
    }

    // Calculate live online user count (active within last 5 seconds)
    const allSessions = await dbService.getSessions();
    const threshold = Date.now() - 5000;
    const onlineCount = allSessions.filter((s) => {
      const pingTime = new Date(s.last_heartbeat).getTime();
      return s.status === "active" && pingTime >= threshold;
    }).length;

    return NextResponse.json({
      status: "ok",
      online_count: Math.max(1, onlineCount),
      action,
      reason,
      message,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Heartbeat error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
