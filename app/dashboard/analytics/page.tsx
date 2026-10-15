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
} from "lucide-react";
import type { ExecutionLog } from "@/lib/store";

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
  operatingSystems: Record<string, number>;
  scriptsBreakdown?: Record<string, { total: number; passed: number; failed: number }>;
  timeline?: TimelinePoint[];
  recentLogs: ExecutionLog[];
}

interface ScriptOption {
  id: string;
  name: string;
  slug: string;
}

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year" | "all">("all");
  const [selectedScript, setSelectedScript] = useState<string>("all");
  const [scriptsList, setScriptsList] = useState<ScriptOption[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Fetch scripts list for filter dropdown
  useEffect(() => {
    fetch("/api/scripts")
      .then((res) => res.json())
      .then((json) => {
        if (json.scripts) {
          setScriptsList(
            json.scripts.map((s: any) => ({
              id: s.id,
              name: s.name,
              slug: s.slug,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const fetchAnalytics = async (tf = timeframe, scriptId = selectedScript) => {
    try {
      const params = new URLSearchParams({ timeframe: tf });
      if (scriptId && scriptId !== "all") {
        params.set("script_id", scriptId);
      }
      const res = await fetch(`/api/analytics?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching analytics", err);
    } finally {
      setLoading(false);
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
      "ISP",
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
      log.isp || "N/A",
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
      (log.key_last4 && log.key_last4.toLowerCase().includes(q))
    );
  });

  // Calculate max volume for activity timeline bars
  const timeline = data?.timeline || [];
  const maxTimelineTotal = Math.max(1, ...timeline.map((t) => t.total));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Live Execution & Telemetry Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time tracking of script executions, authentication passes, key validations, and funnel conversion rates.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Script Filter */}
          <div className="flex items-center gap-1.5 bg-[#12141e] border border-gray-800 px-2.5 py-1.5 rounded-xl text-xs">
            <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedScript}
              onChange={(e) => setSelectedScript(e.target.value)}
              className="bg-transparent text-gray-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#12141e]">All Scripts</option>
              {scriptsList.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#12141e]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center bg-[#12141e] border border-gray-800 p-1 rounded-xl text-xs">
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
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Live Auto-Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              autoRefresh
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-gray-800/80 text-gray-400 border-gray-700"
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
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-blue-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Total Executions */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Runs</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1.5">{total}</p>
          <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
            {timeframe === "day" ? "Past 24 hours" : timeframe === "week" ? "Past 7 days" : "Recorded in window"}
          </span>
        </div>

        {/* Passed Auth */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Passed Auth</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-1.5">{passed}</p>
          <span className="text-[10px] text-emerald-400/90 font-mono mt-0.5 block">
            {passRate}% Success Rate
          </span>
        </div>

        {/* Failed Auth */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Rejected Auth</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-300 mt-1.5">{failed}</p>
          <span className="text-[10px] text-rose-400/90 font-mono mt-0.5 block">
            {total > 0 ? Math.round((failed / total) * 100) : 0}% Rejection Rate
          </span>
        </div>

        {/* Unique Players */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Unique Players</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-300 mt-1.5">{uniqueUsers}</p>
          <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">
            {uniqueIps} Distinct IPs
          </span>
        </div>

        {/* Checkpoint Funnel */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl shadow-lg col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Checkpoint Rate</span>
            <Globe className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 mt-1.5">{cpRate}%</p>
          <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">
            {cpCompleted} claimed / {cpStarted} visits
          </span>
        </div>
      </div>

      {/* Activity Timeline Bar Chart */}
      {timeline.length > 0 && (
        <div className="bg-[#12141d] border border-gray-800 p-5 rounded-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Execution Volume Over Time
              </h2>
              <p className="text-[11px] text-gray-400">
                Hourly and daily activity trends across executors.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                <span className="text-gray-300">Passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                <span className="text-gray-300">Failed</span>
              </div>
            </div>
          </div>

          {/* Interactive Stacked Timeline Bars */}
          <div className="pt-2">
            <div className="h-28 flex items-end gap-1.5 sm:gap-2">
              {timeline.map((point) => {
                const totalHeightPct = Math.max(8, Math.round((point.total / maxTimelineTotal) * 100));
                const passHeightPct = point.total > 0 ? (point.passed / point.total) * 100 : 100;

                return (
                  <div
                    key={point.key}
                    className="flex-1 flex flex-col justify-end items-center h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-gray-900 border border-gray-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap shadow-xl pointer-events-none">
                      <span className="font-bold">{point.label}</span>
                      <span className="text-emerald-400">{point.passed} passed • {point.failed} failed</span>
                    </div>

                    {/* Stacked bar */}
                    <div
                      style={{ height: `${totalHeightPct}%` }}
                      className="w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-300 group-hover:brightness-125"
                    >
                      <div
                        style={{ height: `${passHeightPct}%` }}
                        className="w-full bg-emerald-500"
                      />
                      <div
                        style={{ height: `${100 - passHeightPct}%` }}
                        className="w-full bg-rose-500"
                      />
                    </div>

                    {/* Bar Label */}
                    <span className="text-[9px] font-mono text-gray-500 mt-1 truncate max-w-full">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Checkpoint Conversion & Drop-off Bar */}
      <div className="bg-[#12141d] border border-gray-800 p-5 rounded-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Checkpoint Completion & Drop-Off
          </h2>
          <span className="text-xs font-mono text-gray-400">
            {cpCompleted} completed ({cpRate}%) • {cpDropped} dropped ({100 - cpRate}%)
          </span>
        </div>

        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
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

        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span>Completed Checkpoint & Claimed Key ({cpCompleted})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 inline-block" />
            <span>Dropped / Left Page ({cpDropped})</span>
          </div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scripts Breakdown */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            Top Scripts Executed
          </h2>

          {!data?.scriptsBreakdown || Object.keys(data.scriptsBreakdown).length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No script executions logged yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.scriptsBreakdown).map(([sName, stats]) => {
                const pct = total > 0 ? Math.round((stats.total / total) * 100) : 0;
                return (
                  <div key={sName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-200 font-semibold truncate max-w-[150px]">{sName}</span>
                      <span className="font-mono text-gray-400">{stats.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Failure Reasons */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Auth Failure Breakdown
          </h2>

          {Object.keys(data?.failureReasons || {}).length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No auth failures recorded in this timeframe.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data!.failureReasons).map(([reason, count]) => {
                const pct = failed > 0 ? Math.round((count / failed) * 100) : 0;
                return (
                  <div key={reason} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 truncate max-w-[150px]">{reason}</span>
                      <span className="font-mono text-gray-400">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Executors */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Laptop className="w-4 h-4 text-purple-400" />
            Executors Detected
          </h2>

          {Object.keys(data?.executors || {}).length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No executor data logged yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data!.executors).map(([exec, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={exec} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-mono truncate max-w-[150px]">{exec}</span>
                      <span className="font-mono text-gray-400">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Operating Systems */}
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Operating Systems
          </h2>

          {Object.keys(data?.operatingSystems || {}).length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No OS telemetry logged yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data!.operatingSystems).map(([os, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={os} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 truncate max-w-[150px]">{os}</span>
                      <span className="font-mono text-gray-400">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Execution Audit Log Table */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Execution Audit Log ({filteredLogs.length} Records)
            </h2>
            <p className="text-[11px] text-gray-400">
              Live chronological stream of key verification attempts and executions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search user, IP, executor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0b0d14] border border-gray-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
              />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-semibold transition-colors"
              title="Download Logs as CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              CSV
            </button>

            {/* Clear Logs */}
            <button
              type="button"
              onClick={handleClearLogs}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
              title="Clear all logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Result</th>
                <th className="p-3.5">Time</th>
                <th className="p-3.5">Script</th>
                <th className="p-3.5">Roblox Player</th>
                <th className="p-3.5">Executor / OS</th>
                <th className="p-3.5">IP & ISP</th>
                <th className="p-3.5">Key Used</th>
                <th className="p-3.5">Outcome / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500 font-sans">
                    Loading telemetry logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500 font-sans">
                    No execution events match your filters. Run your script loader in Roblox to see real-time logs appear here.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="p-3.5 font-sans">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Fail
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-3.5 font-sans">
                      <span className="text-blue-300 font-semibold">{log.script_name || "Universal"}</span>
                    </td>
                    <td className="p-3.5 font-sans">
                      <span className="text-white font-medium">{log.roblox_username || "Unknown"}</span>
                      {log.roblox_user_id && (
                        <span className="block text-[10px] text-gray-500 font-mono">
                          ID: {log.roblox_user_id}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-300">
                      <span>{log.executor || "Unknown"}</span>
                      <span className="block text-[10px] text-gray-500">{log.os}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-gray-300">{log.ip_address}</span>
                      <span className="block text-[10px] text-gray-500 truncate max-w-[140px] font-sans">
                        {log.isp || "Private Network"}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-400">
                      ****-{log.key_last4 || "NONE"}
                    </td>
                    <td className="p-3.5 font-sans text-gray-300">
                      {log.status === "success" ? (
                        <span className="text-emerald-400">Authorized & Payload Delivered</span>
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
      </div>
    </div>
  );
}
