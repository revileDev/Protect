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
  Shield,
  EyeOff,
  UserCheck,
  Code2,
  Megaphone,
  Compass,
  Radio,
  Tv,
  Gamepad2,
  Sparkles,
  Search,
  MessageSquare,
  Mail,
} from "lucide-react";
import ChatroomManager from "@/components/ChatroomManager";
import DmsManager from "@/components/DmsManager";

interface StaffReviewItem {
  id: string;
  key_id: string;
  script_id: string;
  script_name: string;
  key_label: string;
  status: "reviewing" | "completed";
  review_started: string;
  last_heartbeat: string;
  duration_seconds: number;
  created_at: string;
  is_reviewing?: boolean;
}

interface GlobalAnnouncementItem {
  id: string;
  script_id: string;
  title: string;
  message: string;
  duration_seconds: number;
  created_at: string;
}

interface FarmCluster {
  id: string;
  type: "ip" | "hwid";
  identifier: string;
  accounts: { username: string; user_id?: string | null; session_id: string }[];
  session_ids: string[];
  count: number;
}

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
  status: "loading" | "active" | "kicked" | "tampered" | "expired" | "disconnected";
  tamper_flags: string[];
  session_started: string;
  last_heartbeat: string;
  is_online: boolean;
  duration_seconds: number;
  is_banned: boolean;
  last_ping_sec?: number;
  time_since_disconnect_sec?: number;
  is_farming?: boolean;
  farming_count?: number;
  farm_accounts?: string[];
  farm_cluster_id?: string;
  farm_type?: "ip" | "hwid";
}

