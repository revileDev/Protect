// app/api/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  // Periodic throttled DB cleanup of truly stale sessions (90s cutoff, runs at most once every 60s)
  dbService.markStaleSessionsDisconnected(90000).catch(() => {});

  const ACTIVE_TIMEOUT_MS = 35000; // 35s resilient window (buffers Roblox executor lag, asset loading, and server transitions)
  const sessions = await dbService.getSessions({ activeOnly: true, maxAgeMs: ACTIVE_TIMEOUT_MS });
  const bannedIps = await dbService.getBannedIps();

  const now = Date.now();
  const enriched = [];
  const seenUserKeys = new Set<string>();

  // Sort by last_heartbeat DESC so the freshest session for any player takes precedence
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.last_heartbeat).getTime() - new Date(a.last_heartbeat).getTime()
  );

  for (const s of sortedSessions) {
    if (s.id && s.id.startsWith("staff_review")) continue;
    if (!s.last_heartbeat) continue;

    const lastPing = new Date(s.last_heartbeat).getTime();
    if (isNaN(lastPing)) continue;

    const pingElapsed = Math.max(0, now - lastPing);

    // Hard timeout: player must have pinged within the last 35 seconds
    if (pingElapsed > ACTIVE_TIMEOUT_MS) {
      continue;
    }

    // Strictly active authenticated sessions only
    if (s.status !== "active") {
      continue;
    }

    // Deduplicate: if the user hopped servers or reconnected, only keep the newest active session
    const hasValidUid = Boolean(s.roblox_user_id && s.roblox_user_id !== "0" && s.roblox_user_id !== "");
    const validUsername = s.roblox_username && s.roblox_username !== "Player" && s.roblox_username !== "Unknown" && s.roblox_username !== "Executor User" ? s.roblox_username : null;
    const dedupeKey = hasValidUid
      ? `uid_${s.roblox_user_id}`
      : validUsername
      ? `user_${validUsername.toLowerCase()}`
      : s.id;

    if (seenUserKeys.has(dedupeKey)) {
      continue;
    }
    seenUserKeys.add(dedupeKey);

    const startTime = s.session_started ? new Date(s.session_started).getTime() : lastPing;
    const durationSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
    const derivedStatus = "active";
    const avatarUrl = s.avatar_url || (s.roblox_user_id ? `/api/roblox/avatar?userId=${s.roblox_user_id}` : null);

    enriched.push({
      ...s,
      avatar_url: avatarUrl,
      status: derivedStatus,
      is_online: true,
      duration_seconds: durationSeconds,
      is_banned: Boolean(bannedIps[s.ip_address]),
      last_ping_sec: Math.floor(pingElapsed / 1000),
      time_since_disconnect_sec: 0,
    });
  }

  // --- ALT / MULTI-ACCOUNT FARMING DETECTOR ---
  // Group active sessions by IP address and HWID
  type EnrichedSession = (typeof enriched)[number];
  const ipGroups = new Map<string, EnrichedSession[]>();
  const hwidGroups = new Map<string, EnrichedSession[]>();

  for (const item of enriched) {
    if (!item.is_online) continue;

    // IP grouping
    if (item.ip_address) {
      if (!ipGroups.has(item.ip_address)) ipGroups.set(item.ip_address, []);
      ipGroups.get(item.ip_address)!.push(item);
    }

    // HWID grouping
    if (item.hwid && item.hwid !== "UNKNOWN" && item.hwid !== "N/A") {
      if (!hwidGroups.has(item.hwid)) hwidGroups.set(item.hwid, []);
      hwidGroups.get(item.hwid)!.push(item);
    }
  }

  interface FarmCluster {
    id: string;
    type: "ip" | "hwid";
    identifier: string;
    accounts: { username: string; user_id?: string | null; session_id: string }[];
    session_ids: string[];
    count: number;
  }

  const farmingClusters: FarmCluster[] = [];
  const farmingSessionMap = new Map<string, { count: number; otherAccounts: string[]; clusterId: string; type: "ip" | "hwid" }>();

  // Process IP farming clusters (>= 2 distinct accounts)
  ipGroups.forEach((group: EnrichedSession[], ip: string) => {
    const distinctUsernames: string[] = Array.from(
      new Set(group.map((g: EnrichedSession) => g.roblox_username || `User_${g.id.substring(0, 5)}`))
    );
    if (distinctUsernames.length >= 2) {
      const clusterId = `farm_ip_${ip.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const cluster: FarmCluster = {
        id: clusterId,
        type: "ip",
        identifier: ip,
        accounts: group.map((g: EnrichedSession) => ({
          username: g.roblox_username || "Unknown",
          user_id: g.roblox_user_id || null,
          session_id: g.id,
        })),
        session_ids: group.map((g: EnrichedSession) => g.id),
        count: distinctUsernames.length,
      };
      farmingClusters.push(cluster);

      for (const member of group) {
        const others: string[] = distinctUsernames.filter(
          (u: string) => u !== (member.roblox_username || `User_${member.id.substring(0, 5)}`)
        );
        farmingSessionMap.set(member.id, {
          count: distinctUsernames.length,
          otherAccounts: others,
          clusterId,
          type: "ip",
        });
      }
    }
  });

  // Process HWID farming clusters
  hwidGroups.forEach((group: EnrichedSession[], hwid: string) => {
    const distinctUsernames: string[] = Array.from(
      new Set(group.map((g: EnrichedSession) => g.roblox_username || `User_${g.id.substring(0, 5)}`))
    );
    if (distinctUsernames.length >= 2) {
      const clusterId = `farm_hwid_${hwid.substring(0, 12).replace(/[^a-zA-Z0-9]/g, "_")}`;
      // Only push if not already covered by an IP cluster with the exact same sessions
      const alreadyPresent = farmingClusters.some(
        (fc) => fc.identifier === hwid || (fc.type === "ip" && fc.session_ids.length === group.length)
      );
      if (!alreadyPresent) {
        farmingClusters.push({
          id: clusterId,
          type: "hwid",
          identifier: hwid,
          accounts: group.map((g: EnrichedSession) => ({
            username: g.roblox_username || "Unknown",
            user_id: g.roblox_user_id || null,
            session_id: g.id,
          })),
          session_ids: group.map((g: EnrichedSession) => g.id),
          count: distinctUsernames.length,
        });
      }

      for (const member of group) {
        if (!farmingSessionMap.has(member.id)) {
          const others: string[] = distinctUsernames.filter(
            (u: string) => u !== (member.roblox_username || `User_${member.id.substring(0, 5)}`)
          );
          farmingSessionMap.set(member.id, {
            count: distinctUsernames.length,
            otherAccounts: others,
            clusterId,
            type: "hwid",
          });
        }
      }
    }
  });

  // Attach farming metadata to enriched sessions
  const finalSessions = enriched.map((s) => {
    const farmData = farmingSessionMap.get(s.id);
    return {
      ...s,
      is_farming: Boolean(farmData),
      farming_count: farmData ? farmData.count : 1,
      farm_accounts: farmData ? farmData.otherAccounts : [],
      farm_cluster_id: farmData ? farmData.clusterId : undefined,
      farm_type: farmData ? farmData.type : undefined,
    };
  });

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

  const announcements = await dbService.getGlobalAnnouncements();

  return NextResponse.json({
    sessions: finalSessions,
    farming_clusters: farmingClusters,
    banned_ips: bannedIps,
    staff_active: staffActive,
    staff_history: staffReviews,
    announcements,
    server_time: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, session_id, ip_address, reason, message, code, place_id, server_hop, script_id, title, duration_seconds, id } = body;

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

    if (action === "execute_code") {
      if (!session_id || !code) return NextResponse.json({ error: "Missing session_id or Luau code" }, { status: 400 });
      await dbService.addSessionCommand(session_id, {
        type: "execute_code",
        code,
      });
      return NextResponse.json({ success: true, message: "Luau code dispatched to player session." });
    }

    if (action === "teleport") {
      if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
      await dbService.addSessionCommand(session_id, {
        type: "teleport",
        place_id: place_id ? Number(place_id) : undefined,
        server_hop: Boolean(server_hop),
      });
      return NextResponse.json({
        success: true,
        message: server_hop ? "Server hop dispatched." : `Teleport to place ${place_id} dispatched.`,
      });
    }

    if (action === "broadcast_announcement" || action === "broadcast") {
      if (!title || !message) return NextResponse.json({ error: "Missing title or message" }, { status: 400 });
      const record = await dbService.broadcastAnnouncement({
        script_id: script_id || "all",
        title,
        message,
        duration_seconds: duration_seconds ? Number(duration_seconds) : 10,
      });
      return NextResponse.json({ success: true, announcement: record, message: "Announcement broadcasted to active sessions." });
    }

    if (action === "delete_announcement") {
      if (!id) return NextResponse.json({ error: "Missing announcement id" }, { status: 400 });
      await dbService.deleteGlobalAnnouncement(id);
      return NextResponse.json({ success: true, message: "Announcement deleted." });
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
      return NextResponse.json({ success: true, message: `IP ${ip_address} has been unbanned.` });
    }

    if (action === "kick_farm") {
      let targets: string[] = Array.isArray(body.session_ids) ? body.session_ids : [];
      if (targets.length === 0 && ip_address) {
        const allSessions = await dbService.getSessions();
        targets = allSessions.filter((s) => s.ip_address === ip_address && s.status === "active").map((s) => s.id);
      }
      for (const sid of targets) {
        await dbService.addSessionCommand(sid, {
          type: "kick",
          reason: reason || "Terminated: Alt / Multi-account farming policy violation.",
        });
      }
      return NextResponse.json({
        success: true,
        kicked_count: targets.length,
        message: `Terminated ${targets.length} alt account sessions in farm cluster.`,
      });
    }

    if (action === "ban_farm") {
      if (!ip_address) return NextResponse.json({ error: "Missing ip_address" }, { status: 400 });
      await dbService.banIp(ip_address, reason || "Alt / Multi-Account Farming cluster detected");
      let targets: string[] = Array.isArray(body.session_ids) ? body.session_ids : [];
      if (targets.length === 0) {
        const allSessions = await dbService.getSessions();
        targets = allSessions.filter((s) => s.ip_address === ip_address && s.status === "active").map((s) => s.id);
      }
      for (const sid of targets) {
        await dbService.addSessionCommand(sid, {
          type: "kick",
          reason: "IP Banned: Alt / Multi-account farming cluster terminated.",
        });
      }
      return NextResponse.json({
        success: true,
        message: `Banned network IP ${ip_address} and terminated ${targets.length} concurrent alt sessions.`,
      });
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
