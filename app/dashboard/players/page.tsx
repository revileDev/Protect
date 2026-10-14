// app/dashboard/players/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  AlertTriangle,
  ShieldBan,
  Send,
  ShieldAlert,
  Check,
  RefreshCw,
  Clock,
  Laptop,
  Activity,
  Trash2,
  LayoutGrid,
  List,
  WifiOff,
  Wifi,
  X,
} from "lucide-react";

interface SessionItem {
  id: string;
  key_id: string;
  script_id: string;
  ip_address: string;
  hwid: string | null;
  roblox_username: string | null;
  roblox_user_id: string | null;
  status: "active" | "kicked" | "tampered" | "expired" | "disconnected";
  tamper_flags: string[];
  session_started: string;
  last_heartbeat: string;
  is_online: boolean;
  duration_seconds: number;
  is_banned: boolean;
  last_ping_sec?: number;
  time_since_disconnect_sec?: number;
}

export default function PlayersPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [bannedIps, setBannedIps] = useState<Record<string, { reason: string; banned_at: string }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "bans">("sessions");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [now, setNow] = useState(Date.now());

  // Message modal state
  const [messageModal, setMessageModal] = useState<{ sessionId: string; username: string } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const removedSessionIdsRef = useRef<Set<string>>(new Set());

  const fetchPlayers = async () => {
    try {
      const res = await fetch("/api/players");
      const data = await res.json();
      if (data.sessions) {
        // Exclude sessions already pruned locally
        const fresh = (data.sessions as SessionItem[]).filter(
          (s) => !removedSessionIdsRef.current.has(s.id)
        );
        setSessions(fresh);
      }
      if (data.banned_ips) setBannedIps(data.banned_ips);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Local live clock ticker every 500ms to calculate live pings and freeze disconnected timers
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(clockInterval);
  }, []);

  // Telemetry polling from server every 2 seconds
  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(interval);
  }, []);

  // Remove card handler
  const handleRemoveCard = async (sessionId: string) => {
    removedSessionIdsRef.current.add(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_card", session_id: sessionId }),
      });
    } catch {
      // ignore
    }
  };

  // Automatic card removal check:
  // If a player has stopped sending heartbeat pings for > 5s, they become "Disconnected".
  // After displaying "Disconnected" for 5 seconds, remove their card from the tab.
  useEffect(() => {
    const toRemove: string[] = [];

    sessions.forEach((s) => {
      const lastPingTime = new Date(s.last_heartbeat).getTime();
      const elapsedPingMs = Math.max(0, now - lastPingTime);

      if (elapsedPingMs >= 5000) {
        const timeSinceDisconnectSec = Math.floor((elapsedPingMs - 5000) / 1000);
        // If disconnected for more than 5 seconds, auto-prune card
        if (timeSinceDisconnectSec >= 5 && !removedSessionIdsRef.current.has(s.id)) {
          toRemove.push(s.id);
        }
      }
    });

    if (toRemove.length > 0) {
      toRemove.forEach((id) => handleRemoveCard(id));
    }
  }, [now, sessions]);

  const handleKick = async (sessionId: string) => {
    if (!confirm("Kick this player off the script? Their in-game script will terminate immediately.")) return;
    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", session_id: sessionId }),
      });
      showNotice("Player kicked from script.");
      fetchPlayers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanIp = async (ip: string) => {
    const reason = prompt("Enter ban reason:", "Violated Terms of Service / Script Tampering");
    if (!reason) return;
    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ban_ip", ip_address: ip, reason }),
      });
      showNotice(`IP ${ip} has been permanently banned.`);
      fetchPlayers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnbanIp = async (ip: string) => {
    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unban_ip", ip_address: ip }),
      });
      showNotice(`IP ${ip} unbanned.`);
      fetchPlayers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageModal || !messageText.trim()) return;
    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          session_id: messageModal.sessionId,
          message: messageText,
        }),
      });
      showNotice(`Dismissable message sent to ${messageModal.username}!`);
      setMessageModal(null);
      setMessageText("");
    } catch (err) {
      console.error(err);
    }
  };

  const showNotice = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  // Compute live properties for each player based on current timestamp
  const processedSessions = sessions.map((s) => {
    const lastPingTime = new Date(s.last_heartbeat).getTime();
    const startTime = new Date(s.session_started).getTime();
    const pingElapsedMs = Math.max(0, now - lastPingTime);

    // After 5 seconds without a heartbeat ping, player is disconnected
    const isDisconnected = pingElapsedMs >= 5000 || s.status === "kicked" || s.status === "disconnected";
    const isOnline = !isDisconnected && s.status === "active";

    // Duration timer is FROZEN once disconnected: no more timer added!
    const effectiveEndTime = isOnline ? now : lastPingTime;
    const durationSeconds = Math.max(0, Math.floor((effectiveEndTime - startTime) / 1000));

    const timeSinceDisconnectSec = isDisconnected ? Math.floor((pingElapsedMs - 5000) / 1000) : 0;
    const removalCountdownSec = Math.max(0, 5 - timeSinceDisconnectSec);

    return {
      ...s,
      is_online: isOnline,
      duration_seconds: durationSeconds,
      ping_sec: Math.floor(pingElapsedMs / 1000),
      time_since_disconnect_sec: timeSinceDisconnectSec,
      removal_countdown_sec: removalCountdownSec,
    };
  });

  const onlineCount = processedSessions.filter((s) => s.is_online).length;
  const bannedCount = Object.keys(bannedIps).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header & Live Telemetry Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            Players & Active Sessions
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Real-time player monitoring. Inactive sessions disconnect after 5 seconds of silence and are automatically cleared.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Online Right Now: {onlineCount}</span>
          </div>

          {/* Toggle View: Cards vs Table */}
          <div className="flex items-center bg-[#12141d] border border-gray-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === "cards" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
              title="Player Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === "table" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={fetchPlayers}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
            title="Refresh telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "sessions"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          Active Players ({onlineCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bans")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "bans"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          Banned IPs ({bannedCount})
        </button>
      </div>

      {/* SESSIONS TAB */}
      {activeTab === "sessions" && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-xs text-gray-500 bg-[#12141d] rounded-2xl border border-gray-800">
              Loading player telemetry...
            </div>
          ) : processedSessions.length === 0 ? (
            <div className="text-center py-16 bg-[#12141d] border border-gray-800/80 rounded-2xl p-6">
              <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-semibold">No active players right now</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Players currently executing your script in Roblox will show up here live with real-time ping telemetry.
              </p>
            </div>
          ) : viewMode === "cards" ? (
            /* CARDS GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedSessions.map((s) => (
                <div
                  key={s.id}
                  className={`bg-[#0f1118] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden shadow-xl ${
                    s.is_online
                      ? "border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5"
                      : "border-rose-500/40 bg-rose-950/10 opacity-80"
                  }`}
                >
                  {/* Card Header: Avatar, Name, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          s.is_online
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        }`}
                      >
                        {s.roblox_username ? s.roblox_username.substring(0, 2).toUpperCase() : "EX"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white truncate">
                            {s.roblox_username || "Executor User"}
                          </h3>
                        </div>
                        {s.roblox_user_id && (
                          <span className="text-[10px] font-mono text-gray-500 block truncate">
                            UID: {s.roblox_user_id}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {s.is_online ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <WifiOff className="w-3 h-3" />
                          Disconnected
                        </span>
                      )}

                      {/* Manual Dismiss button */}
                      {!s.is_online && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(s.id)}
                          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                          title="Remove card now"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Disconnected Notice Banner on Card */}
                  {!s.is_online && (
                    <div className="mt-3 p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        User stopped using script.
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Clearing in {s.removal_countdown_sec}s
                      </span>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 py-3 border-y border-gray-800/60 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                        Playtime (Frozen on Quit)
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-gray-200 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold">{formatDuration(s.duration_seconds)}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                        Heartbeat Telemetry
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-gray-200 mt-0.5">
                        <Activity
                          className={`w-3.5 h-3.5 ${
                            s.is_online ? "text-emerald-400" : "text-gray-500"
                          }`}
                        />
                        <span>{s.is_online ? `${s.ping_sec}s ago` : "Lost connection"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Device & Network Details */}
                  <div className="mt-3 space-y-1 text-[11px] text-gray-400">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">IP:</span>
                      <span className="font-mono text-gray-300">
                        {s.ip_address}
                        {s.is_banned && (
                          <span className="text-rose-400 font-bold ml-1">[BANNED]</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between truncate">
                      <span className="text-gray-500">HWID:</span>
                      <span className="font-mono text-gray-400 truncate max-w-[150px]">
                        {s.hwid || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-800/60">
                    <button
                      type="button"
                      onClick={() =>
                        setMessageModal({
                          sessionId: s.id,
                          username: s.roblox_username || s.ip_address,
                        })
                      }
                      className="flex-1 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/25 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Message
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKick(s.id)}
                      className="py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/25 text-xs font-semibold transition-colors"
                      title="Remote kick"
                    >
                      Kick
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBanIp(s.ip_address)}
                      className="py-1.5 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/25 text-xs font-semibold transition-colors"
                      title="Ban player IP"
                    >
                      Ban
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* TABLE LIST VIEW */
            <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Roblox Player</th>
                      <th className="p-3.5">IP Address</th>
                      <th className="p-3.5">HWID / Device</th>
                      <th className="p-3.5">Duration</th>
                      <th className="p-3.5">Last Heartbeat</th>
                      <th className="p-3.5 text-right">Remote Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {processedSessions.map((s) => (
                      <tr
                        key={s.id}
                        className={`transition-colors ${
                          s.is_online ? "hover:bg-gray-800/30" : "bg-rose-950/10 hover:bg-rose-950/20"
                        }`}
                      >
                        <td className="p-3.5">
                          {s.is_online ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Online
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                                Disconnected
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                ({s.removal_countdown_sec}s)
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 font-medium text-white">
                          <div>
                            <span>{s.roblox_username || "Executor User"}</span>
                            {s.roblox_user_id && (
                              <span className="block text-[10px] text-gray-500 font-mono">
                                ID: {s.roblox_user_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-gray-300">
                          {s.ip_address}
                          {s.is_banned && (
                            <span className="block text-[10px] text-rose-400 font-sans font-bold">
                              [IP BANNED]
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-gray-400 truncate max-w-[120px]">
                          {s.hwid || "N/A"}
                        </td>
                        <td className="p-3.5 font-mono text-gray-300">
                          {formatDuration(s.duration_seconds)}
                          {!s.is_online && (
                            <span className="text-[10px] text-gray-500 block">(Frozen)</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-gray-400">
                          {s.is_online ? `${s.ping_sec}s ago` : "Offline"}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setMessageModal({
                                  sessionId: s.id,
                                  username: s.roblox_username || s.ip_address,
                                })
                              }
                              className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-[11px] font-medium transition-colors"
                              title="Send Message"
                            >
                              Message
                            </button>
                            <button
                              type="button"
                              onClick={() => handleKick(s.id)}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
                              title="Remote Kick"
                            >
                              Kick
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBanIp(s.ip_address)}
                              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition-colors"
                              title="Ban IP Address"
                            >
                              Ban IP
                            </button>
                            {!s.is_online && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCard(s.id)}
                                className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                                title="Dismiss Card"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BANNED IPS TAB */}
      {activeTab === "bans" && (
        <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Banned IP</th>
                  <th className="p-3.5">Reason</th>
                  <th className="p-3.5">Banned Timestamp</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {Object.keys(bannedIps).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-500">
                      No banned IPs.
                    </td>
                  </tr>
                ) : (
                  Object.entries(bannedIps).map(([ip, data]) => (
                    <tr key={ip} className="hover:bg-gray-800/30">
                      <td className="p-3.5 font-mono font-bold text-rose-400">{ip}</td>
                      <td className="p-3.5 text-gray-300">{data.reason}</td>
                      <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                        {new Date(data.banned_at).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleUnbanIp(ip)}
                          className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-[11px]"
                        >
                          Unban IP
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dismissable Screen Message Modal */}
      {messageModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12141e] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                Send In-Game Message
              </h3>
              <button
                type="button"
                onClick={() => setMessageModal(null)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Sending a dismissable popup / billboard to{" "}
              <strong className="text-white">{messageModal.username}</strong>:
            </p>

            <textarea
              rows={3}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="e.g. Notice: Server maintenance starting in 5 minutes."
              className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMessageModal(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendMessage}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20"
              >
                Send to Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
