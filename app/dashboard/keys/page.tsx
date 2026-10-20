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
  Search,
  RefreshCw,
  Flame,
  UserCheck,
  Zap,
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
  const [bannedIps, setBannedIps] = useState<Record<string, { reason: string; banned_at: string }>>({});
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [purging, setPurging] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);

  // Generator modal (Regular batch / Lifetime)
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genPrefix, setGenPrefix] = useState("ATOM");
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
      if (data.banned_ips) setBannedIps(data.banned_ips);
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

  const handlePurgeExpired = async () => {
    setPurging(true);
    setPurgeFeedback(null);
    try {
      const res = await fetch("/api/keys?action=purge_expired", { method: "DELETE" });
      const data = await res.json();
      await fetchKeys();
      const count = data.purged || 0;
      setPurgeFeedback(count > 0 ? `Purged ${count} expired keys` : "No expired keys found (Pool is clean)");
      setTimeout(() => setPurgeFeedback(null), 3500);
    } catch (err) {
      console.error(err);
      setPurgeFeedback("Error purging keys");
      setTimeout(() => setPurgeFeedback(null), 3000);
    } finally {
      setPurging(false);
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
    const isCurrentlyBanned = Boolean(bannedIps[ip]);
    if (isCurrentlyBanned) {
      if (!confirm(`Unban IP ${ip}? Associated keys will remain status as configured.`)) return;
      try {
        const res = await fetch("/api/ip-bans", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip_address: ip }),
        });
        const data = await res.json();
        if (data.success) {
          fetchKeys();
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

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
        fetchKeys();
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

  // Filter & Search Logic
  const filteredKeys = keys.filter((k) => {
    // 1. Status Filter
    if (filterStatus === "staff" && !isStaffReviewKey(k)) return false;
    if (filterStatus === "lifetime" && !isLifetimePaidKey(k)) return false;
    if (filterStatus !== "all" && filterStatus !== "staff" && filterStatus !== "lifetime") {
      if (isStaffReviewKey(k)) return false;
      if (k.status !== filterStatus) return false;
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const boundScript = scripts.find((s) => s.id === k.script_id);
      const matchKey = k.key_string?.toLowerCase().includes(q);
      const matchNote = k.notes?.toLowerCase().includes(q);
      const matchDiscord = k.claimed_discord_tag?.toLowerCase().includes(q);
      const matchIp = k.claimed_ip?.toLowerCase().includes(q);
      const matchScript = boundScript?.name?.toLowerCase().includes(q);
      return matchKey || matchNote || matchDiscord || matchIp || matchScript;
    }

    return true;
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>STAFF REVIEW</span>
        </span>
      );
    }
    if (isLifetimePaidKey(key)) {
      if (key.status === "banned") {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>BANNED LIFETIME</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>{key.status === "active" ? "ACTIVE LIFETIME" : "PAID LIFETIME"}</span>
        </span>
      );
    }
    switch (key.status) {
      case "unclaimed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>UNCLAIMED</span>
          </span>
        );
      case "claimed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span>CLAIMED</span>
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>ACTIVE</span>
          </span>
        );
      case "banned":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>REVOKED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400">
            {key.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Fitted Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight font-mono flex items-center gap-2">
                Keys Pool & License Control
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                  {keys.length} Total
                </span>
              </h1>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Generate, allocate, and monitor license keys. Expired keys are auto-purged every 10m.
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Purge Expired Action */}
          <button
            type="button"
            onClick={handlePurgeExpired}
            disabled={purging}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-medium bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm disabled:opacity-50"
            title="Purge expired keys immediately from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${purging ? "animate-spin" : ""}`} />
            <span>{purging ? "Purging..." : "Purge Expired"}</span>
          </button>

          {/* Create Staff Key */}
          <button
            type="button"
            onClick={() => setShowStaffModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 transition-all shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>+ Staff Key</span>
          </button>

          {/* Batch Generate Keys Button */}
          <button
            type="button"
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4 text-black stroke-[2.5]" />
            <span>Generate Keys</span>
          </button>
        </div>
      </div>

      {/* Purge Feedback Toast Alert */}
      {purgeFeedback && (
        <div className="px-4 py-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{purgeFeedback}</span>
          </div>
          <button type="button" onClick={() => setPurgeFeedback(null)} className="text-zinc-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Fitted KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#0D1017] border border-zinc-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Total Pool</span>
            <Key className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{keys.length}</span>
            <span className="text-[10px] text-zinc-500 font-mono">keys issued</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">
            Auto-cleaned via <span className="text-zinc-300 font-medium">pg_cron</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1017] border border-zinc-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Active & Bound</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{activatedCount + claimedNotActivatedCount}</span>
            <span className="text-[10px] text-zinc-500 font-mono">in runtime</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{activatedCount} active • {claimedNotActivatedCount} ready</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1017] border border-zinc-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Available Stock</span>
            <Flame className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">{unclaimedCount}</span>
            <span className="text-[10px] text-zinc-500 font-mono">unclaimed</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">
            Ready for checkpoint claims
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1017] border border-zinc-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Staff & Lifetime</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-400">{staffCount + lifetimePaidCount}</span>
            <span className="text-[10px] text-zinc-500 font-mono">permanent</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">
            {staffCount} staff keys • {lifetimePaidCount} lifetime
          </div>
        </div>
      </div>

      {/* Fitted Search & Filter Control Strip */}
      <div className="p-3 bg-[#0D1017] border border-zinc-800/80 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Real-Time Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search key, script, note, IP or Discord..."
            className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none font-mono">
          {[
            { id: "all", label: "All", count: keys.length },
            { id: "unclaimed", label: "Unclaimed", count: unclaimedCount },
            { id: "active", label: "Active", count: activatedCount },
            { id: "claimed", label: "Claimed", count: claimedNotActivatedCount },
            { id: "staff", label: "Staff", count: staffCount },
            { id: "lifetime", label: "Lifetime", count: lifetimePaidCount },
            { id: "banned", label: "Revoked", count: bannedCount },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setFilterStatus(st.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all ${
                filterStatus === st.id
                  ? "bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60 border border-transparent"
              }`}
            >
              <span>{st.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                filterStatus === st.id ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-500"
              }`}>
                {st.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Fitted Keys Table */}
      <div className="bg-[#0D1017] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090C12] border-b border-zinc-800/80 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">License Key & Note</th>
                <th className="p-3.5">Status Badge</th>
                <th className="p-3.5">Target Script</th>
                <th className="p-3.5">Bound Identity</th>
                <th className="p-3.5">Duration / Expiration</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading keys pool...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500 font-mono">
                    No keys found matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredKeys.map((k) => {
                  const boundScript = scripts.find((s) => s.id === k.script_id);
                  const isLifetime = isLifetimePaidKey(k);
                  const isStaff = isStaffReviewKey(k);

                  return (
                    <tr key={k.id} className="hover:bg-zinc-850/30 transition-colors">
                      {/* Key & Notes */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white select-all text-xs tracking-wide">
                              {k.key_string}
                            </span>
                            {isStaff && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                STAFF
                              </span>
                            )}
                            {isLifetime && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                PAID
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => copyKey(k.id, k.key_string)}
                              className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
                              title="Copy License Key"
                            >
                              {copiedId === k.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Editable Note Row */}
                          {editingNoteId === k.id ? (
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                value={editNoteValue}
                                onChange={(e) => setEditNoteValue(e.target.value)}
                                placeholder="Buyer name, Discord, order #..."
                                className="bg-[#080A0F] border border-cyan-500/80 rounded px-2 py-0.5 text-[11px] text-white outline-none"
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
                                className="p-1 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold"
                                title="Save Note"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditNote}
                                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              {k.notes ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 max-w-[200px]">
                                  <FileText className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  <span className="truncate">{k.notes}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditNote(k)}
                                  className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 border border-dashed border-zinc-800 rounded px-1.5 py-0.2 hover:border-zinc-700 transition-colors"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  <span>+ Note</span>
                                </button>
                              )}
                              {k.notes && (
                                <button
                                  type="button"
                                  onClick={() => startEditNote(k)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-200 transition-opacity"
                                  title="Edit Note"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="p-3.5 whitespace-nowrap">
                        {renderStatusBadge(k)}
                      </td>

                      {/* Assigned Script */}
                      <td className="p-3.5 whitespace-nowrap">
                        {k.script_id === "all" ? (
                          <span className="inline-flex px-2 py-0.5 rounded font-mono text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/25">
                            Universal (All Scripts)
                          </span>
                        ) : boundScript ? (
                          <span className="inline-flex px-2 py-0.5 rounded font-mono text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                            {boundScript.name}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px]">Universal</span>
                        )}
                      </td>

                      {/* Bound Identity (IP + Discord) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          {isStaff ? (
                            <span className="text-purple-300 text-[11px] flex items-center gap-1">
                              <span>♾️ Infinite Multi-User</span>
                            </span>
                          ) : k.claimed_ip ? (
                            <div className="flex items-center gap-2">
                              <span className={Boolean(bannedIps[k.claimed_ip]) ? "text-rose-400 font-bold line-through" : "text-zinc-300"}>
                                {k.claimed_ip}
                              </span>
                              {Boolean(bannedIps[k.claimed_ip]) && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[9px] font-bold">
                                  BANNED
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleBanIp(k.claimed_ip!)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                  Boolean(bannedIps[k.claimed_ip])
                                    ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}
                                title={Boolean(bannedIps[k.claimed_ip]) ? `Unban IP ${k.claimed_ip}` : `Ban IP ${k.claimed_ip}`}
                              >
                                {Boolean(bannedIps[k.claimed_ip]) ? "Unban" : "Ban IP"}
                              </button>
                            </div>
                          ) : isLifetime ? (
                            <span className="text-emerald-400/80 text-[11px]">Binds on 1st execution</span>
                          ) : (
                            <span className="text-zinc-600 text-[11px]">Unbound</span>
                          )}

                          {k.claimed_discord_tag && (
                            <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                              <span>@{k.claimed_discord_tag}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Duration / Expiration */}
                      <td className="p-3.5 text-zinc-400 text-[11px] whitespace-nowrap">
                        {isStaff ? (
                          <div>
                            <span className="text-purple-300 font-medium flex items-center gap-1">
                              <span>♾️ Permanent Lifetime</span>
                            </span>
                            <span className="block text-[10px] text-zinc-500">
                              Developer bypass active
                            </span>
                          </div>
                        ) : isLifetime ? (
                          <div>
                            <span className="text-emerald-300 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>Lifetime License</span>
                            </span>
                            <span className="block text-[10px] text-zinc-500">
                              {k.status === "active" ? "Active (Locked to hardware)" : "Never expires"}
                            </span>
                          </div>
                        ) : k.status === "unclaimed" ? (
                          <div>
                            <span className="text-zinc-300 font-medium">
                              {k.duration_hours ? `${k.duration_hours}h duration` : "Lifetime"}
                            </span>
                            <span className="block text-[10px] text-zinc-500">Starts on 1st run</span>
                          </div>
                        ) : k.status === "claimed" ? (
                          <div>
                            <span className="text-blue-300 font-medium">
                              {k.duration_hours ? `${k.duration_hours}h duration` : "Lifetime"}
                            </span>
                            <span className="block text-[10px] text-blue-400/90 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 inline" /> Starts on 1st run
                            </span>
                          </div>
                        ) : k.status === "active" ? (
                          <div>
                            <span className="text-emerald-300 font-medium">
                              {k.duration_hours ? `${k.duration_hours}h active` : "Lifetime"}
                            </span>
                            {k.expires_at ? (
                              <span className="block text-[10px] text-zinc-400 font-mono">
                                Expires: {new Date(k.expires_at).toLocaleDateString()} {new Date(k.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditNote(k)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Edit Note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(k)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              k.status === "banned"
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-amber-400 hover:bg-amber-500/10"
                            }`}
                            title={k.status === "banned" ? "Unban Key" : "Ban Key"}
                          >
                            {k.status === "banned" ? <ShieldCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(k.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Batch Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0D1017] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Generate License Keys</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Key Prefix</label>
                <input
                  type="text"
                  value={genPrefix}
                  onChange={(e) => setGenPrefix(e.target.value.toUpperCase())}
                  placeholder="ATOM"
                  className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Quantity (1 - 100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Duration Preset</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "24h", label: "24 Hours" },
                    { id: "7d", label: "7 Days" },
                    { id: "30d", label: "30 Days" },
                    { id: "lifetime", label: "Lifetime ♾️" },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setGenDuration(dur.id)}
                      className={`py-2 rounded-xl text-center text-xs font-semibold border transition-all ${
                        genDuration === dur.id
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Assigned Target Script</label>
                <select
                  value={genScriptId}
                  onChange={(e) => setGenScriptId(e.target.value)}
                  className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
                >
                  <option value="all">Universal (All Scripts)</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Note / Tag (Optional)</label>
                <input
                  type="text"
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="e.g. VIP Customer, Discord Promo, Giveaway"
                  className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {generating ? "Generating..." : `Create ${genCount} Key${genCount > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Review Key Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0D1017] border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Create Staff Review Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Staff keys bypass IP binding, never expire, and can be used concurrently by multiple testers or admins.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Key Generation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStaffKeyMode("auto")}
                    className={`py-2 rounded-xl text-xs font-semibold border ${
                      staffKeyMode === "auto"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    Auto-Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffKeyMode("custom")}
                    className={`py-2 rounded-xl text-xs font-semibold border ${
                      staffKeyMode === "custom"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    Custom String
                  </button>
                </div>
              </div>

              {staffKeyMode === "custom" && (
                <div>
                  <label className="block text-zinc-400 mb-1">Custom Key String</label>
                  <input
                    type="text"
                    value={staffCustomKey}
                    onChange={(e) => setStaffCustomKey(e.target.value.toUpperCase())}
                    placeholder="STAFF-REVIEW-2026"
                    className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:border-purple-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-400 mb-1">Script Scope</label>
                <select
                  value={staffScriptId}
                  onChange={(e) => setStaffScriptId(e.target.value)}
                  className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-purple-500 outline-none"
                >
                  <option value="all">Universal (All Scripts)</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Staff Note</label>
                <input
                  type="text"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="e.g. ScriptBlox Moderator, Tester #4"
                  className="w-full bg-[#080A0F] border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={staffGenerating}
                onClick={handleCreateStaffReviewKey}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                {staffGenerating ? "Creating..." : "Create Staff Key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
