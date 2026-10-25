// mobile/src/screens/PlayersScreen.tsx
import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldAlert,
  Send,
  Code2,
  Compass,
  Megaphone,
  Ban,
  UserX,
  Radio,
  Search,
  Sparkles,
  AlertTriangle,
  X,
  Check,
  RefreshCw,
  Copy,
} from "lucide-react";
import { ApiService } from "../lib/api";

interface SessionItem {
  id: string;
  key_id: string;
  script_id: string;
  ip_address: string;
  hwid: string | null;
  roblox_username: string | null;
  roblox_user_id: string | null;
  avatar_url?: string | null;
  place_id?: string | null;
  place_name?: string | null;
  job_id?: string | null;
  status: string;
  tamper_flags: string[];
  session_started: string;
  last_heartbeat: string;
  is_online: boolean;
  duration_seconds: number;
  is_banned: boolean;
  last_ping_sec?: number;
  is_farming?: boolean;
  farming_count?: number;
  farm_accounts?: string[];
  farm_cluster_id?: string;
  farm_type?: "ip" | "hwid";
}

function PlayerAvatar({ player }: { player: SessionItem }) {
  const [imgError, setImgError] = useState(false);
  const serverUrl = ApiService.getServerUrl();

  const avatarUrl = React.useMemo(() => {
    // 1. If explicit avatar_url is provided
    if (player.avatar_url) {
      if (player.avatar_url.startsWith("http://") || player.avatar_url.startsWith("https://")) {
        return player.avatar_url;
      }
      return `${serverUrl}${player.avatar_url.startsWith("/") ? "" : "/"}${player.avatar_url}`;
    }
    // 2. If roblox_user_id exists and is valid
    if (player.roblox_user_id && player.roblox_user_id !== "0" && /^\d+$/.test(player.roblox_user_id)) {
      return `${serverUrl}/api/roblox/avatar?userId=${player.roblox_user_id}`;
    }
    // 3. Fallback to username lookup if available
    if (
      player.roblox_username &&
      player.roblox_username !== "Unknown" &&
      player.roblox_username !== "Player" &&
      player.roblox_username !== "Anonymous"
    ) {
      return `${serverUrl}/api/roblox/avatar?username=${encodeURIComponent(player.roblox_username)}`;
    }
    return null;
  }, [player.avatar_url, player.roblox_user_id, player.roblox_username, serverUrl]);

  const initials = (player.roblox_username || "PL")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase() || "PL";

  if (avatarUrl && !imgError) {
    return (
      <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
        <img
          src={avatarUrl}
          alt={player.roblox_username || "Roblox Avatar"}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-950/80 via-blue-950/60 to-purple-950/80 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-xs text-cyan-300 shrink-0 shadow-inner">
      {initials}
    </div>
  );
}

export default function PlayersScreen() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [farmingClusters, setFarmingClusters] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Action Modals
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [actionType, setActionType] = useState<"kick" | "message" | "code" | "teleport" | "ban" | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [actionSecondaryInput, setActionSecondaryInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Broadcast Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("SYSTEM ALERT");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastDuration, setBroadcastDuration] = useState(10);

  const fetchPlayers = async () => {
    try {
      const data = await ApiService.getPlayers();
      if (data.sessions) setSessions(data.sessions);
      if (data.farming_clusters) setFarmingClusters(data.farming_clusters);
      if (data.announcements) setAnnouncements(data.announcements);
    } catch (err) {
      console.error("Failed to load players", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async () => {
    if (!selectedSession || !actionType) return;
    setActionLoading(true);
    setActionSuccess(null);

    try {
      if (actionType === "kick") {
        await ApiService.sendPlayerAction({
          action: "kick",
          session_id: selectedSession.id,
          reason: actionInput || "Kicked by mobile administrator",
        });
        setActionSuccess("Player kicked successfully");
      } else if (actionType === "message") {
        await ApiService.sendPlayerAction({
          action: "message",
          session_id: selectedSession.id,
          message: actionInput,
        });
        setActionSuccess("Message sent to in-game screen");
      } else if (actionType === "code") {
        await ApiService.sendPlayerAction({
          action: "execute_code",
          session_id: selectedSession.id,
          code: actionInput,
        });
        setActionSuccess("Luau code dispatched to executor");
      } else if (actionType === "teleport") {
        await ApiService.sendPlayerAction({
          action: "teleport",
          session_id: selectedSession.id,
          place_id: actionInput ? Number(actionInput) : undefined,
          server_hop: !actionInput,
        });
        setActionSuccess(actionInput ? `Teleporting to ${actionInput}` : "Server hop command dispatched");
      } else if (actionType === "ban") {
        await ApiService.sendPlayerAction({
          action: "ban_ip",
          ip_address: selectedSession.ip_address,
          reason: actionInput || "Banned via Mobile Command Center",
        });
        setActionSuccess(`Banned IP ${selectedSession.ip_address}`);
      }

      setTimeout(() => {
        setActionType(null);
        setSelectedSession(null);
        setActionInput("");
        setActionSecondaryInput("");
        setActionSuccess(null);
        fetchPlayers();
      }, 1200);
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    try {
      await ApiService.sendPlayerAction({
        action: "broadcast",
        title: broadcastTitle,
        message: broadcastMsg,
        duration_seconds: broadcastDuration,
        script_id: "all",
      });
      setShowBroadcastModal(false);
      setBroadcastMsg("");
      fetchPlayers();
    } catch (err: any) {
      alert(err.message || "Failed to broadcast");
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.roblox_username && s.roblox_username.toLowerCase().includes(q)) ||
      (s.roblox_user_id && s.roblox_user_id.includes(q)) ||
      (s.ip_address && s.ip_address.includes(q)) ||
      (s.hwid && s.hwid.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Live Command Center
            </h2>
            <p className="text-[11px] text-zinc-400">
              {sessions.length} Active Player{sessions.length === 1 ? "" : "s"} In-Game
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowBroadcastModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all active:scale-95 shadow-md shadow-cyan-950/40"
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Broadcast</span>
        </button>
      </div>

      {/* Farming Detection Banner */}
      {farmingClusters.length > 0 && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-600/40 p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <ShieldAlert className="w-4 h-4" />
            <span>Alt-Farming Clusters Detected ({farmingClusters.length})</span>
          </div>
          <div className="text-[11px] text-zinc-300">
            {farmingClusters.map((fc, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-t border-amber-900/40 first:border-0 gap-2">
                <span className="font-mono text-amber-300 text-[11px] shrink-0">
                  {fc.type.toUpperCase()}: {fc.identifier.slice(0, 14)}... ({fc.count} accs)
                </span>
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-[10px] text-zinc-400 truncate max-w-[140px]">
                    {fc.accounts?.map((a: any) => a.username).join(", ")}
                  </span>
                  <button
                    onClick={async () => {
                      if (!confirm(`Kick all ${fc.count} accounts in this farm cluster?`)) return;
                      try {
                        await ApiService.sendPlayerAction({
                          action: "kick_farm",
                          session_ids: fc.session_ids,
                          ip_address: fc.type === "ip" ? fc.identifier : undefined,
                        });
                        fetchPlayers();
                      } catch (err: any) {
                        alert(err.message || "Failed to kick cluster");
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-rose-950 border border-rose-700/60 text-[10px] font-mono text-rose-300 shrink-0 active:scale-95 transition-all"
                  >
                    Kick All
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, user ID, IP, or HWID..."
          className="w-full rounded-xl bg-[#0e1118] border border-zinc-800 pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
        />
      </div>

      {/* Players List */}
      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="text-xs font-mono">Syncing active game telemetry...</span>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-1">
          <Users className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
          <p className="text-xs font-semibold text-zinc-400">No active players found</p>
          <p className="text-[11px]">When players run the script in Roblox, they appear here live.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSessions.map((player) => {
            return (
              <div
                key={player.id}
                className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3.5 space-y-3 shadow-md relative overflow-hidden"
              >
                {/* Status Dot */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={player} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">
                          {player.roblox_username || "Unknown Player"}
                        </span>
                        {player.is_farming && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-600/40 text-[9px] font-mono text-amber-300">
                            FARM ({player.farming_count})
                          </span>
                        )}
                      </div>
                      <span className="block text-[10px] text-zinc-400 font-mono">
                        UID: {player.roblox_user_id || "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {player.last_ping_sec !== undefined ? `${player.last_ping_sec}s ago` : "ONLINE"}
                    </span>
                    <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">
                      {Math.floor(player.duration_seconds / 60)}m session
                    </span>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-[#07080c] p-2 rounded-xl border border-zinc-800/60">
                  <div className="truncate">
                    <span className="text-zinc-500">IP: </span>
                    <span className="text-zinc-300">{player.ip_address}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-zinc-500">HWID: </span>
                    <span className="text-zinc-300">{player.hwid ? player.hwid.slice(0, 10) + "..." : "N/A"}</span>
                  </div>
                  <div className="truncate col-span-2">
                    <span className="text-zinc-500">Place: </span>
                    <span className="text-cyan-400">{player.place_name || player.place_id || "Default Game"}</span>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setSelectedSession(player);
                      setActionType("kick");
                      setActionInput("");
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-rose-400 hover:border-rose-800 active:scale-95 transition-all text-[10px] font-medium"
                  >
                    <UserX className="w-4 h-4 mb-1 text-rose-400" />
                    <span>Kick</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSession(player);
                      setActionType("message");
                      setActionInput("");
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-cyan-400 hover:border-cyan-800 active:scale-95 transition-all text-[10px] font-medium"
                  >
                    <Send className="w-4 h-4 mb-1 text-cyan-400" />
                    <span>Msg</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSession(player);
                      setActionType("code");
                      setActionInput("game.Players.LocalPlayer.Character:BreakJoints()");
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-purple-400 hover:border-purple-800 active:scale-95 transition-all text-[10px] font-medium"
                  >
                    <Code2 className="w-4 h-4 mb-1 text-purple-400" />
                    <span>Code</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSession(player);
                      setActionType("teleport");
                      setActionInput("");
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-amber-800 active:scale-95 transition-all text-[10px] font-medium"
                  >
                    <Compass className="w-4 h-4 mb-1 text-amber-400" />
                    <span>Tele</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSession(player);
                      setActionType("ban");
                      setActionInput("Banned by Mobile Admin");
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-red-400 hover:border-red-800 active:scale-95 transition-all text-[10px] font-medium"
                  >
                    <Ban className="w-4 h-4 mb-1 text-red-400" />
                    <span>Ban</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Drawer Modal */}
      {selectedSession && actionType && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-[#0e1118] border border-zinc-800 p-5 space-y-4 shadow-2xl text-zinc-100 animate-in slide-in-from-bottom duration-200 safe-bottom max-h-[85vh] overflow-y-auto scroll-container">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-sm text-white uppercase font-mono">
                  {actionType === "kick" && "Kick In-Game Player"}
                  {actionType === "message" && "In-Game Notification"}
                  {actionType === "code" && "Execute Luau Script"}
                  {actionType === "teleport" && "Teleport / Server Hop"}
                  {actionType === "ban" && "Permanent IP Ban"}
                </h3>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Target: {selectedSession.roblox_username} ({selectedSession.ip_address})
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSession(null);
                  setActionType(null);
                }}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionSuccess ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {actionType === "code" && (
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Luau Code Payload
                    </label>
                    <textarea
                      rows={4}
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder="Enter valid Luau code..."
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setActionInput("game.Players.LocalPlayer.Character:BreakJoints()")}
                        className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white"
                      >
                        Reset Char
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionInput("print('[ATOMPROTECT] Ping from mobile')")}
                        className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white"
                      >
                        Print Debug
                      </button>
                    </div>
                  </div>
                )}

                {actionType === "kick" && (
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Kick Reason
                    </label>
                    <input
                      type="text"
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder="Kicked by dashboard administrator."
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                )}

                {actionType === "message" && (
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Popup Message Text
                    </label>
                    <textarea
                      rows={2}
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder="Attention: Server updating in 5 minutes..."
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 p-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {actionType === "teleport" && (
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Place ID (Leave empty for random Server Hop)
                    </label>
                    <input
                      type="text"
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder="e.g. 189707"
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {actionType === "ban" && (
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Ban Reason (Locks out IP {selectedSession.ip_address})
                    </label>
                    <input
                      type="text"
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder="Malicious behavior / Multi-farming"
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setSelectedSession(null);
                      setActionType(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAction}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Dispatching..." : "Execute Command"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#0e1118] border border-zinc-800 p-5 space-y-4 shadow-2xl text-zinc-100 safe-bottom max-h-[85vh] overflow-y-auto scroll-container">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Broadcast Announcement</h3>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBroadcast} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Banner Title
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Announcement Message
                </label>
                <textarea
                  rows={3}
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Broadcast message to all Roblox players..."
                  required
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  value={broadcastDuration}
                  onChange={(e) => setBroadcastDuration(Number(e.target.value))}
                  min={3}
                  max={60}
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold"
                >
                  Send Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
