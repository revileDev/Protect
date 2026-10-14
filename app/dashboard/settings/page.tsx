// app/dashboard/settings/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { SystemSettings } from "@/lib/store";
import { Settings, Database, Check, ShieldCheck, Copy, Code, Save, Radio } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch((err) => console.error(err));
  }, []);

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
