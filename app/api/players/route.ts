// app/api/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }
  const sessions = await dbService.getSessions();
  const bannedIps = await dbService.getBannedIps();

  const now = Date.now();
  const HEARTBEAT_TIMEOUT_MS = 5000; // After 5 seconds of no heartbeat, user is determined disconnected
  const DISCONNECT_REMOVAL_GRACE_MS = 5000; // Show "Disconnected" for 5 seconds before removing player card

  const enriched = [];
  const deadSessionIds: string[] = [];

  for (const s of sessions) {
    if (s.id && s.id.startsWith("staff_review")) continue;
    const lastPing = new Date(s.last_heartbeat).getTime();
    const startTime = new Date(s.session_started).getTime();
    const pingElapsed = Math.max(0, now - lastPing);

    // After 5 seconds if no heartbeat, determine user is no longer using the script
    const isTimedOut = pingElapsed >= HEARTBEAT_TIMEOUT_MS;
    const isOnline = s.status === "active" && !isTimedOut;

    // Freeze timer when disconnected! Do not put the timer on them once quit
    const effectiveEndTime = isOnline ? now : lastPing;
    const durationSeconds = Math.max(0, Math.floor((effectiveEndTime - startTime) / 1000));

    // Time since disconnection was triggered
    const timeSinceDisconnect = isTimedOut ? pingElapsed - HEARTBEAT_TIMEOUT_MS : 0;

    // If disconnected for more than grace period, omit card from active dashboard tab
    // BUT DO NOT delete from DB so lag spikes never terminate player games!
    if (isTimedOut && timeSinceDisconnect > DISCONNECT_REMOVAL_GRACE_MS) {
      continue;
    }

    const derivedStatus = isOnline
      ? "active"
      : s.status === "kicked"
      ? "kicked"
      : "disconnected";

    enriched.push({
      ...s,
      status: derivedStatus,
      is_online: isOnline,
      duration_seconds: durationSeconds,
      is_banned: Boolean(bannedIps[s.ip_address]),
      last_ping_sec: Math.floor(pingElapsed / 1000),
      time_since_disconnect_sec: Math.floor(timeSinceDisconnect / 1000),
    });
  }

  const staffReviews = await dbService.getStaffReviews();
  const staffActive = staffReviews
    .filter((r) => {
      const pingElapsed = now - new Date(r.last_heartbeat).getTime();
      return r.status === "reviewing" && pingElapsed <= 6000;
    })
    .map((r) => {
      const startTime = new Date(r.review_started).getTime();
      return {
        ...r,
        duration_seconds: Math.max(0, Math.floor((now - startTime) / 1000)),
        is_reviewing: true,
      };
    });

  return NextResponse.json({
    sessions: enriched,
    banned_ips: bannedIps,
    staff_active: staffActive,
    staff_history: staffReviews,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

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

    if (action === "remove_card" || action === "delete_session") {
      if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
      await dbService.deleteSession(session_id);
      return NextResponse.json({ success: true, message: "Player card removed." });
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

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id") || searchParams.get("id");
    if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    await dbService.deleteSession(sessionId);
    return NextResponse.json({ success: true, message: "Player card deleted." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error deleting player card";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
