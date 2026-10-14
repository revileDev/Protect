// app/dashboard/keys/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { KeyRecord, ScriptRecord } from "@/lib/store";
import { Key, Plus, Copy, Check, Trash2, Ban, ShieldCheck, Filter, Clock, CheckCircle2 } from "lucide-react";

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Generator modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genPrefix, setGenPrefix] = useState("AERO");
  const [genScriptId, setGenScriptId] = useState("");
  const [genDuration, setGenDuration] = useState<string>("lifetime");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchKeys();
    fetchScripts();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/keys");
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/scripts");
      const data = await res.json();
      if (data.scripts) {
        setScripts(data.scripts);
        if (data.scripts.length > 0 && !genScriptId) {
          setGenScriptId(data.scripts[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const durationHours =
        genDuration === "24h"
          ? 24
          : genDuration === "7d"
          ? 168
          : genDuration === "30d"
          ? 720
          : null;

      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: genCount,
          prefix: genPrefix,
          script_id: genScriptId,
          duration_hours: durationHours,
        }),
      });

      const data = await res.json();
      if (data.keys) {
        setKeys((prev) => [...data.keys, ...prev]);
        setShowGenModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusToggle = async (key: KeyRecord) => {
    const newStatus = key.status === "banned" ? (key.activated_at ? "active" : "claimed") : "banned";
    try {
      await fetch("/api/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: key.id, status: newStatus }),
      });
      setKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, status: newStatus } : k))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this key?")) return;
    try {
      await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const copyKey = (id: string, keyStr: string) => {
    navigator.clipboard?.writeText(keyStr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredKeys = keys.filter((k) => {
    if (filterStatus === "all") return true;
    return k.status === filterStatus;
  });

  const unclaimedCount = keys.filter((k) => k.status === "unclaimed").length;
  const claimedNotActivatedCount = keys.filter((k) => k.status === "claimed").length;
  const activatedCount = keys.filter((k) => k.status === "active").length;
  const bannedCount = keys.filter((k) => k.status === "banned").length;

  const renderStatusBadge = (status: KeyRecord["status"]) => {
    switch (status) {
      case "unclaimed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm">
            <span>( Not claimed )</span>
          </span>
        );
      case "claimed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm">
            <span>( Claimed not activated )</span>
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <CheckCircle2 className="w-3 h-3" />
            <span>( Activated )</span>
          </span>
        );
      case "banned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-sm">
            <span>( Banned )</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-700 text-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Key className="w-6 h-6 text-amber-400" />
            License Keys Pool
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Generate and manage keys. Duration timer does not start until a user executes the key in-game for the first time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Generate Keys Batch
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
            ( Not Claimed )
          </span>
          <p className="text-xl font-bold text-amber-300 mt-1">{unclaimedCount}</p>
          <span className="text-[10px] text-gray-500">Available in pool</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">
            ( Claimed Not Activated )
          </span>
          <p className="text-xl font-bold text-blue-300 mt-1">{claimedNotActivatedCount}</p>
          <span className="text-[10px] text-gray-500">Timer not started yet</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">
            ( Activated )
          </span>
          <p className="text-xl font-bold text-emerald-300 mt-1">{activatedCount}</p>
          <span className="text-[10px] text-gray-500">Executed in-game & running</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider block">
            ( Banned )
          </span>
          <p className="text-xl font-bold text-rose-300 mt-1">{bannedCount}</p>
          <span className="text-[10px] text-gray-500">Revoked access</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400 font-medium">Filter Status:</span>
          {[
            { id: "all", label: "All Keys" },
            { id: "unclaimed", label: "( Not claimed )" },
            { id: "claimed", label: "( Claimed not activated )" },
            { id: "active", label: "( Activated )" },
            { id: "banned", label: "( Banned )" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setFilterStatus(st.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filterStatus === st.id
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Keys Table */}
      <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0d14] border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">License Key</th>
                <th className="p-3.5">Status Badge</th>
                <th className="p-3.5">Assigned Script</th>
                <th className="p-3.5">Bound IP Address</th>
                <th className="p-3.5">Claimed Discord</th>
                <th className="p-3.5">Duration / Expiration Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Loading keys...</td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    No keys found in this filter.
                  </td>
                </tr>
              ) : (
                filteredKeys.map((k) => {
                  const boundScript = scripts.find((s) => s.id === k.script_id);
                  return (
                    <tr key={k.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white select-all">{k.key_string}</span>
                          <button
                            type="button"
                            onClick={() => copyKey(k.id, k.key_string)}
                            className="text-gray-400 hover:text-white p-1 rounded"
                            title="Copy Key"
                          >
                            {copiedId === k.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="p-3.5 whitespace-nowrap">
                        {renderStatusBadge(k.status)}
                      </td>

                      {/* Assigned Script */}
                      <td className="p-3.5 whitespace-nowrap">
                        {boundScript ? (
                          <span className="inline-flex px-2 py-0.5 rounded font-mono text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {boundScript.name}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono text-[10px]">Unassigned</span>
                        )}
                      </td>

                      {/* Bound IP */}
                      <td className="p-3.5 font-mono text-gray-300 whitespace-nowrap">
                        {k.claimed_ip ? (
                          <span className="text-blue-300">{k.claimed_ip}</span>
                        ) : (
                          <span className="text-gray-600">Unbound</span>
                        )}
                      </td>

                      {/* Discord */}
                      <td className="p-3.5 text-gray-300 whitespace-nowrap">
                        {k.claimed_discord_tag ? (
                          <span className="text-indigo-400 font-medium">@{k.claimed_discord_tag}</span>
                        ) : (
                          <span className="text-gray-600">N/A</span>
                        )}
                      </td>

                      {/* Duration / Expiration */}
                      <td className="p-3.5 text-gray-400 text-[11px]">
                        {k.status === "unclaimed" ? (
                          <div>
                            <span className="text-gray-300 font-medium">
                              {k.duration_hours ? `${k.duration_hours}h duration` : "Lifetime"}
                            </span>
                            <span className="block text-[10px] text-gray-500">Starts on 1st run</span>
                          </div>
                        ) : k.status === "claimed" ? (
                          <div>
                            <span className="text-blue-300 font-medium">
                              {k.duration_hours ? `${k.duration_hours}h duration` : "Lifetime"}
                            </span>
                            <span className="block text-[10px] text-blue-400/90 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3 inline" /> Timer paused - starts on 1st run
                            </span>
                          </div>
                        ) : k.status === "active" ? (
                          <div>
                            <span className="text-emerald-300 font-medium">
                              {k.duration_hours ? `${k.duration_hours}h active` : "Lifetime active"}
                            </span>
                            {k.expires_at ? (
                              <span className="block text-[10px] text-emerald-400 font-mono">
                                Expires: {new Date(k.expires_at).toLocaleString()}
                              </span>
                            ) : (
                              <span className="block text-[10px] text-emerald-400 font-mono">
                                Permanent key
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-rose-400 font-medium">Access revoked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(k)}
                            className={`p-1.5 rounded transition-colors ${
                              k.status === "banned"
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-amber-400 hover:bg-amber-500/10"
                            }`}
                            title={k.status === "banned" ? "Unban Key" : "Ban Key"}
                          >
                            {k.status === "banned" ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(k.id)}
                            className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#12141f] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                Generate Keys into Pool
              </h3>
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Target Script</label>
                <select
                  value={genScriptId}
                  onChange={(e) => setGenScriptId(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (/{s.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Keys will be locked exclusively to this script.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Key Count</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Prefix</label>
                  <input
                    type="text"
                    value={genPrefix}
                    onChange={(e) => setGenPrefix(e.target.value.toUpperCase())}
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Duration</label>
                <select
                  value={genDuration}
                  onChange={(e) => setGenDuration(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="lifetime">Lifetime (Permanent)</option>
                </select>
                <p className="text-[10px] text-emerald-400 mt-1">
                  Duration countdown will only begin after the user&apos;s first execution in-game.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
