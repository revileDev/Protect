// app/dashboard/analytics/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Users,
  Activity,
  Filter,
  RefreshCw,
  Laptop,
  ShieldAlert,
  Search,
  Download,
  Trash2,
  Globe,
  Radio,
  FileCode,
  Gamepad2,
  Clock,
  Compass,
  Bug,
  Copy,
  Check,
  Terminal,
  X,
  AlertTriangle,
  Zap,
  Flame,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import type { ExecutionLog, ClientErrorLog } from "@/lib/store";
import WorldMapTelemetry, { ActivePlayerSession } from "@/components/WorldMapTelemetry";

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
  const initials = username ? username.substring(0, 2).toUpperCase() : "??";

  const sizeClass =
    size === "sm"
      ? "w-7 h-7 rounded-lg text-[10px]"
      : size === "lg"
      ? "w-12 h-12 rounded-2xl text-sm"
      : "w-9 h-9 rounded-xl text-xs";

  if (userId && !imgError) {
    return (
      <div className={`${sizeClass} overflow-hidden bg-[#0A0C13] border border-zinc-800 shrink-0 relative shadow-inner flex items-center justify-center`}>
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
      className={`${sizeClass} bg-gradient-to-br from-cyan-950 via-zinc-900 to-black border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 shrink-0 shadow-inner font-mono`}
    >
      {initials}
    </div>
  );
}

interface TimelinePoint {
  key: string;
  label: string;
  passed: number;
  failed: number;
  total: number;
}

