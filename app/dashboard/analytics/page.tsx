// app/dashboard/analytics/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, CheckCircle2, XCircle, Users, Activity, Filter, RefreshCw, Laptop, ShieldAlert } from "lucide-react";
import { ExecutionLog } from "@/lib/store";

interface AnalyticsData {
  timeframe: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  checkpointsStarted: number;
  checkpointsCompleted: number;
  checkpointConversionRate: number;
  failureReasons: Record<string, number>;
  executors: Record<string, number>;
  operatingSystems: Record<string, number>;
  recentLogs: ExecutionLog[];
}

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year" | "all">("all");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async (tf = timeframe) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?timeframe=${tf}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  const handleTimeframeChange = (tf: "day" | "week" | "month" | "year" | "all") => {
    setTimeframe(tf);
  };

  const total = data?.totalExecutions || 0;
  const passed = data?.passedExecutions || 0;
  const failed = data?.failedExecutions || 0;
  const passRate = data?.passRate ?? 100;

  const cpStarted = data?.checkpointsStarted || 0;
  const cpCompleted = data?.checkpointsCompleted || 0;
  const cpRate = data?.checkpointConversionRate ?? 100;
  const cpDropped = Math.max(0, cpStarted - cpCompleted);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header & Timeframe Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Execution & Key Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Telemetry reports on script executions, authentication passes/failures, and checkpoint completion rates.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#12141e] border border-gray-800 p-1.5 rounded-xl">
          <Filter className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
          {[
            { id: "day", label: "Past Day" },
            { id: "week", label: "Past Week" },
            { id: "month", label: "Past Month" },
            { id: "year", label: "Past Year" },
            { id: "all", label: "All Time" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTimeframeChange(t.id as "day" | "week" | "month" | "year" | "all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                timeframe === t.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/80"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => fetchAnalytics(timeframe)}
            className="p-1 text-gray-400 hover:text-white rounded"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total Executions</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{total}</p>
          <span className="text-[10px] text-gray-500 font-mono mt-1 block">
            {timeframe === "day" ? "In last 24h" : timeframe === "week" ? "In last 7 days" : "Selected window"}
          </span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Passed Auth</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-2">{passed}</p>
          <span className="text-[10px] text-emerald-400/80 font-mono mt-1 block">
            {passRate}% Success Rate
          </span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Failed Auth</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-300 mt-2">{failed}</p>
          <span className="text-[10px] text-rose-400/80 font-mono mt-1 block">
            {total > 0 ? Math.round((failed / total) * 100) : 0}% Rejection Rate
          </span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider">Checkpoint Funnel</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 mt-2">{cpRate}%</p>
          <span className="text-[10px] text-gray-400 font-mono mt-1 block">
            {cpCompleted} claimed / {cpStarted} visits
          </span>
        </div>
      </div>

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

      {/* Breakdowns: Failure Reasons, Executors, OS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Failure Reasons */}
        <div className="bg-[#12141d] border border-gray-800 p-5 rounded-xl space-y-3">
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
                      <span className="text-gray-300 truncate max-w-[200px]">{reason}</span>
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
        <div className="bg-[#12141d] border border-gray-800 p-5 rounded-xl space-y-3">
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
                      <span className="text-gray-300 font-mono truncate">{exec}</span>
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
        <div className="bg-[#12141d] border border-gray-800 p-5 rounded-xl space-y-3">
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
                      <span className="text-gray-300 truncate">{os}</span>
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
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Execution Audit Log (Recent {data?.recentLogs.length || 0})
          </h2>
          <span className="text-[11px] text-gray-500">
            Recorded in real-time
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Result</th>
                <th className="p-3.5">Time</th>
                <th className="p-3.5">Roblox User</th>
                <th className="p-3.5">Executor / OS</th>
                <th className="p-3.5">IP & ISP</th>
                <th className="p-3.5">Key Used</th>
                <th className="p-3.5">Details / Failure Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 font-sans">
                    Loading logs...
                  </td>
                </tr>
              ) : !data || data.recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500 font-sans">
                    No execution events recorded yet. Run your script loader in Roblox to see real-time logs here.
                  </td>
                </tr>
              ) : (
                data.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30">
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
