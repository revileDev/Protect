// app/dashboard/settings/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import type { SystemSettings } from "@/lib/store";
import { Settings, Database, Check, ShieldCheck, Copy, Code, Save, Radio, ShieldBan, Trash2, Search } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    claim_method: "checkpoints",
    checkpoint_delay_seconds: 5,
    discord_guild_id: "",
    discord_bot_token: "",
    discord_invite_url: "https://discord.gg/",
    vpn_detection_enabled: true,
    tos_content: "",
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);

  // IP Blacklist State
  const [bannedIps, setBannedIps] = useState<Record<string, { reason: string; banned_at: string }>>({});
  const [newBanIp, setNewBanIp] = useState("");
  const [newBanReason, setNewBanReason] = useState("");
  const [banningIp, setBanningIp] = useState(false);
  const [banSearchQuery, setBanSearchQuery] = useState("");
  const [banNotice, setBanNotice] = useState<string | null>(null);

  const fetchBannedIps = async () => {
    try {
      const res = await fetch("/api/ip-bans");
      const data = await res.json();
      if (data.banned_ips) setBannedIps(data.banned_ips);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch((err) => console.error(err));
    fetchBannedIps();
  }, []);

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanIp.trim()) return;
    setBanningIp(true);
    try {
      const res = await fetch("/api/ip-bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_address: newBanIp.trim(),
          reason: newBanReason.trim() || "Manual blacklist from Settings console",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBanNotice(`IP ${newBanIp.trim()} blacklisted successfully.`);
        setTimeout(() => setBanNotice(null), 3000);
        setNewBanIp("");
        setNewBanReason("");
        fetchBannedIps();
      } else {
        alert(data.error || "Failed to ban IP");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBanningIp(false);
    }
  };

  const handleUnbanIp = async (ip: string) => {
    try {
      const res = await fetch(`/api/ip-bans?ip=${encodeURIComponent(ip)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setBanNotice(`IP ${ip} removed from blacklist.`);
        setTimeout(() => setBanNotice(null), 3000);
        fetchBannedIps();
      } else {
        alert(data.error || "Failed to unban IP");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const copySqlSchema = () => {
    fetch("/supabase_schema.sql")
      .then((res) => res.text())
      .then((sql) => {
        navigator.clipboard?.writeText(sql);
        setSchemaCopied(true);
        setTimeout(() => setSchemaCopied(false), 2000);
      })
      .catch(() => {
        // Fallback: copy generic instruction
        navigator.clipboard?.writeText("-- Please copy supabase_schema.sql from project root");
      });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-gray-400" />
            Backend & System Configuration
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Manage your Supabase database, claim verification methods, anti-VPN gateway, and Terms of Service.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Settings"}</span>
            </>
          )}
        </button>
      </div>

      {/* Supabase Database Connection Card */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Supabase Backend Integration</h2>
              <p className="text-xs text-gray-400">
                PostgreSQL schema, database migrations & API connectivity.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={copySqlSchema}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 transition-all"
          >
            {schemaCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5 text-blue-400" />}
            {schemaCopied ? "Schema Copied!" : "Copy Supabase SQL"}
          </button>
        </div>

        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800 text-xs text-gray-300 space-y-1">
          <p className="font-semibold text-white">Setup Instructions for Supabase:</p>
          <p className="text-gray-400 text-[11px]">
            1. Open your Supabase Dashboard &rarr; <strong>SQL Editor</strong> &rarr; Click <em>&quot;Copy Supabase SQL&quot;</em> above and paste it to generate all tables and indexes.
          </p>
          <p className="text-gray-400 text-[11px]">
            2. In your <code>.env.local</code> file in this project, set:
          </p>
          <div className="bg-[#0b0c12] p-2 rounded font-mono text-[11px] text-emerald-300 select-all">
            NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co<br />
            SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
          </div>
          <p className="text-gray-500 text-[10px]">
            *(Even without Supabase keys right now, your website is active with a local database fallback!)*
          </p>
        </div>
      </div>

      {/* Claim Method Settings */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white border-b border-gray-800 pb-2">
          Key Claiming Verification Flow
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Checkpoint Option */}
          <div
            onClick={() => setSettings({ ...settings, claim_method: "checkpoints" })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.claim_method === "checkpoints"
                ? "bg-blue-600/10 border-blue-500/50 text-white"
                : "bg-[#0d0f17] border-gray-800 text-gray-400 hover:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-blue-400">Security Checkpoints</span>
              <input
                type="radio"
                checked={settings.claim_method === "checkpoints"}
                onChange={() => setSettings({ ...settings, claim_method: "checkpoints" })}
                className="accent-blue-500"
              />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Users complete security validation with a timer and anti-VPN check. No Discord bot setup required.
            </p>
          </div>

          {/* Discord OAuth Option */}
          <div
            onClick={() => setSettings({ ...settings, claim_method: "discord_oauth" })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.claim_method === "discord_oauth"
                ? "bg-indigo-600/10 border-indigo-500/50 text-white"
                : "bg-[#0d0f17] border-gray-800 text-gray-400 hover:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-indigo-400">Discord Verification</span>
              <input
                type="radio"
                checked={settings.claim_method === "discord_oauth"}
                onChange={() => setSettings({ ...settings, claim_method: "discord_oauth" })}
                className="accent-indigo-500"
              />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Requires users to join your Discord server before claiming their key. Key binds to their Discord ID.
            </p>
          </div>
        </div>

        {/* Discord Config Fields (if Discord selected) */}
        {settings.claim_method === "discord_oauth" && (
          <div className="pt-2 border-t border-gray-800 space-y-3 text-xs">
            <div>
              <label className="block text-gray-400 font-medium mb-1">Discord Server Invite URL</label>
              <input
                type="text"
                value={settings.discord_invite_url}
                onChange={(e) => setSettings({ ...settings, discord_invite_url: e.target.value })}
                placeholder="https://discord.gg/yourserver"
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 font-medium mb-1">Discord Guild (Server) ID</label>
                <input
                  type="text"
                  value={settings.discord_guild_id}
                  onChange={(e) => setSettings({ ...settings, discord_guild_id: e.target.value })}
                  placeholder="e.g. 119283746592837465"
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 font-medium mb-1">Bot Token (Optional)</label>
                <input
                  type="password"
                  value={settings.discord_bot_token}
                  onChange={(e) => setSettings({ ...settings, discord_bot_token: e.target.value })}
                  placeholder="Bot token"
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anti-VPN & Security Settings */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white border-b border-gray-800 pb-2">
          Security & Anti-VPN Gateway
        </h2>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0d0f17] border border-gray-800">
          <div>
            <span className="text-xs font-bold text-white block">
              Block VPN & Datacenter Proxies on Key Claim
            </span>
            <span className="text-[11px] text-gray-400 block mt-0.5">
              Automatically rejects VPN/Proxy IP addresses and prompts claimant to disable VPN before getting a key.
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.vpn_detection_enabled}
            onChange={(e) => setSettings({ ...settings, vpn_detection_enabled: e.target.checked })}
            className="w-4 h-4 accent-blue-500 cursor-pointer"
          />
        </div>
      </div>

      {/* IP Blacklist & Ban Center */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldBan className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                IP Blacklist & Access Control
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {Object.keys(bannedIps).length} Blacklisted
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Permanently restrict abusive networks, bot farms, and scrapers from accessing loaders or API endpoints.
              </p>
            </div>
          </div>
        </div>

        {banNotice && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>{banNotice}</span>
          </div>
        )}

        {/* Quick Ban Input Form */}
        <form onSubmit={handleBanIp} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3.5 rounded-xl bg-[#0d0f17] border border-gray-800">
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-semibold text-gray-300">IP Address</label>
            <input
              type="text"
              value={newBanIp}
              onChange={(e) => setNewBanIp(e.target.value)}
              placeholder="e.g. 192.168.1.50 or 45.33.32.1"
              className="w-full bg-[#12141d] border border-gray-700/80 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-rose-500"
              required
            />
          </div>
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-semibold text-gray-300">Reason</label>
            <input
              type="text"
              value={newBanReason}
              onChange={(e) => setNewBanReason(e.target.value)}
              placeholder="e.g. Key cracking, scraper bot, DDoS"
              className="w-full bg-[#12141d] border border-gray-700/80 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={banningIp || !newBanIp.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              <ShieldBan className="w-3.5 h-3.5" />
              <span>{banningIp ? "Blacklisting..." : "Ban IP Address"}</span>
            </button>
          </div>
        </form>

        {/* Banned Table with Search */}
        <div className="border border-gray-800 rounded-xl overflow-hidden bg-[#0d0f17]">
          <div className="p-2.5 bg-[#0b0c12] border-b border-gray-800 flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-gray-400">Current Blacklist</span>
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={banSearchQuery}
                onChange={(e) => setBanSearchQuery(e.target.value)}
                placeholder="Search IP or reason..."
                className="w-full bg-[#12141d] border border-gray-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b0d14] text-gray-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0">
                <tr>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {Object.keys(bannedIps).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-500 text-xs">
                      No banned IP addresses.
                    </td>
                  </tr>
                ) : (
                  Object.entries(bannedIps)
                    .filter(([ip, data]) => {
                      if (!banSearchQuery.trim()) return true;
                      const q = banSearchQuery.toLowerCase();
                      return ip.toLowerCase().includes(q) || (data.reason || "").toLowerCase().includes(q);
                    })
                    .map(([ip, data]) => (
                      <tr key={ip} className="hover:bg-gray-800/20">
                        <td className="p-3 font-mono font-bold text-rose-400">{ip}</td>
                        <td className="p-3 text-gray-300 text-[11px]">{data.reason}</td>
                        <td className="p-3 text-gray-500 font-mono text-[10px]">
                          {new Date(data.banned_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnbanIp(ip)}
                            className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-[10px] transition-colors"
                          >
                            Unban
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

      {/* Terms of Service (TOS) Editor */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl space-y-3">
        <h2 className="text-sm font-bold text-white border-b border-gray-800 pb-2">
          Frontpage Terms of Service (TOS) Content
        </h2>
        <p className="text-xs text-gray-400">
          This text is rendered publicly on your website&apos;s homepage.
        </p>

        <textarea
          rows={6}
          value={settings.tos_content}
          onChange={(e) => setSettings({ ...settings, tos_content: e.target.value })}
          className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-xl p-3 text-xs text-white font-mono outline-none focus:border-blue-500 leading-relaxed"
        />
      </div>
    </div>
  );
}
