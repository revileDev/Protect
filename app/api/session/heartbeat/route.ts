import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { getClientIp } from "@/lib/ip";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_token } = body;

    if (!session_token) {
      // Return ok instead of 400 so transient executor pings never terminate players
      return NextResponse.json({ status: "ok", action: "ok" });
    }

    // Staff review sessions: keep reviewing timer updated, completely anonymous, always succeed
    if (typeof session_token === "string" && session_token.startsWith("staff_review")) {
      await dbService.updateStaffReviewHeartbeat(session_token);
      return NextResponse.json({ status: "ok", action: "ok", is_staff: true, online_users: 1 });
    }

    const clientIp = getClientIp(req);

    const session = await dbService.updateHeartbeat(session_token, clientIp);

    // 1. Check if explicitly kicked by admin
    if (session.status === "kicked") {
      return NextResponse.json({
        status: "ok",
        action: "kick",
        reason: "You were kicked by the dashboard administrator.",
      });
    }

    // 2. Check if IP was banned while in-game
    const isBanned = await dbService.isIpBanned(session.ip_address || clientIp);
    if (isBanned) {
      return NextResponse.json({
        status: "ok",
        action: "kick",
        reason: "Your IP address was banned by an administrator.",
      });
    }

    // 3. Check for pending commands (remote kicks, dismissable billboard messages)
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
    // Fail OPEN: transient network hiccups should NEVER terminate player games
    return NextResponse.json({ status: "ok", action: "ok" });
  }
}