function RobloxAvatar({
  userId,
  username,
  size = "md",
}: {
  userId?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [imgError, setImgError] = useState(false);
  const initials = username ? username.substring(0, 2).toUpperCase() : "EX";

  const sizeClass =
    size === "sm"
      ? "w-7 h-7 rounded-lg text-[10px]"
      : size === "lg"
      ? "w-12 h-12 rounded-2xl text-sm"
      : "w-10 h-10 rounded-xl text-xs";

  if (userId && !imgError) {
    return (
      <div className={`${sizeClass} overflow-hidden bg-[#181a24] border border-gray-700/60 shrink-0 relative shadow-inner flex items-center justify-center`}>
        <img
          src={`/api/roblox/avatar?userId=${userId}`}
          alt={username || "Roblox Avatar"}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 shrink-0 shadow-inner`}
    >
      {initials}
    </div>
  );
}

export default function PlayersPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [farmingClusters, setFarmingClusters] = useState<FarmCluster[]>([]);
  const [staffActive, setStaffActive] = useState<StaffReviewItem[]>([]);
  const [staffHistory, setStaffHistory] = useState<StaffReviewItem[]>([]);
  const [bannedIps, setBannedIps] = useState<Record<string, { reason: string; banned_at: string }>>({});
  const [announcements, setAnnouncements] = useState<GlobalAnnouncementItem[]>([]);
  const [scriptsList, setScriptsList] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "announcements" | "staff" | "bans" | "chatroom" | "dms">("sessions");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [now, setNow] = useState(Date.now());

  // Message modal state
  const [messageModal, setMessageModal] = useState<{ sessionId: string; username: string } | null>(null);
  const [messageText, setMessageText] = useState("");

  // Code injection modal state
  const [codeModal, setCodeModal] = useState<{ sessionId: string; username: string } | null>(null);
  const [codeText, setCodeText] = useState('print("AtomProtect: Hello from dashboard!")');

  // Teleport modal state
  const [teleportModal, setTeleportModal] = useState<{ sessionId: string; username: string; placeId?: string } | null>(null);
  const [teleportMode, setTeleportMode] = useState<"hop" | "place">("hop");
  const [targetPlaceId, setTargetPlaceId] = useState("");

  // Broadcast announcement modal state
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementDuration, setAnnouncementDuration] = useState("10");
  const [announcementScript, setAnnouncementScript] = useState("all");

  // Manual Ban IP Modal state
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banIpInput, setBanIpInput] = useState("");
  const [banReasonInput, setBanReasonInput] = useState("Manual ban from Admin Console");
  const [banFilterSearch, setBanFilterSearch] = useState("");
  const [banningIp, setBanningIp] = useState(false);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const removedSessionIdsRef = useRef<Set<string>>(new Set());
  const serverSkewRef = useRef<number>(0);

  const fetchPlayers = async () => {
    try {
      const res = await fetch("/api/players");
      const data = await res.json();
      if (data.server_time) {
        serverSkewRef.current = Date.now() - new Date(data.server_time).getTime();
      }
      if (data.sessions) {
        // Exclude sessions already pruned locally and ensure only online sessions
        const fresh = (data.sessions as SessionItem[]).filter(
          (s) => !removedSessionIdsRef.current.has(s.id) && s.is_online !== false
        );
        setSessions(fresh);
      }
      if (data.farming_clusters) setFarmingClusters(data.farming_clusters);
      if (data.banned_ips) setBannedIps(data.banned_ips);
      if (data.staff_active) setStaffActive(data.staff_active);
      if (data.staff_history) setStaffHistory(data.staff_history);
      if (data.announcements) setAnnouncements(data.announcements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/scripts")
      .then((res) => res.json())
      .then((json) => {
        if (json.scripts) setScriptsList(json.scripts);
      })
      .catch(() => {});
  }, []);

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

  // Let the server-side telemetry debounce (15s timeout with 15s grace period) govern session pruning smoothly.

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

  const handleDirectBanIp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!banIpInput.trim()) return;
    setBanningIp(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban_ip",
          ip_address: banIpInput.trim(),
          reason: banReasonInput.trim() || "Manual ban from Admin Console",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`IP ${banIpInput.trim()} has been permanently banned.`);
        setBanIpInput("");
        setBanReasonInput("Manual ban from Admin Console");
        setBanModalOpen(false);
        fetchPlayers();
      } else {
        alert(data.error || "Failed to ban IP");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBanningIp(false);
    }
  };

  const handleKickFarm = async (cluster: FarmCluster) => {
    if (!confirm(`Terminate all ${cluster.count} concurrent sessions in this farming cluster?`)) return;
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "kick_farm",
          session_ids: cluster.session_ids,
          ip_address: cluster.type === "ip" ? cluster.identifier : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(data.message || `Terminated ${cluster.count} farming sessions.`);
        fetchPlayers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanFarm = async (cluster: FarmCluster) => {
    const ip = cluster.type === "ip" ? cluster.identifier : prompt("Enter IP to ban for this farming cluster:");
    if (!ip) return;
    if (!confirm(`Permanently ban IP ${ip} and terminate all ${cluster.count} alt sessions?`)) return;
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban_farm",
          ip_address: ip,
          session_ids: cluster.session_ids,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(data.message || `Banned IP ${ip} and terminated alt sessions.`);
        fetchPlayers();
      }
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

  const handleExecuteCode = async () => {
    if (!codeModal || !codeText.trim()) return;
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_code",
          session_id: codeModal.sessionId,
          code: codeText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Luau code dispatched to ${codeModal.username}!`);
        setCodeModal(null);
      } else {
        alert(data.error || "Failed to dispatch code.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTeleport = async () => {
    if (!teleportModal) return;
    const isHop = teleportMode === "hop";
    if (!isHop && !targetPlaceId.trim()) {
      alert("Please enter a valid Place ID to teleport the player.");
      return;
    }
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "teleport",
          session_id: teleportModal.sessionId,
          server_hop: isHop,
          place_id: isHop ? undefined : Number(targetPlaceId.trim()),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          isHop
            ? `Server hop sent to ${teleportModal.username}!`
            : `Teleport to place ${targetPlaceId} sent to ${teleportModal.username}!`
        );
        setTeleportModal(null);
        setTargetPlaceId("");
      } else {
        alert(data.error || "Teleport failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcastAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      alert("Please enter both a title and message for the announcement.");
      return;
    }
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broadcast_announcement",
          script_id: announcementScript,
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          duration_seconds: Number(announcementDuration) || 10,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice("In-Game Global Announcement broadcasted!");
        setAnnouncementModal(false);
        setAnnouncementTitle("");
        setAnnouncementMessage("");
        fetchPlayers();
      } else {
        alert(data.error || "Failed to broadcast announcement.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_announcement", id }),
      });
      showNotice("Announcement removed.");
      fetchPlayers();
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
  // Filter strictly to ACTIVE online players only (no disconnected cards)
  const processedSessions = sessions
    .map((s) => {
      const adjustedNow = now - (serverSkewRef.current || 0);
      const lastPingTime = new Date(s.last_heartbeat).getTime();
      const startTime = s.session_started ? new Date(s.session_started).getTime() : lastPingTime;
      const pingElapsedMs = Math.max(0, adjustedNow - lastPingTime);

      // Timeout threshold is 15 seconds, matching server HEARTBEAT_TIMEOUT_MS
      const isTimedOut = pingElapsedMs >= 15000;
      const isLoading = s.status === "loading" && !isTimedOut;
      const isOnline = (s.status === "active" || s.status === "loading") && !isTimedOut && (s.is_online !== false);

      const effectiveEndTime = isOnline ? adjustedNow : lastPingTime;
      const durationSeconds = Math.max(0, Math.floor((effectiveEndTime - startTime) / 1000));

      return {
        ...s,
        is_online: isOnline,
        is_loading: isLoading,
        duration_seconds: durationSeconds,
        ping_sec: Math.floor(pingElapsedMs / 1000),
        removal_countdown_sec: 0,
        time_since_disconnect_sec: 0,
      };
    })
    .filter((s) => s.is_online);

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
            Real-time player monitoring. Inactive sessions disconnect after 15 seconds of silence and are automatically cleared.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setBanModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold shadow-sm transition-all"
            title="Ban Any IP Address Immediately"
          >
            <ShieldBan className="w-3.5 h-3.5 text-rose-400" />
            <span>Ban IP Address</span>
          </button>

          <button
            type="button"
            onClick={() => setAnnouncementModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow-sm transition-all"
            title="Broadcast Live Announcement to In-Game Sessions"
          >
            <Megaphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Broadcast Announcement</span>
          </button>

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
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "sessions"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span>Active Players ({onlineCount})</span>
          {staffActive.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-500 text-white font-bold animate-pulse">
              {staffActive.length} Staff
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "announcements"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>In-Game Announcements ({announcements.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "staff"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Staff History ({staffHistory.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("chatroom")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "chatroom"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chatroom</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dms")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "dms"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>DMs / Contact Dev</span>
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
        <div className="space-y-6">
          {/* Active Staff Reviews (Zero Logging / Protected) */}
          {staffActive.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    Staff Review Active ({staffActive.length})
                  </h2>
                </div>
                <span className="text-[10px] text-purple-400/80 font-mono">
                  Anonymous Session • Zero Telemetry Stored
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffActive.map((staff) => {
                  const startTime = new Date(staff.review_started).getTime();
                  const liveDuration = Math.max(0, Math.floor((now - startTime) / 1000));

                  return (
                    <div
                      key={staff.id}
                      className="bg-gradient-to-br from-purple-950/40 via-[#0f1118] to-purple-950/20 border-2 border-purple-500/50 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-purple-950/50"
                    >
                      {/* Top Ambient Accent */}
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-600/20 blur-xl rounded-full pointer-events-none" />

                      <div>
                        {/* Header: Title and Status Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
                              <Shield className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white">Staff Reviewing</h3>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/30 text-purple-200 border border-purple-500/40 uppercase">
                                  STAFF
                                </span>
                              </div>
                              <span className="text-[11px] text-purple-300/80 block mt-0.5">
                                Official Script Review
                              </span>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                            Reviewing
                          </span>
                        </div>

                        {/* Review Duration & Script Info */}
                        <div className="mt-4 p-3.5 rounded-xl bg-purple-900/10 border border-purple-500/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-purple-400" />
                              Review Duration
                            </span>
                            <span className="text-sm font-mono font-bold text-purple-200 animate-pulse">
                              {formatDuration(liveDuration)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-purple-500/15 text-xs">
                            <span className="text-[10px] text-gray-400 font-medium">Target Script:</span>
                            <span className="font-semibold text-white truncate max-w-[170px]" title={staff.script_name}>
                              {staff.script_name || "All Scripts"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] text-gray-400 font-medium">Started At:</span>
                            <span className="font-mono text-[11px] text-gray-300">
                              {new Date(staff.review_started).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {/* Anonymity / Zero-Logging Guarantee Notice */}
                        <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-purple-500/20 text-[10px] text-purple-200/90 flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-purple-400 shrink-0" />
                          <span>
                            Zero logs stored. Reviewer identity, IP, and HWID are fully protected and untracked.
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ALT / MULTI-ACCOUNT FARMING DETECTOR BANNER */}
          {farmingClusters.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#16120e] to-amber-950/20 border-2 border-amber-500/50 shadow-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      Multi-Account Farming Detected ({farmingClusters.length} {farmingClusters.length === 1 ? "Cluster" : "Clusters"})
                    </h3>
                    <p className="text-[11px] text-amber-200/70">
                      Concurrent Roblox accounts detected operating from identical network IP addresses or hardware identifiers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {farmingClusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="p-3 rounded-xl bg-[#0e1017]/80 border border-amber-500/30 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-gray-300 font-semibold flex items-center gap-1.5">
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-bold">
                            {cluster.type.toUpperCase()}
                          </span>
                          {cluster.identifier}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {cluster.count} Linked Accounts
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {cluster.accounts.map((acc, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-900 border border-gray-800 text-[11px] text-gray-200"
                          >
                            <RobloxAvatar userId={acc.user_id} username={acc.username} size="sm" />
                            <span className="font-medium text-white">{acc.username}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-800/80">
                      <button
                        type="button"
                        onClick={() => handleKickFarm(cluster)}
                        className="flex-1 py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                        title="Kick all accounts in this cluster immediately"
                      >
                        <ShieldAlert className="w-3 h-3" />
                        Mass-Kick Farm ({cluster.count})
                      </button>

                      {cluster.type === "ip" && (
                        <button
                          type="button"
                          onClick={() => handleBanFarm(cluster)}
                          className="py-1 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                          title="Ban this IP and terminate all concurrent alt sessions"
                        >
                          <ShieldBan className="w-3 h-3" />
                          Ban IP
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-xs text-gray-500 bg-[#12141d] rounded-2xl border border-gray-800">
              Loading player telemetry...
            </div>
          ) : processedSessions.length === 0 ? (
            staffActive.length === 0 && (
              <div className="text-center py-16 bg-[#12141d] border border-gray-800/80 rounded-2xl p-6">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-300 font-semibold">No active players right now</p>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  Players currently executing your script in Roblox will show up here live with real-time ping telemetry.
                </p>
              </div>
            )
          ) : viewMode === "cards" ? (
            /* CARDS GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedSessions.map((s) => (
                <div
                  key={s.id}
                  className={`bg-[#0f1118] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden shadow-xl ${
                    s.is_online && s.status === "loading"
                      ? "border-yellow-500/40 hover:border-yellow-500/60 shadow-yellow-500/5"
                      : s.is_online
                      ? s.is_farming
                        ? "border-amber-500/40 hover:border-amber-500/60 shadow-amber-500/5"
                        : "border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5"
                      : "border-rose-500/40 bg-rose-950/10 opacity-80"
                  }`}
                >
                  {/* Card Header: Avatar, Name, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar Headshot */}
                      <RobloxAvatar userId={s.roblox_user_id} username={s.roblox_username} size="md" />

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white truncate">
                            {s.roblox_username || "Executor User"}
                          </h3>
                          {s.is_farming && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-tight flex items-center gap-1"
                              title={`Alt Farming Cluster: Running alongside ${s.farm_accounts?.join(", ")}`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                              FARM: {s.farming_count}x
                            </span>
                          )}
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
                      {s.is_online && s.status === "loading" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                          In Auth Loader
                        </span>
                      ) : s.is_online ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Active
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

                  {/* In Auth Loader Notice Banner */}
                  {s.is_online && s.status === "loading" && (
                    <div className="mt-3 p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-[11px] text-yellow-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>
                      User is on the key verification screen — not yet authenticated.
                    </div>
                  )}

                  {/* Disconnected Notice Banner on Card */}
                  {!s.is_online && (
                    <div className="mt-3 p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        Session ended.
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Clearing in {s.removal_countdown_sec}s
                      </span>
                    </div>
                  )}

                  {/* Alt Farming Cluster Notice on Card */}
                  {s.is_farming && s.farm_accounts && s.farm_accounts.length > 0 && (
                    <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Multi-Account Farm
                        </span>
                        <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">
                          {s.farming_count} Alts Active
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-200/70 mt-1 truncate">
                        Linked Alts: {s.farm_accounts.join(", ")}
                      </p>
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

                  {/* Device, Network & Game Details */}
                  <div className="mt-3 space-y-1 text-[11px] text-gray-400">
                    {s.place_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Gamepad2 className="w-3 h-3 text-purple-400" />
                          Game:
                        </span>
                        <span className="font-mono text-purple-300 font-semibold truncate max-w-[160px]" title={s.place_name || String(s.place_id)}>
                          {s.place_name || `Place #${s.place_id}`}
                        </span>
                      </div>
                    )}

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
                  <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-gray-800/60">
                    <button
                      type="button"
                      onClick={() =>
                        setMessageModal({
                          sessionId: s.id,
                          username: s.roblox_username || s.ip_address,
                        })
                      }
                      className="py-1.5 px-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/25 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      title="Send In-Game Message"
                    >
                      <Send className="w-3 h-3" />
                      Msg
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setCodeModal({
                          sessionId: s.id,
                          username: s.roblox_username || s.ip_address,
                        })
                      }
                      className="py-1.5 px-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      title="Inject Luau Code into session"
                    >
                      <Code2 className="w-3 h-3" />
                      Code
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTeleportModal({
                          sessionId: s.id,
                          username: s.roblox_username || s.ip_address,
                          placeId: s.place_id || undefined,
                        })
                      }
                      className="py-1.5 px-2 rounded-lg bg-purple-600/15 hover:bg-purple-600/30 text-purple-400 border border-purple-500/25 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      title="Server Hop or Teleport Place"
                    >
                      <Compass className="w-3 h-3" />
                      Hop
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKick(s.id)}
                      className="py-1.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/25 text-[11px] font-semibold transition-colors flex items-center justify-center"
                      title="Remote kick"
                    >
                      Kick
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
                          {s.status === "loading" ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                              In Loader
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Online
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-medium text-white">
                          <div className="flex items-center gap-2.5">
                            <RobloxAvatar userId={s.roblox_user_id} username={s.roblox_username} size="sm" />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{s.roblox_username || "Executor User"}</span>
                                {s.is_farming && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    FARM: {s.farming_count}x
                                  </span>
                                )}
                              </div>
                              {s.roblox_user_id && (
                                <span className="block text-[10px] text-gray-500 font-mono">
                                  ID: {s.roblox_user_id}
                                </span>
                              )}
                            </div>
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
                              onClick={() =>
                                setCodeModal({
                                  sessionId: s.id,
                                  username: s.roblox_username || s.ip_address,
                                })
                              }
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition-colors"
                              title="Inject Luau Code"
                            >
                              Code
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTeleportModal({
                                  sessionId: s.id,
                                  username: s.roblox_username || s.ip_address,
                                  placeId: s.place_id || undefined,
                                })
                              }
                              className="px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 text-[11px] font-medium transition-colors"
                              title="Server Hop / Teleport"
                            >
                              Hop
                            </button>
                            {s.is_farming && (
                              <button
                                type="button"
                                onClick={() => {
                                  const cl = farmingClusters.find((c) => c.identifier === s.ip_address || (s.hwid && c.identifier === s.hwid));
                                  if (cl) handleKickFarm(cl);
                                  else handleKick(s.id);
                                }}
                                className="px-2 py-1 rounded bg-amber-500/25 hover:bg-amber-500/45 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors"
                                title="Kick all alts in this farm cluster"
                              >
                                Kick Farm
                              </button>
                            )}
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

      {/* STAFF HISTORY TAB */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#12141d] border border-gray-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Staff Review History
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {staffHistory.length} Total
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Complete audit log of past and ongoing staff script reviews and durations. All reviewer details are completely unlogged.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Target Script</th>
                    <th className="p-3.5">Review Key Label</th>
                    <th className="p-3.5">Review Started</th>
                    <th className="p-3.5">Review Duration</th>
                    <th className="p-3.5 text-right">Logging Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {staffHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-60" />
                        <p className="text-sm text-gray-300 font-semibold">No staff reviews logged yet</p>
                        <p className="text-xs text-gray-500 mt-1">
                          When staff execute your script using a Staff Review Key, review durations will record here automatically.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    staffHistory.map((item) => {
                      const isCurrentlyActive = staffActive.some((a) => a.id === item.id);
                      const startTime = new Date(item.review_started).getTime();
                      const liveDurationSec = isCurrentlyActive
                        ? Math.max(0, Math.floor((now - startTime) / 1000))
                        : item.duration_seconds;

                      return (
                        <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="p-3.5">
                            {isCurrentlyActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                                Active Reviewing
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                                <Check className="w-3 h-3 text-emerald-400" />
                                Review Completed
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-white">
                              {item.script_name || "All Scripts"}
                            </span>
                            <span className="text-[10px] font-mono text-gray-500 block">
                              ID: {item.script_id}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30">
                              {item.key_label || "Staff Review Key"}
                            </span>
                          </td>
                          <td className="p-3.5 text-gray-300 font-mono text-[11px]">
                            <div>{new Date(item.review_started).toLocaleDateString()}</div>
                            <div className="text-[10px] text-gray-500">
                              {new Date(item.review_started).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-white bg-gray-800/80 px-2 py-1 rounded border border-gray-700/80">
                              {formatDuration(liveDurationSec)}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <EyeOff className="w-3 h-3" />
                              Zero Data Stored
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BANNED IPS TAB */}
      {activeTab === "bans" && (
        <div className="space-y-4">
          {/* Quick Manual Ban Form */}
          <div className="p-4 bg-[#12141d] border border-gray-800 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldBan className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Direct IP Ban</h3>
                  <p className="text-[11px] text-gray-400">
                    Immediately blacklists the IP from claiming keys, executing loaders, or verifying sessions.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleDirectBanIp} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-semibold text-gray-300">IP Address</label>
                <input
                  type="text"
                  value={banIpInput}
                  onChange={(e) => setBanIpInput(e.target.value)}
                  placeholder="e.g. 192.168.1.100 or 104.28.14.2"
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-rose-500"
                  required
                />
              </div>
              <div className="md:col-span-5 space-y-1">
                <label className="text-[11px] font-semibold text-gray-300">Ban Reason</label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="Reason for blacklist (e.g. Tampering, Scraper, Alt abuse)"
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                />
              </div>
              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={banningIp || !banIpInput.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
                >
                  <ShieldBan className="w-3.5 h-3.5" />
                  <span>{banningIp ? "Banning IP..." : "Ban IP Address"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Bans Table */}
          <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-3 bg-[#0e1017] border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-300 font-semibold">
                <span>Active IP Blacklist</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {Object.keys(bannedIps).length} Banned
                </span>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={banFilterSearch}
                  onChange={(e) => setBanFilterSearch(e.target.value)}
                  placeholder="Search by IP or reason..."
                  className="w-full bg-[#090b10] border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

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
                        No banned IPs. Your blacklist is empty.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(bannedIps)
                      .filter(([ip, data]) => {
                        if (!banFilterSearch.trim()) return true;
                        const q = banFilterSearch.toLowerCase();
                        return ip.toLowerCase().includes(q) || (data.reason || "").toLowerCase().includes(q);
                      })
                      .map(([ip, data]) => (
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
                              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-[11px] transition-colors"
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
        </div>
      )}

      {/* IN-GAME ANNOUNCEMENTS TAB */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#12141d] border border-gray-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Global In-Game Announcements
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {announcements.length} Sent
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Live banners slide down into Roblox player screens in real-time through heartbeat command dispatching.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAnnouncementModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition-all self-start sm:self-auto"
            >
              <Megaphone className="w-4 h-4" />
              New Announcement
            </button>
          </div>

          <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Announcement</th>
                    <th className="p-3.5">Target Scope</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5">Dispatched At</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {announcements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        <Megaphone className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-60" />
                        <p className="text-sm text-gray-300 font-semibold">No announcements dispatched yet</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Click &quot;New Announcement&quot; to broadcast a live notification to all players.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    announcements.map((a) => {
                      const targetScript = scriptsList.find((s) => s.id === a.script_id);
                      return (
                        <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="p-3.5">
                            <span className="font-bold text-white block">{a.title}</span>
                            <span className="text-[11px] text-gray-400 mt-0.5 block max-w-md">
                              {a.message}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30">
                              {a.script_id === "all" ? "All Scripts" : targetScript ? targetScript.name : a.script_id}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-gray-300">
                            {a.duration_seconds}s
                          </td>
                          <td className="p-3.5 font-mono text-gray-400 text-[11px]">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(a.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                              title="Delete announcement record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL CHATROOM TAB */}
      {activeTab === "chatroom" && <ChatroomManager />}

      {/* DMS / CONTACT DEV TAB */}
      {activeTab === "dms" && <DmsManager />}

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

      {/* Remote Luau Code Injection Modal */}
      {codeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#12141e] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Remote Luau Code Injection</h3>
                  <p className="text-[11px] text-gray-400">
                    Executing directly in{" "}
                    <strong className="text-emerald-300">{codeModal.username}</strong>&apos;s active Roblox runtime.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCodeModal(null)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                Quick Templates
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCodeText('print("Aero Auth: Hello from dashboard!")')}
                  className="px-2 py-1 rounded bg-[#0b0d14] hover:bg-gray-800 border border-gray-700 text-[10px] text-gray-300 font-mono transition-colors"
                >
                  Print Test
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCodeText(
                      'pcall(function() game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = 48 end)'
                    )
                  }
                  className="px-2 py-1 rounded bg-[#0b0d14] hover:bg-gray-800 border border-gray-700 text-[10px] text-gray-300 font-mono transition-colors"
                >
                  Speed 48
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCodeText(
                      'game:GetService("StarterGui"):SetCore("SendNotification", { Title = "Aero Auth", Text = "Admin executed remote code in your session.", Duration = 6 })'
                    )
                  }
                  className="px-2 py-1 rounded bg-[#0b0d14] hover:bg-gray-800 border border-gray-700 text-[10px] text-gray-300 font-mono transition-colors"
                >
                  Client Notification
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={codeText}
              onChange={(e) => setCodeText(e.target.value)}
              placeholder="-- Enter arbitrary Luau code to execute in-game&#10;print('Hello Roblox')"
              className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-3 font-mono text-xs text-emerald-300 outline-none focus:border-emerald-500 leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Code executes via executor loadstring on next heartbeat
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCodeModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCode}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Dispatch Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Teleport & Server Hop Modal */}
      {teleportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12141e] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Teleport & Server Hop</h3>
                  <p className="text-[11px] text-gray-400">
                    Remote teleportation for <strong className="text-purple-300">{teleportModal.username}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTeleportModal(null)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b0d14] border border-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTeleportMode("hop")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  teleportMode === "hop"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Server Hop (Same Game)
              </button>
              <button
                type="button"
                onClick={() => setTeleportMode("place")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  teleportMode === "place"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Target Place ID
              </button>
            </div>

            {teleportMode === "hop" ? (
              <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-xl text-xs text-purple-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-purple-400" />
                  Server Hop Description
                </p>
                <p className="text-[11px] text-gray-300">
                  Automatically queries public game instances via Roblox Games API and teleports the player to a different active server.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 block">
                  Target Roblox Place ID:
                </label>
                <input
                  type="text"
                  value={targetPlaceId}
                  onChange={(e) => setTargetPlaceId(e.target.value)}
                  placeholder="e.g. 189707 or 6068496246"
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 font-mono text-xs text-white outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-gray-500">
                  Calls <code className="text-purple-300">TeleportService:Teleport(placeId)</code> in player context.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTeleportModal(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTeleport}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                Dispatch Teleport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global In-Game Announcement Modal */}
      {announcementModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12141e] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Broadcast In-Game Announcement</h3>
                  <p className="text-[11px] text-gray-400">
                    Displays animated top banner on connected player screens.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnnouncementModal(false)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Target Script Scope:
                </label>
                <select
                  value={announcementScript}
                  onChange={(e) => setAnnouncementScript(e.target.value)}
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">All Scripts (Global Broadcast)</option>
                  {scriptsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (/{s.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Banner Title:
                </label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="e.g. SYSTEM UPDATE / MAINTENANCE"
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Announcement Message:
                </label>
                <textarea
                  rows={3}
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  placeholder="e.g. New update v2.4 released! Re-execute for new features."
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  On-Screen Duration:
                </label>
                <select
                  value={announcementDuration}
                  onChange={(e) => setAnnouncementDuration(e.target.value)}
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="5">5 Seconds</option>
                  <option value="10">10 Seconds (Default)</option>
                  <option value="15">15 Seconds</option>
                  <option value="30">30 Seconds</option>
                  <option value="60">60 Seconds</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAnnouncementModal(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcastAnnouncement}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 flex items-center gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Broadcast Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL BAN IP MODAL */}
      {banModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#12141d] border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldBan className="w-4 h-4" />
                </div>
                <span>Ban IP Address</span>
              </div>
              <button
                type="button"
                onClick={() => setBanModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDirectBanIp} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Target IP Address:
                </label>
                <input
                  type="text"
                  value={banIpInput}
                  onChange={(e) => setBanIpInput(e.target.value)}
                  placeholder="e.g. 192.168.1.100 or 104.28.14.2"
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-rose-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Reason for Blacklist:
                </label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="e.g. Terms of Service Violation / Payload Dumping"
                  className="w-full bg-[#0b0d14] border border-gray-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-300 leading-relaxed">
                <strong>Warning:</strong> Blacklisting an IP terminates all active sessions associated with it and prevents any future key claims, loader downloads, or script executions from that network.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setBanModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={banningIp || !banIpInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldBan className="w-3.5 h-3.5" />
                  <span>{banningIp ? "Blacklisting..." : "Confirm & Ban IP"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
