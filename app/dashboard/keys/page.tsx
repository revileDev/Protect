// app/dashboard/keys/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import type { KeyRecord, ScriptRecord } from "@/lib/store";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Ban,
  ShieldCheck,
  Filter,
  Clock,
  CheckCircle2,
  Shield,
  Sparkles,
  Edit3,
  X,
  FileText,
} from "lucide-react";

function isStaffReviewKey(k: KeyRecord | null | undefined): boolean {
  if (!k) return false;
  return (
    k.is_staff_review === true ||
    k.claimed_discord_tag === "STAFF_REVIEW" ||
    k.claimed_discord_id === "STAFF_REVIEW" ||
    Boolean(k.key_string && (k.key_string.startsWith("STAFF-") || k.key_string.startsWith("STAFF_")))
  );
}

function isLifetimePaidKey(k: KeyRecord | null | undefined): boolean {
  if (!k) return false;
  if (isStaffReviewKey(k)) return false;
  return k.duration_hours === null || k.duration_hours === undefined;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Generator modal (Regular batch / Lifetime)
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genPrefix, setGenPrefix] = useState("AERO");
  const [genScriptId, setGenScriptId] = useState("");
  const [genDuration, setGenDuration] = useState<string>("lifetime");
  const [genNotes, setGenNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  // Note editing state for existing keys
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Staff Review Key modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffScriptId, setStaffScriptId] = useState("all");
  const [staffKeyMode, setStaffKeyMode] = useState<"auto" | "custom">("auto");
  const [staffCustomKey, setStaffCustomKey] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [staffGenerating, setStaffGenerating] = useState(false);

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
          notes: genNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.keys) {
        setKeys((prev) => [...data.keys, ...prev]);
        setShowGenModal(false);
        setGenNotes("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const startEditNote = (k: KeyRecord) => {
    setEditingNoteId(k.id);
    setEditNoteValue(k.notes || "");
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteValue("");
  };

  const handleSaveNote = async (id: string) => {
    setSavingNote(true);
    try {
      const trimmed = editNoteValue.trim();
      const res = await fetch("/api/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: trimmed || null }),
      });
      if (res.ok) {
        setKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, notes: trimmed || null } : k))
        );
        setEditingNoteId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleCreateStaffReviewKey = async () => {
    setStaffGenerating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_staff_review: true,
          script_id: staffScriptId || "all",
          custom_key: staffKeyMode === "custom" ? staffCustomKey.trim() : "",
          notes: staffNotes.trim() || "Staff Review Key",
        }),
      });

      const data = await res.json();
      if (data.keys) {
        setKeys((prev) => [...data.keys, ...prev]);
        setShowStaffModal(false);
        setStaffCustomKey("");
        setStaffNotes("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStaffGenerating(false);
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

  const handleBanIp = async (ip: string) => {
    const reason = prompt(`Enter blacklist reason for IP ${ip}:`, "License Key Abuse / Script Tampering");
    if (!reason) return;
    try {
      const res = await fetch("/api/ip-bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip_address: ip, reason }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`IP ${ip} has been permanently blacklisted.`);
      } else {
        alert(data.error || "Failed to ban IP");
      }
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
    if (filterStatus === "staff") return isStaffReviewKey(k);
    if (filterStatus === "lifetime") return isLifetimePaidKey(k);
    if (isStaffReviewKey(k)) return false;
    return k.status === filterStatus;
  });

  const staffCount = keys.filter((k) => isStaffReviewKey(k)).length;
  const lifetimePaidCount = keys.filter((k) => isLifetimePaidKey(k)).length;
  const unclaimedCount = keys.filter((k) => !isStaffReviewKey(k) && !isLifetimePaidKey(k) && k.status === "unclaimed").length;
  const claimedNotActivatedCount = keys.filter((k) => !isStaffReviewKey(k) && k.status === "claimed").length;
  const activatedCount = keys.filter((k) => !isStaffReviewKey(k) && k.status === "active").length;
  const bannedCount = keys.filter((k) => k.status === "banned").length;

  const renderStatusBadge = (key: KeyRecord) => {
    if (isStaffReviewKey(key)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>( Staff Review Key )</span>
        </span>
      );
    }
    if (isLifetimePaidKey(key)) {
      if (key.status === "banned") {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-sm">
            <span>( Banned Lifetime )</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-sm">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>{key.status === "active" ? "( Active Lifetime )" : "( Paid Lifetime )"}</span>
        </span>
      );
    }
    switch (key.status) {
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
            {key.status}
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

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowStaffModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all border border-purple-500/30"
          >
            <Shield className="w-4 h-4 text-purple-200" />
            + New Staff Review Key
          </button>

          <button
            type="button"
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Generate Keys Batch
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#12141d] border border-purple-500/30 p-3.5 rounded-xl shadow-sm">
          <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">
            ( Staff Review )
          </span>
          <p className="text-xl font-bold text-purple-300 mt-1">{staffCount}</p>
          <span className="text-[10px] text-gray-500">Infinite • Untracked</span>
        </div>

        <div className="bg-[#12141d] border border-emerald-500/30 p-3.5 rounded-xl shadow-sm">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            ( Paid Lifetime )
          </span>
          <p className="text-xl font-bold text-emerald-300 mt-1">{lifetimePaidCount}</p>
          <span className="text-[10px] text-emerald-500/80">Direct buyers • Auto-IP</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-3.5 rounded-xl">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
            ( Checkpoint Pool )
          </span>
          <p className="text-xl font-bold text-amber-300 mt-1">{unclaimedCount}</p>
          <span className="text-[10px] text-gray-500">Timed keys for /claim</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-3.5 rounded-xl">
          <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">
            ( Claimed )
          </span>
          <p className="text-xl font-bold text-blue-300 mt-1">{claimedNotActivatedCount}</p>
          <span className="text-[10px] text-gray-500">Timer not started</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-3.5 rounded-xl">
          <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider block">
            ( Activated )
          </span>
          <p className="text-xl font-bold text-cyan-300 mt-1">{activatedCount}</p>
          <span className="text-[10px] text-gray-500">Executed & running</span>
        </div>

        <div className="bg-[#12141d] border border-gray-800 p-3.5 rounded-xl">
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
            { id: "staff", label: "( Staff Review Keys )" },
            { id: "lifetime", label: "💎 ( Paid Lifetime )" },
            { id: "unclaimed", label: "( Checkpoint Pool )" },
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
                <th className="p-3.5">Note / Discord</th>
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
                  const isLifetime = isLifetimePaidKey(k);
                  return (
                    <tr key={k.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white select-all">{k.key_string}</span>
                          {isStaffReviewKey(k) && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              STAFF
                            </span>
                          )}
                          {isLifetime && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              PAID
                            </span>
                          )}
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
                        {renderStatusBadge(k)}
                      </td>

                      {/* Assigned Script */}
                      <td className="p-3.5 whitespace-nowrap">
                        {k.script_id === "all" ? (
                          <span className="inline-flex px-2 py-0.5 rounded font-mono text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            All Scripts (Universal)
                          </span>
                        ) : boundScript ? (
                          <span className="inline-flex px-2 py-0.5 rounded font-mono text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {boundScript.name}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono text-[10px]">Unassigned</span>
                        )}
                      </td>

                      {/* Bound IP */}
                      <td className="p-3.5 font-mono text-gray-300 whitespace-nowrap">
                        {isStaffReviewKey(k) ? (
                          <span className="text-purple-300 font-sans font-medium text-[11px] flex items-center gap-1">
                            <span>♾️ Infinite (No Lock)</span>
                          </span>
                        ) : k.claimed_ip ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-blue-300">{k.claimed_ip}</span>
                            <button
                              type="button"
                              onClick={() => handleBanIp(k.claimed_ip!)}
                              className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 border border-rose-500/25 text-[10px] font-sans font-medium transition-colors"
                              title={`Ban IP ${k.claimed_ip}`}
                            >
                              Ban IP
                            </button>
                          </div>
                        ) : isLifetime ? (
                          <span className="text-emerald-500/80 font-sans text-[11px]">Unbound (Binds on 1st run)</span>
                        ) : (
                          <span className="text-gray-600">Unbound</span>
                        )}
                      </td>

                      {/* Note & Discord */}
                      <td className="p-3.5 text-gray-300">
                        {editingNoteId === k.id ? (
                          <div className="flex items-center gap-1.5 min-w-[200px]">
                            <input
                              type="text"
                              value={editNoteValue}
                              onChange={(e) => setEditNoteValue(e.target.value)}
                              placeholder="Buyer name, Discord, order #..."
                              className="w-full bg-[#0d0f17] border border-blue-500/80 rounded px-2 py-1 text-[11px] text-white outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveNote(k.id);
                                if (e.key === "Escape") cancelEditNote();
                              }}
                            />
                            <button
                              type="button"
                              disabled={savingNote}
                              onClick={() => handleSaveNote(k.id)}
                              className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                              title="Save Note"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditNote}
                              className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 group">
                              {k.notes ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 max-w-[180px]">
                                  <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="truncate">{k.notes}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditNote(k)}
                                  className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 border border-dashed border-gray-700 rounded px-1.5 py-0.5 hover:border-gray-500 transition-colors"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  + Note
                                </button>
                              )}
                              {k.notes && (
                                <button
                                  type="button"
                                  onClick={() => startEditNote(k)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-white transition-opacity"
                                  title="Edit Note"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {k.claimed_discord_tag && (
                              <div className="text-[10px] text-indigo-400">
                                @{k.claimed_discord_tag}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Duration / Expiration */}
                      <td className="p-3.5 text-gray-400 text-[11px]">
                        {isStaffReviewKey(k) ? (
                          <div>
                            <span className="text-purple-300 font-medium flex items-center gap-1">
                              <span>♾️ Permanent Lifetime</span>
                            </span>
                            <span className="block text-[10px] text-purple-400/90 font-medium">
                              Zero tracking • No logging
                            </span>
                          </div>
                        ) : isLifetime ? (
                          <div>
                            <span className="text-emerald-300 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              Permanent Lifetime
                            </span>
                            <span className="block text-[10px] text-emerald-400/80">
                              {k.status === "active" ? "Active (Locked to bound IP)" : "Paid key • Auto-binds on 1st run"}
                            </span>
                          </div>
                        ) : k.status === "unclaimed" ? (
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
                            onClick={() => startEditNote(k)}
                            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            title="Edit Note"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
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
                Generate License Keys
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
                  <option value="all">All Scripts (Universal)</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (/{s.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Keys can be locked to a specific script or universal to all scripts.
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
                  <option value="lifetime">Lifetime (Permanent - Paid User)</option>
                  <option value="24h">24 Hours (Checkpoint Pool)</option>
                  <option value="7d">7 Days (Checkpoint Pool)</option>
                  <option value="30d">30 Days (Checkpoint Pool)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Note / Buyer Label <span className="text-gray-500 font-normal">(Optional, e.g. Discord, order #)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Buyer: JohnDoe#1234, Order #4102"
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 placeholder-gray-600"
                />
              </div>

              {genDuration === "lifetime" ? (
                <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-xl p-3 text-[11px] text-emerald-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Paid Lifetime Key Mode
                  </div>
                  <p className="text-emerald-300/80">
                    • <strong>Excluded from Claim Pool:</strong> Users completing checkpoints on the website will NEVER receive this key.
                  </p>
                  <p className="text-emerald-300/80">
                    • <strong>Direct Execution:</strong> Deliver directly to your paid buyer. It activates and locks to their IP automatically on their first in-game run.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-amber-400 mt-1">
                  Timed keys enter the checkpoint pool for users claiming keys via website checkpoints.
                </p>
              )}
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

      {/* Staff Review Key Form Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#12141f] border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Staff Review Key Form
              </h3>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Explanatory Callout */}
            <div className="bg-purple-950/20 border border-purple-500/25 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-purple-300 font-bold">
                <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                Special Unrestricted Key for Staff Script Reviewers
              </div>
              <ul className="text-purple-200/80 text-[11px] space-y-1 list-disc list-inside">
                <li><strong className="text-white">Completely Lifetime:</strong> Never expires, duration countdown is disabled.</li>
                <li><strong className="text-white">Zero Logging & Tracking:</strong> No execution logs, no player telemetry, and no Discord notifications.</li>
                <li><strong className="text-white">Infinite Multi-User:</strong> All staff can share and use this key simultaneously without IP or device locks.</li>
                <li><strong className="text-white">Always Works:</strong> Activated immediately out-of-the-box (no website claiming required).</li>
              </ul>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Applicable Script</label>
                <select
                  value={staffScriptId}
                  onChange={(e) => setStaffScriptId(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="all">🌟 All Scripts (Universal Staff Review Pass)</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (/{s.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Choose &quot;All Scripts&quot; so reviewers can test all your scripts with this single key.
                </p>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1.5">Key String Mode</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setStaffKeyMode("auto")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      staffKeyMode === "auto"
                        ? "bg-purple-600/20 text-purple-300 border-purple-500"
                        : "bg-[#0d0f17] text-gray-400 border-gray-800 hover:text-white"
                    }`}
                  >
                    Auto-Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffKeyMode("custom")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      staffKeyMode === "custom"
                        ? "bg-purple-600/20 text-purple-300 border-purple-500"
                        : "bg-[#0d0f17] text-gray-400 border-gray-800 hover:text-white"
                    }`}
                  >
                    Custom Key Code
                  </button>
                </div>

                {staffKeyMode === "custom" ? (
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. STAFF-REVIEW-PASS-2026"
                      value={staffCustomKey}
                      onChange={(e) => setStaffCustomKey(e.target.value.toUpperCase())}
                      className="w-full bg-[#0d0f17] border border-purple-500/50 rounded-lg px-3 py-2 text-white font-mono uppercase outline-none focus:border-purple-400"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Custom license key code given to the staff reviewers.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-[#0d0f17] border border-gray-800 text-[11px] text-gray-400 font-mono">
                    Will generate: <span className="text-purple-400 font-bold">STAFF-REV-XXXX-XXXX-XXXX</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Staff / Reviewer Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ScriptBlox Moderation Team, V3rmillion Mod"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Reference label to identify which staff team or reviewer this key belongs to.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={staffGenerating}
                onClick={handleCreateStaffReviewKey}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {staffGenerating ? "Creating..." : "Create Staff Review Key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
