// app/dashboard/players/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Users, AlertTriangle, ShieldBan, Send, ShieldAlert, Check, RefreshCw } from "lucide-react";

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
}

export default function PlayersPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [bannedIps, setBannedIps] = useState<Record<string, { reason: string; banned_at: string }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "bans">("sessions");

  // Message modal state
  const [messageModal, setMessageModal] = useState<{ sessionId: string; username: string } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPlayers = async () => {
    try {
      const res = await fetch("/api/players");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
      if (data.banned_ips) setBannedIps(data.banned_ips);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2500); // 2.5s polling for live telemetry
    return () => clearInterval(interval);
  }, []);

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

  const onlineCount = sessions.filter((s) => s.is_online).length;
  const bannedCount = Object.keys(bannedIps).length;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

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
            1-Second Heartbeat telemetry. Live player monitoring, tamper warnings, remote kicks, and screen billboard messages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Online Right Now: {onlineCount}</span>
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
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
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
              ? "bg-emerald-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          Active Sessions ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bans")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "bans"
              ? "bg-rose-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          Banned IPs ({bannedCount})
        </button>
      </div>

      {/* Sessions Table */}
      {activeTab === "sessions" && (
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      Loading player telemetry...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No active sessions detected yet. Launch your script in Roblox to see players appear here.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => {
                    const lastPingSec = Math.max(
                      0,
                      Math.floor((Date.now() - new Date(s.last_heartbeat).getTime()) / 1000)
                    );

                    return (
                      <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="p-3.5">
                          {s.is_online ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Online
                            </span>
                          ) : s.status === "kicked" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Kicked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-400">
                              Disconnected
                            </span>
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
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-gray-400">
                          {lastPingSec}s ago
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Send Message Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setMessageModal({
                                  sessionId: s.id,
                                  username: s.roblox_username || s.ip_address,
                                })
                              }
                              className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-[11px] font-medium transition-colors"
                              title="Send In-Game Screen / Billboard Message"
                            >
                              Message
                            </button>

                            {/* Kick Button */}
                            <button
                              type="button"
                              onClick={() => handleKick(s.id)}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
                              title="Remote Kick"
                            >
                              Kick
                            </button>

                            {/* Ban IP Button */}
                            <button
                              type="button"
                              onClick={() => handleBanIp(s.ip_address)}
                              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition-colors"
                              title="Ban IP Address"
                            >
                              Ban IP
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Banned IPs Tab */}
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
              placeholder="e.g. Warning: Script updating in 5 minutes! Save your progress."
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
