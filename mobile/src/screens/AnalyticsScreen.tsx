// mobile/src/screens/AnalyticsScreen.tsx
import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Bug,
  ShieldBan,
  Activity,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Sliders,
  Settings,
} from "lucide-react";
import { ApiService } from "../lib/api";

interface ClientErrorLog {
  id: string;
  script_name?: string | null;
  roblox_username?: string | null;
  executor?: string | null;
  os?: string | null;
  error_message: string;
  stack_trace?: string | null;
  created_at: string;
}

export default function AnalyticsScreen() {
  const [subTab, setSubTab] = useState<"errors" | "bans" | "settings">("errors");
  const [errors, setErrors] = useState<ClientErrorLog[]>([]);
  const [bannedIps, setBannedIps] = useState<Record<string, { reason: string; banned_at: string }>>({});
  const [settings, setSettings] = useState<any>({
    claim_method: "checkpoints",
    vpn_detection_enabled: true,
  });
  const [loading, setLoading] = useState(true);

  // New Ban Input
  const [newBanIp, setNewBanIp] = useState("");
  const [newBanReason, setNewBanReason] = useState("");
  const [banning, setBanning] = useState(false);

  const fetchData = async () => {
    try {
      const [errData, banData, setData] = await Promise.all([
        ApiService.getClientErrors(50).catch(() => ({ errors: [] })),
        ApiService.getBannedIps().catch(() => ({ banned_ips: {} })),
        ApiService.getSettings().catch(() => ({ settings: {} })),
      ]);

      if (errData.errors) setErrors(errData.errors);
      if (banData.banned_ips) setBannedIps(banData.banned_ips);
      if (setData.settings) setSettings(setData.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanIp.trim()) return;
    setBanning(true);
    try {
      await ApiService.banIp(newBanIp.trim(), newBanReason.trim() || "Manual Ban via Mobile");
      setNewBanIp("");
      setNewBanReason("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to ban IP");
    } finally {
      setBanning(false);
    }
  };

  const handleUnbanIp = async (ip: string) => {
    try {
      await ApiService.unbanIp(ip);
      const copy = { ...bannedIps };
      delete copy[ip];
      setBannedIps(copy);
    } catch (err: any) {
      alert(err.message || "Failed to unban IP");
    }
  };

  const handleToggleVpn = async () => {
    const updated = { ...settings, vpn_detection_enabled: !settings.vpn_detection_enabled };
    setSettings(updated);
    try {
      await ApiService.updateSettings(updated);
    } catch (err: any) {
      alert(err.message || "Failed to update settings");
    }
  };

  const bannedList = Object.entries(bannedIps);

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Diagnostics & Network
            </h2>
            <p className="text-[11px] text-zinc-400">
              Executor Errors, IP Blacklist & Config
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-[#0e1118] p-1 rounded-xl border border-zinc-800 text-xs">
        <button
          onClick={() => setSubTab("errors")}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            subTab === "errors"
              ? "bg-blue-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Error Logs ({errors.length})</span>
        </button>
        <button
          onClick={() => setSubTab("bans")}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            subTab === "bans"
              ? "bg-blue-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <ShieldBan className="w-3.5 h-3.5" />
          <span>IP Bans ({bannedList.length})</span>
        </button>
        <button
          onClick={() => setSubTab("settings")}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            subTab === "settings"
              ? "bg-blue-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Config</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-xs font-mono">Loading diagnostics...</span>
        </div>
      ) : subTab === "errors" ? (
        <div className="space-y-2.5">
          {errors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-1">
              <Bug className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-xs font-semibold text-zinc-300">Clean Health - 0 Client Errors</p>
              <p className="text-[11px]">When Roblox executor scripts throw errors, stack traces stream here.</p>
            </div>
          ) : (
            errors.map((err) => (
              <div
                key={err.id}
                className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3.5 space-y-2 font-mono"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-rose-400 truncate max-w-[200px]">
                    {err.script_name || "Script Execution"}
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    {new Date(err.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                  <span>User: {err.roblox_username || "Unknown"}</span>
                  {err.executor && (
                    <span className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-cyan-400">
                      {err.executor}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-[#07080c] border border-rose-950/40 text-[10px] text-rose-300 break-words">
                  {err.error_message}
                </div>

                {err.stack_trace && (
                  <pre className="text-[9px] text-zinc-500 p-2 rounded-lg bg-zinc-950 max-h-24 overflow-y-auto">
                    {err.stack_trace}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      ) : subTab === "bans" ? (
        <div className="space-y-3">
          {/* Add Ban Input */}
          <form onSubmit={handleBanIp} className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3.5 space-y-2.5">
            <h3 className="font-bold text-xs text-white uppercase font-mono">
              Add IP Blacklist Lockout
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newBanIp}
                onChange={(e) => setNewBanIp(e.target.value)}
                placeholder="IP Address (e.g. 1.2.3.4)"
                required
                className="rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
              />
              <input
                type="text"
                value={newBanReason}
                onChange={(e) => setNewBanReason(e.target.value)}
                placeholder="Reason (optional)"
                className="rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={banning}
              className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {banning ? "Banning..." : "Ban Network IP"}
            </button>
          </form>

          {/* Banned IPs List */}
          <div className="space-y-2">
            {bannedList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
                <ShieldBan className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs">No banned IP addresses.</p>
              </div>
            ) : (
              bannedList.map(([ip, data]) => (
                <div
                  key={ip}
                  className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-rose-400">{ip}</span>
                    <span className="block text-[10px] text-zinc-400 mt-0.5">{data.reason}</span>
                  </div>

                  <button
                    onClick={() => handleUnbanIp(ip)}
                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400"
                    title="Unban"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        // System Settings Tab
        <div className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <span className="block font-bold text-xs text-white">VPN & Proxy Filter</span>
              <span className="block text-[10px] text-zinc-400">Block datacenter proxies from generating keys</span>
            </div>
            <button
              onClick={handleToggleVpn}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.vpn_detection_enabled ? "bg-cyan-500" : "bg-zinc-800"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-black transition-transform ${
                  settings.vpn_detection_enabled ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 space-y-2 font-mono">
            <div className="flex justify-between">
              <span>Claim Gateway:</span>
              <span className="text-white capitalize">{settings.claim_method || "checkpoints"}</span>
            </div>
            <div className="flex justify-between">
              <span>Discord Guild ID:</span>
              <span className="text-white">{settings.discord_guild_id || "Configured"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
