// app/dashboard/scripts/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import ModularScriptUploader from "@/components/ModularScriptUploader";
import ScriptUpdateModal from "@/components/ScriptUpdateModal";
import { LoaderConfigRecord, ScriptRecord } from "@/lib/store";
import { Terminal, Copy, Check, Trash2, Sliders, ExternalLink, ShieldCheck, FileEdit } from "lucide-react";
import Link from "next/link";

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [loaderConfigs, setLoaderConfigs] = useState<LoaderConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingScript, setUpdatingScript] = useState<ScriptRecord | null>(null);

  const fetchData = async () => {
    try {
      const [scriptsRes, configsRes] = await Promise.all([
        fetch("/api/scripts"),
        fetch("/api/loader-configs"),
      ]);
      const scriptsData = await scriptsRes.json();
      const configsData = await configsRes.json();
      setScripts(scriptsData.scripts || []);
      setLoaderConfigs(configsData.configs || []);
    } catch (err) {
      console.error("Error loading scripts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScriptCreated = (newScript: ScriptRecord) => {
    setScripts((prev) => [newScript, ...prev.filter((s) => s.id !== newScript.id)]);
  };

  const handleScriptUpdated = (updatedScript: ScriptRecord) => {
    setScripts((prev) => prev.map((s) => (s.id === updatedScript.id ? updatedScript : s)));
    setUpdatingScript(updatedScript);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this script?")) return;
    try {
      await fetch(`/api/scripts?id=${id}`, { method: "DELETE" });
      setScripts((prev) => prev.filter((s) => s.id !== id));
      if (updatingScript?.id === id) setUpdatingScript(null);
    } catch (err) {
      console.error("Error deleting script", err);
    }
  };

  const getLoadstring = (slug: string) => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `loadstring(game:HttpGet("${protocol}//${host}/api/loader/${slug}"))()`;
  };

  const copyLoadstring = (id: string, slug: string) => {
    const ls = getLoadstring(slug);
    navigator.clipboard?.writeText(ls);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Terminal className="w-6 h-6 text-blue-400" />
          Modular Scripts Vault
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Upload modular Lua projects. Scripts are stored in backend memory and only served securely after in-game key validation.
        </p>
      </div>

      {/* Upload Component */}
      <ModularScriptUploader
        loaderConfigs={loaderConfigs}
        onScriptCreated={handleScriptCreated}
      />

      {/* Stored Scripts List */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-bold text-white">Protected Scripts ({scripts.length})</h2>
            <p className="text-xs text-gray-400">
              Active loadstrings for your executors and Roblox players.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scripts.length > 0 && (
              <button
                type="button"
                onClick={() => setUpdatingScript(scripts[0])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all"
              >
                <FileEdit className="w-3.5 h-3.5" />
                Update Script Files
              </button>
            )}
            <Link
              href="/dashboard/loader-builder"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              Build Auth Loader
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading scripts...</div>
        ) : scripts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl bg-[#0d0f16]/40">
            <ShieldCheck className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">No scripts added yet.</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Upload your first modular folder above to get a secure loadstring.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scripts.map((s) => {
              const numModules = Object.keys(s.modules || {}).length;
              const assignedLoader = loaderConfigs.find((c) => c.id === s.loader_config_id);

              return (
                <div
                  key={s.id}
                  className="bg-[#0b0d14] border border-gray-800/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-700 transition-all"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{s.name}</h3>
                      <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                        /{s.slug}
                      </span>
                      {s.use_auth !== false ? (
                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                          Auth Gate Enabled
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded">
                          Direct Run
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                      <span>
                        Main Entry: <strong className="text-gray-200 font-mono">{s.entry_file}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Total Modules: <strong className="text-gray-200">{numModules}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Loader:{" "}
                        <strong className="text-purple-300">
                          {assignedLoader ? assignedLoader.name : "Default"}
                        </strong>
                      </span>
                    </div>

                    {/* Loadstring box */}
                    <div className="pt-2 flex items-center gap-2 max-w-2xl">
                      <div className="bg-[#12141f] border border-gray-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-blue-300 truncate flex-1 select-all">
                        {getLoadstring(s.slug)}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyLoadstring(s.id, s.slug)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap transition-all"
                      >
                        {copiedId === s.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === s.id ? "Copied" : "Copy Loadstring"}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 md:pt-0">
                    <button
                      type="button"
                      onClick={() => setUpdatingScript(s)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all shadow-sm"
                      title="Update script files without resetting loadstring"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      Update Files
                    </button>
                    <a
                      href={`/api/loader/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
                      title="Inspect Public Loader Code"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                      title="Delete Script"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Script Update Modal */}
      <ScriptUpdateModal
        script={updatingScript}
        isOpen={!!updatingScript}
        onClose={() => setUpdatingScript(null)}
        onScriptUpdated={handleScriptUpdated}
      />
    </div>
  );
}