interface AnalyticsData {
  timeframe: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  uniqueUsers: number;
  uniqueIps: number;
  checkpointsStarted: number;
  checkpointsCompleted: number;
  checkpointConversionRate: number;
  failureReasons: Record<string, number>;
  executors: Record<string, number>;
  topExecutors?: { name: string; count: number; percentage: number }[];
  topGames?: { place_id: string; place_name: string; count: number; percentage: number }[];
  avgSessionDurationSec?: number;
  operatingSystems?: Record<string, number>;
  scriptsBreakdown?: Record<string, { total: number; passed: number; failed: number }>;
  timeline: TimelinePoint[];
  recentLogs: ExecutionLog[];
}

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year" | "all">("all");
  const [selectedScript, setSelectedScript] = useState<string>("all");
  const [scriptsList, setScriptsList] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActivePlayerSession[]>([]);
  const [clientErrors, setClientErrors] = useState<ClientErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeLogTab, setActiveLogTab] = useState<"audit" | "errors">("audit");
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copiedTrace, setCopiedTrace] = useState(false);

  // Fetch available scripts for filtering
  useEffect(() => {
    fetch("/api/scripts")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.scripts) {
          setScriptsList(resData.scripts);
        }
      })
      .catch((err) => console.error("Error fetching scripts list", err));
  }, []);

  // Fetch main analytics and active players telemetry
  const fetchAnalytics = async (tf = timeframe, scId = selectedScript) => {
    try {
      const url = new URL("/api/analytics", window.location.origin);
      url.searchParams.set("timeframe", tf);
      if (scId && scId !== "all") url.searchParams.set("script_id", scId);

      const [analyticsRes, playersRes, errorsRes] = await Promise.all([
        fetch(url.toString()),
        fetch("/api/players"),
        fetch("/api/telemetry/errors"),
      ]);

      const [analyticsJson, playersJson, errorsJson] = await Promise.all([
        analyticsRes.json(),
        playersRes.json(),
        errorsRes.json(),
      ]);

      if (analyticsJson && !analyticsJson.error) {
        setData(analyticsJson);
      }
      if (playersJson && playersJson.sessions) {
        setActiveSessions(playersJson.sessions);
      }
      if (errorsJson && errorsJson.errors) {
        setClientErrors(errorsJson.errors);
      }
    } catch (err) {
      console.error("Failed to load telemetry", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearClientErrors = async () => {
    if (!confirm("Are you sure you want to clear all client runtime errors?")) return;
    try {
      await fetch("/api/telemetry/errors", { method: "DELETE" });
      setClientErrors([]);
      showToast("Client error logs cleared.");
    } catch {
      alert("Failed to clear error logs.");
    }
  };

  const handleCopyTrace = (trace: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(trace);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAnalytics(timeframe, selectedScript);
  }, [timeframe, selectedScript]);

  // Auto-refresh telemetry every 5s if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAnalytics(timeframe, selectedScript);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, timeframe, selectedScript]);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data || !data.recentLogs || data.recentLogs.length === 0) {
      alert("No execution logs to export.");
      return;
    }

    const headers = [
      "ID",
      "Timestamp",
      "Script",
      "Status",
      "Roblox Username",
      "Roblox User ID",
      "Executor",
      "OS",
      "IP Address",
      "Country",
      "City",
      "Key Last 4",
      "Failure Reason",
    ];

    const rows = data.recentLogs.map((log) => [
      log.id,
      log.created_at,
      log.script_name,
      log.status,
      log.roblox_username || "N/A",
      log.roblox_user_id || "N/A",
      log.executor || "Unknown",
      log.os || "Unknown",
      log.ip_address,
      log.country || "N/A",
      log.city || "N/A",
      log.key_last4 || "NONE",
      `"${(log.failure_reason || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_logs_${timeframe}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Analytics logs exported to CSV.");
  };

  // Clear analytics logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all analytics and execution logs? This cannot be undone.")) return;
    try {
      await fetch("/api/analytics", { method: "DELETE" });
      showToast("Analytics logs have been cleared.");
      fetchAnalytics(timeframe, selectedScript);
    } catch {
      alert("Failed to clear analytics.");
    }
  };

  const total = data?.totalExecutions || 0;
  const passed = data?.passedExecutions || 0;
  const failed = data?.failedExecutions || 0;
  const passRate = data?.passRate ?? 100;
  const uniqueUsers = data?.uniqueUsers || 0;
  const uniqueIps = data?.uniqueIps || 0;

  const cpStarted = data?.checkpointsStarted || 0;
  const cpCompleted = data?.checkpointsCompleted || 0;
  const cpRate = data?.checkpointConversionRate ?? 100;
  const cpDropped = Math.max(0, cpStarted - cpCompleted);

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  // Filter recent logs by search query
  const filteredLogs = (data?.recentLogs || []).filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.roblox_username && log.roblox_username.toLowerCase().includes(q)) ||
      (log.roblox_user_id && log.roblox_user_id.toLowerCase().includes(q)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(q)) ||
      (log.script_name && log.script_name.toLowerCase().includes(q)) ||
      (log.executor && log.executor.toLowerCase().includes(q)) ||
      (log.failure_reason && log.failure_reason.toLowerCase().includes(q)) ||
      (log.country && log.country.toLowerCase().includes(q)) ||
      (log.city && log.city.toLowerCase().includes(q)) ||
      (log.key_last4 && log.key_last4.toLowerCase().includes(q))
    );
  });

  // Filter client runtime errors by search query
  const filteredErrors = clientErrors.filter((err) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (err.roblox_username && err.roblox_username.toLowerCase().includes(q)) ||
      (err.roblox_user_id && err.roblox_user_id.toLowerCase().includes(q)) ||
      (err.script_name && err.script_name.toLowerCase().includes(q)) ||
      (err.executor && err.executor.toLowerCase().includes(q)) ||
      (err.error_message && err.error_message.toLowerCase().includes(q)) ||
      (err.os && err.os.toLowerCase().includes(q))
    );
  });

  // Calculate max volume for activity timeline bars
  const timeline = data?.timeline || [];
  const maxTimelineTotal = Math.max(1, ...timeline.map((t) => t.total));

  return (
    <div className="space-y-6">
      {/* Fitted Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight font-mono flex items-center gap-2">
                Live Execution Radar & Telemetry Engine
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                  {total} Executions
                </span>
              </h1>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Real-time tracking of script executions, global player locations, executor market share, and security funnels.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Target Script Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#0D1017] border border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm">
            <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={selectedScript}
              onChange={(e) => setSelectedScript(e.target.value)}
              className="bg-transparent text-zinc-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0D1017]">All Scripts</option>
              {scriptsList.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0D1017]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter Pills */}
          <div className="flex items-center bg-[#0D1017] border border-zinc-800 p-0.5 rounded-xl">
            {[
              { id: "day", label: "24h" },
              { id: "week", label: "7d" },
              { id: "month", label: "30d" },
              { id: "year", label: "1y" },
              { id: "all", label: "All" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeframe(t.id as any)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  timeframe === t.id
                    ? "bg-cyan-500 text-black font-bold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Live Auto-Refresh Pulse Button */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              autoRefresh
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
            title="Toggle Live Telemetry Auto-Refresh (every 5s)"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
            <span>{autoRefresh ? "Live 5s" : "Paused"}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchAnalytics()}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors shadow-sm"
            title="Refresh now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* 6 Fitted KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Executions */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Runs</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1.5">{total}</p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            {timeframe === "day" ? "Past 24 hours" : timeframe === "week" ? "Past 7 days" : "Recorded total"}
          </span>
        </div>

        {/* Passed Auth */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Passed Auth</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1.5">{passed}</p>
          <span className="text-[10px] text-emerald-400/90 mt-1 block font-semibold">
            {passRate}% Success Rate
          </span>
        </div>

        {/* Failed Auth */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Rejected Auth</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-1.5">{failed}</p>
          <span className="text-[10px] text-rose-400/90 mt-1 block">
            {total > 0 ? Math.round((failed / total) * 100) : 0}% Rejection Rate
          </span>
        </div>

        {/* Unique Players */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Unique Players</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-300 mt-1.5">{uniqueUsers}</p>
          <span className="text-[10px] text-zinc-400 mt-1 block">
            {uniqueIps} Distinct IPs
          </span>
        </div>

        {/* Online Active Sessions */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active Live</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="text-2xl font-bold text-emerald-300">{activeSessions.filter(s => s.status === "active").length}</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            In-game concurrents
          </span>
        </div>

        {/* Average Session Duration */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Avg Session</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-1.5">
            {formatDuration(data?.avgSessionDurationSec || 0)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Player active time
          </span>
        </div>
      </div>

      {/* REAL Interactive Global Radar World Map */}
      <WorldMapTelemetry sessions={activeSessions} logs={data?.recentLogs || []} />

      {/* Activity Timeline Bar Chart */}
      {timeline.length > 0 && (
        <div className="bg-[#0D1017] border border-zinc-800/80 p-5 rounded-2xl shadow-xl space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Hourly Execution Volume & Pass Rate
              </h2>
              <p className="text-xs text-zinc-400">
                Hourly throughput across authentication servers. Cyan represents authorized executions, red represents security rejections.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
                <span className="text-zinc-300">Passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                <span className="text-zinc-300">Rejected</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-44 flex items-end gap-1.5 sm:gap-2.5 w-full">
              {timeline.map((point) => {
                const passedHeight = maxTimelineTotal > 0 ? (point.passed / maxTimelineTotal) * 100 : 0;
                const failedHeight = maxTimelineTotal > 0 ? (point.failed / maxTimelineTotal) * 100 : 0;

                return (
                  <div key={point.key} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Hover Floating Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-[#080A0F] border border-zinc-700 p-2 rounded-xl text-[10px] text-white whitespace-nowrap shadow-xl z-20 pointer-events-none">
                      <span className="font-bold text-cyan-400">{point.label}</span>
                      <span>Total: {point.total}</span>
                      <span className="text-emerald-400">Passed: {point.passed}</span>
                      <span className="text-rose-400">Rejected: {point.failed}</span>
                    </div>

                    {/* Stacked Vertical Bar */}
                    <div className="w-full flex flex-col justify-end h-full">
                      {point.failed > 0 && (
                        <div
                          style={{ height: `${failedHeight}%` }}
                          className="w-full bg-rose-500/80 rounded-t-sm transition-all group-hover:bg-rose-400"
                        />
                      )}
                      <div
                        style={{ height: `${passedHeight}%` }}
                        className={`w-full bg-cyan-500 transition-all group-hover:bg-cyan-400 ${
                          point.failed > 0 ? "" : "rounded-t-sm"
                        }`}
                      />
                    </div>

                    <span className="text-[9px] text-zinc-500 font-mono mt-1.5 truncate max-w-[34px]">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fitted Breakdowns Grid (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {/* Top Roblox Games */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-purple-400" />
            Top Roblox Games
          </h2>

          {!data?.topGames || data.topGames.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">No Roblox game telemetry tracked yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.topGames.map((g) => {
                return (
                  <div key={g.place_id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <div className="truncate max-w-[180px]">
                        <span className="text-zinc-200 font-semibold block truncate" title={g.place_name}>
                          {g.place_name}
                        </span>
                        <a
                          href={`https://www.roblox.com/games/${g.place_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <span>Place #{g.place_id}</span>
                          <Compass className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <span className="text-zinc-400 shrink-0 text-[11px]">
                        {g.count} ({g.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${g.percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Executors Detected */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Laptop className="w-4 h-4 text-cyan-400" />
            Roblox Executors Detected
          </h2>

          {Object.keys(data?.executors || {}).length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">No executor data logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(data?.executors || {}).map(([exec, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={exec} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-200 font-semibold truncate max-w-[180px]">{exec}</span>
                      <span className="text-zinc-400 text-[11px]">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Operating Systems & Devices */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            Device Operating Systems
          </h2>

          {Object.keys(data?.operatingSystems || {}).length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">No OS telemetry logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(data?.operatingSystems || {}).map(([os, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={os} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-200 font-semibold truncate max-w-[180px]">{os}</span>
                      <span className="text-zinc-400 text-[11px]">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scripts Breakdown */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            Top Scripts Executed
          </h2>

          {!data?.scriptsBreakdown || Object.keys(data.scriptsBreakdown).length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">No script executions logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(data.scriptsBreakdown).map(([sName, stats]) => {
                const pct = total > 0 ? Math.round((stats.total / total) * 100) : 0;
                return (
                  <div key={sName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-200 font-semibold truncate max-w-[180px]">{sName}</span>
                      <span className="text-zinc-400 text-[11px]">{stats.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security Rejection Breakdown */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Security Rejections Matrix
          </h2>

          {Object.keys(data?.failureReasons || {}).length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">Zero security rejections recorded.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(data?.failureReasons || {}).map(([reason, count]) => {
                const pct = failed > 0 ? Math.round((count / failed) * 100) : 0;
                return (
                  <div key={reason} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 truncate max-w-[180px]">{reason}</span>
                      <span className="text-zinc-400 text-[11px]">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Funnel Conversion */}
        <div className="bg-[#0D1017] border border-zinc-800/80 p-4 rounded-2xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Checkpoint Conversion Funnel
          </h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Claims Funnel Conversion:</span>
              <span className="font-bold text-amber-400">{cpRate}%</span>
            </div>
            <div className="w-full h-3 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex">
              <div
                style={{ width: `${cpRate}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Completed: ${cpRate}%`}
              />
              <div
                style={{ width: `${100 - cpRate}%` }}
                className="bg-rose-500/80 h-full transition-all duration-500"
                title={`Dropped: ${100 - cpRate}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
              <span>Completed: {cpCompleted}</span>
              <span>Bounced: {cpDropped}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fitted Live Audit Stream & Error Logs Container */}
      <div className="bg-[#0D1017] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl font-mono">
        {/* Table Controls & Tabs */}
        <div className="p-4 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0D14]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveLogTab("audit")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeLogTab === "audit"
                  ? "bg-cyan-500 text-black font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Execution Feed</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/30 font-bold">
                {data?.recentLogs?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLogTab("errors")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeLogTab === "errors"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Client Error Telemetry</span>
              {clientErrors.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-400 text-black font-bold">
                  {clientErrors.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={activeLogTab === "audit" ? "Search user, IP, executor..." : "Search error, player, script..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#080A0F] border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
              />
            </div>

            {activeLogTab === "audit" ? (
              <>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold transition-colors"
                  title="Download Logs as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                  title="Clear all logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClearClientErrors}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
                title="Clear all client runtime errors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Errors</span>
              </button>
            )}
          </div>
        </div>

        {activeLogTab === "audit" ? (
          /* EXECUTION AUDIT LOG TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080A0F] border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Result</th>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Script</th>
                  <th className="p-3.5">Roblox Player</th>
                  <th className="p-3.5">Executor / OS</th>
                  <th className="p-3.5">IP & Location</th>
                  <th className="p-3.5">Key Last 4</th>
                  <th className="p-3.5">Outcome / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-zinc-500">
                      Loading telemetry logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-zinc-500">
                      No execution events match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-850/30 transition-colors">
                      <td className="p-3.5">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Fail
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5">
                        <span className="text-cyan-300 font-semibold">{log.script_name || "Universal"}</span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <RobloxAvatar userId={log.roblox_user_id} username={log.roblox_username} size="sm" />
                          <div>
                            <span className="text-white font-medium">{log.roblox_username || "Unknown"}</span>
                            {log.roblox_user_id && (
                              <span className="block text-[10px] text-zinc-500">
                                ID: {log.roblox_user_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-zinc-300">
                        <span>{log.executor || "Unknown"}</span>
                        <span className="block text-[10px] text-zinc-500">{log.os}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-zinc-300">{log.ip_address}</span>
                        <span className="block text-[10px] text-zinc-500 truncate max-w-[140px]">
                          {log.city ? `${log.city}, ${log.country}` : log.isp || "Private Node"}
                        </span>
                      </td>
                      <td className="p-3.5 text-zinc-400">
                        ****-{log.key_last4 || "NONE"}
                      </td>
                      <td className="p-3.5 text-zinc-300">
                        {log.status === "success" ? (
                          <span className="text-emerald-400 font-medium">Authorized & Streamed</span>
                        ) : (
                          <span className="text-rose-400">{log.failure_reason || "Access Rejected"}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* CLIENT ERRORS DEBUG TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080A0F] border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Error Message</th>
                  <th className="p-3.5">Player</th>
                  <th className="p-3.5">Script</th>
                  <th className="p-3.5">Executor / OS</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                {filteredErrors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-zinc-500">
                      Zero client runtime errors reported. Your Luau code is running smoothly!
                    </td>
                  </tr>
                ) : (
                  filteredErrors.map((err) => (
                    <React.Fragment key={err.id}>
                      <tr className="hover:bg-zinc-850/30 transition-colors">
                        <td className="p-3.5">
                          <span className="text-rose-400 font-bold block truncate max-w-[320px]">
                            {err.error_message}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <RobloxAvatar userId={err.roblox_user_id} username={err.roblox_username} size="sm" />
                            <span className="text-white font-medium">{err.roblox_username || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-cyan-300 font-medium">{err.script_name || "AtomWare"}</td>
                        <td className="p-3.5 text-zinc-300">
                          <span>{err.executor}</span>
                          <span className="block text-[10px] text-zinc-500">{err.os}</span>
                        </td>
                        <td className="p-3.5 text-zinc-400">
                          {new Date(err.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedErrorId(expandedErrorId === err.id ? null : err.id)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-[11px]"
                          >
                            {expandedErrorId === err.id ? "Hide Stack" : "View Stack"}
                          </button>
                        </td>
                      </tr>

                      {expandedErrorId === err.id && err.stack_trace && (
                        <tr>
                          <td colSpan={6} className="p-4 bg-[#080A0F] border-y border-zinc-800">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold">Lua Stack Trace:</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyTrace(err.stack_trace!)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white text-[10px]"
                                >
                                  {copiedTrace ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedTrace ? "Copied" : "Copy Trace"}</span>
                                </button>
                              </div>
                              <pre className="p-3 rounded-xl bg-black/60 border border-zinc-800 text-rose-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                                {err.stack_trace}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
