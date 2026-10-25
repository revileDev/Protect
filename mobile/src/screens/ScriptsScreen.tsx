// mobile/src/screens/ScriptsScreen.tsx
import React, { useState, useEffect } from "react";
import {
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  Github,
  RefreshCw,
  Plus,
  Trash2,
  Sliders,
  ExternalLink,
  Shield,
  FileCode,
  X,
} from "lucide-react";
import { ApiService } from "../lib/api";

interface ScriptRecord {
  id: string;
  name: string;
  slug: string;
  entry_file: string;
  modules: Record<string, string>;
  is_active: boolean;
  is_maintenance?: boolean;
  maintenance_message?: string | null;
  github_repo?: string | null;
  github_branch?: string | null;
  github_last_commit?: string | null;
  github_last_pulled_at?: string | null;
}

export default function ScriptsScreen() {
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New script form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newEntryCode, setNewEntryCode] = useState("-- Script Entry\nprint('AtomProtect Initialized')\n");

  const fetchScripts = async () => {
    try {
      const data = await ApiService.getScripts();
      if (data.scripts) setScripts(data.scripts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const getLoadstring = (slug: string) => {
    const serverUrl = ApiService.getServerUrl();
    return `loadstring(game:HttpGet("${serverUrl}/api/loader/${slug}"))()`;
  };

  const copyLoadstring = (s: ScriptRecord) => {
    const ls = getLoadstring(s.slug);
    navigator.clipboard?.writeText(ls);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleMaintenance = async (s: ScriptRecord) => {
    const nextState = !s.is_maintenance;
    let message = s.maintenance_message || "Script is under maintenance. Check Discord.";
    if (nextState) {
      const input = prompt("Enter maintenance message for players:", message);
      if (input === null) return;
      message = input.trim();
    }

    try {
      await ApiService.updateScript({
        id: s.id,
        is_maintenance: nextState,
        maintenance_message: message,
      });
      setScripts((prev) =>
        prev.map((item) =>
          item.id === s.id ? { ...item, is_maintenance: nextState, maintenance_message: message } : item
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to update maintenance mode");
    }
  };

  const toggleActive = async (s: ScriptRecord) => {
    const nextState = !s.is_active;
    try {
      await ApiService.updateScript({
        id: s.id,
        is_active: nextState,
      });
      setScripts((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, is_active: nextState } : item))
      );
    } catch (err: any) {
      alert(err.message || "Failed to toggle active status");
    }
  };

  const handleSyncGithub = async (s: ScriptRecord) => {
    setSyncingId(s.id);
    try {
      await ApiService.syncGithub(s.id);
      await fetchScripts();
      alert("Successfully pulled latest commit from GitHub!");
    } catch (err: any) {
      alert(err.message || "GitHub sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;
    try {
      await ApiService.createScript({
        name: newName.trim(),
        slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""),
        entry_file: "main.lua",
        modules: { "main.lua": newEntryCode },
        is_active: true,
      });
      setShowCreateModal(false);
      setNewName("");
      setNewSlug("");
      fetchScripts();
    } catch (err: any) {
      alert(err.message || "Failed to create script");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this script?")) return;
    try {
      await ApiService.deleteScript(id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete script");
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Scripts Vault
            </h2>
            <p className="text-[11px] text-zinc-400">
              {scripts.length} Script{scripts.length === 1 ? "" : "s"} Managed
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-purple-950/40"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Script</span>
        </button>
      </div>

      {/* Script Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
          <span className="text-xs font-mono">Loading vault...</span>
        </div>
      ) : scripts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-2">
          <FileCode className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
          <p className="text-xs font-semibold text-zinc-400">No scripts found</p>
          <p className="text-[11px]">Click 'New Script' above to deploy a script.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((s) => {
            const moduleCount = Object.keys(s.modules || {}).length;
            return (
              <div
                key={s.id}
                className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-4 space-y-3.5 shadow-md"
              >
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>{s.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                        /{s.slug}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400">
                      <span>{moduleCount} Module{moduleCount === 1 ? "" : "s"}</span>
                      {s.github_repo && (
                        <span className="text-cyan-400 flex items-center gap-1">
                          <Github className="w-3 h-3" />
                          <span>{s.github_branch || "main"}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Maintenance Switch */}
                  <button
                    onClick={() => toggleMaintenance(s)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold font-mono transition-all active:scale-95 ${
                      s.is_maintenance
                        ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{s.is_maintenance ? "MAINTENANCE ON" : "NORMAL"}</span>
                  </button>
                </div>

                {/* Loadstring Display */}
                <div className="bg-[#07080c] rounded-xl border border-zinc-800/80 p-2.5 flex items-center justify-between gap-2">
                  <div className="font-mono text-[10px] text-zinc-400 truncate select-all">
                    {getLoadstring(s.slug)}
                  </div>
                  <button
                    onClick={() => copyLoadstring(s)}
                    className="shrink-0 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-cyan-400 active:scale-90 transition-all"
                    title="Copy Loadstring"
                  >
                    {copiedId === s.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono transition-all ${
                        s.is_active
                          ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {s.is_active ? "Active" : "Disabled"}
                    </button>

                    {s.github_repo && (
                      <button
                        onClick={() => handleSyncGithub(s)}
                        disabled={syncingId === s.id}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-cyan-400 text-[11px] font-mono inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingId === s.id ? "animate-spin text-cyan-400" : ""}`} />
                        <span>Pull Git</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Script Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#0e1118] border border-zinc-800 p-5 space-y-4 shadow-2xl text-zinc-100 safe-bottom max-h-[85vh] overflow-y-auto scroll-container">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-white">Deploy New Script</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateScript} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Script Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                    }
                  }}
                  placeholder="e.g. Rivals Aimbot"
                  required
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. rivals"
                  required
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Initial Luau Code (main.lua)
                </label>
                <textarea
                  rows={4}
                  value={newEntryCode}
                  onChange={(e) => setNewEntryCode(e.target.value)}
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  Deploy Script
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
