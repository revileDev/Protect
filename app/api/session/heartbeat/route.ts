import { NextRequest, NextResponse } from "next/server";
import { dbService, SessionCommand } from "@/lib/store";
import { getClientIp, normalizeIp } from "@/lib/ip";
import { hmacSha256 } from "@/lib/crypto-util";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_token, place_id, place_name, job_id, tamper_flags, roblox_username, roblox_user_id } = body;

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

    const session = await dbService.updateHeartbeat(session_token, clientIp, {
      place_id,
      place_name,
      job_id,
      roblox_username,
      roblox_user_id,
    });

    // If client reported tamper flags (e.g. hookfunction detour on loadstring/pcall)
    if (Array.isArray(tamper_flags) && tamper_flags.length > 0) {
      session.tamper_flags = Array.from(new Set([...(session.tamper_flags || []), ...tamper_flags]));
      const hasCritical = tamper_flags.some((f: unknown) => typeof f === "string" && f.startsWith("CRITICAL"));
      if (hasCritical) {
        session.status = "tampered";
        const keyId = session.key_id && session.key_id !== "active" ? session.key_id : null;
        const isSessionOwner = Boolean(session.ip_address && normalizeIp(session.ip_address) === normalizeIp(clientIp));

        if (isSessionOwner && keyId) {
          await dbService.autoBanOffender(
            clientIp,
            keyId,
            `Critical Client Tampering Detected (Heartbeat): ${tamper_flags.join("; ")}`,
            { banLinkedClaimedIp: true }
          );
        } else {
          await dbService.banIp(
            clientIp,
            `Critical Client Tampering Detected (Heartbeat from unauthorized IP): ${tamper_flags.join("; ")}`
          );
        }
        return NextResponse.json({
          status: "ok",
          action: "kick",
          reason: "[AERO AUTH] Security Integrity Violation: Unauthorized hooks or memory detours detected. Access revoked.",
        });
      }
    }

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

    // 3. Expiration Tracking
    let expiresAt: string | null = null;
    let remainingSeconds: number | null = null;
    if (session.key_id && session.key_id !== "active") {
      const keys = await dbService.getKeys();
      const keyObj = keys.find((k) => k.id === session.key_id);
      if (keyObj && keyObj.expires_at) {
        expiresAt = keyObj.expires_at;
        const diffMs = new Date(keyObj.expires_at).getTime() - Date.now();
        remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
        if (diffMs <= 0) {
          return NextResponse.json({
            status: "ok",
            action: "kick",
            reason: "Your license key has expired. Please claim a new key to continue.",
            remaining_seconds: 0,
          });
        }
      }
    }

    // 4. Check for pending commands (remote kicks, announcements, code injection, teleports)
    const commands: SessionCommand[] = await dbService.clearPendingCommands(session.id);
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

    const leaseToken = hmacSha256(session.id, Date.now() + ":" + Math.random().toString(36).slice(2));

    return NextResponse.json({
      status: "ok",
      online_count: Math.max(1, onlineCount),
      action,
      reason,
      message,
      commands,
      expires_at: expiresAt,
      remaining_seconds: remainingSeconds,
      lease_token: leaseToken,
      lease_expires: Date.now() + 15000,
    });
  } catch (err: unknown) {
    // Fail OPEN: transient network hiccups should NEVER terminate player games
    return NextResponse.json({ status: "ok", action: "ok" });
  }
}
