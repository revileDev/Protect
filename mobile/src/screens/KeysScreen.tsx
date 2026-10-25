// mobile/src/screens/KeysScreen.tsx
import React, { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Search,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Filter,
  Sparkles,
  Clock,
  User,
  X,
  RefreshCw,
} from "lucide-react";
import { ApiService } from "../lib/api";

interface KeyRecord {
  id: string;
  key_string: string;
  script_id: string;
  status: "unclaimed" | "claimed" | "active" | "banned";
  duration_hours: number | null;
  claimed_ip: string | null;
  claimed_discord_id: string | null;
  claimed_discord_tag: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string;
  is_staff_review?: boolean;
  notes?: string | null;
}

export default function KeysScreen() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "unclaimed" | "banned">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Key Generator Modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genPrefix, setGenPrefix] = useState("ATOM");
  const [genDuration, setGenDuration] = useState<number | "perm">("perm");
  const [genNotes, setGenNotes] = useState("");
  const [isStaffReview, setIsStaffReview] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const fetchKeys = async () => {
    try {
      const data = await ApiService.getKeys();
      if (data.keys) setKeys(data.keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const copyKey = (k: KeyRecord) => {
    navigator.clipboard?.writeText(k.key_string);
    setCopiedId(k.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenLoading(true);
    try {
      await ApiService.createKeys({
        count: isStaffReview ? 1 : genCount,
        prefix: genPrefix,
        duration_hours: genDuration === "perm" ? null : Number(genDuration),
        is_staff_review: isStaffReview,
        notes: genNotes,
      });
      setShowGenModal(false);
      setGenNotes("");
      setIsStaffReview(false);
      await fetchKeys();
    } catch (err: any) {
      alert(err.message || "Key generation failed");
    } finally {
      setGenLoading(false);
    }
  };

  const handleStatusChange = async (k: KeyRecord, newStatus: string) => {
    try {
      await ApiService.updateKey(k.id, newStatus);
      setKeys((prev) =>
        prev.map((item) => (item.id === k.id ? { ...item, status: newStatus as any } : item))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update key");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this key?")) return;
    try {
      await ApiService.deleteKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete key");
    }
  };

  const filteredKeys = keys.filter((k) => {
    if (filter !== "all" && k.status !== filter) return false;
    const q = search.toLowerCase();
    return (
      k.key_string.toLowerCase().includes(q) ||
      (k.claimed_ip && k.claimed_ip.includes(q)) ||
      (k.claimed_discord_tag && k.claimed_discord_tag.toLowerCase().includes(q)) ||
      (k.notes && k.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              License Keys Pool
            </h2>
            <p className="text-[11px] text-zinc-400">
              {keys.length} Key{keys.length === 1 ? "" : "s"} Created
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowGenModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all active:scale-95 shadow-md shadow-amber-950/40"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Generate</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-[#0e1118] p-1 rounded-xl border border-zinc-800 text-xs">
        {(["all", "active", "unclaimed", "banned"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-1.5 rounded-lg text-center font-mono capitalize text-[11px] transition-all ${
              filter === tab
                ? "bg-amber-500 text-black font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by key string, IP, or Discord..."
          className="w-full rounded-xl bg-[#0e1118] border border-zinc-800 pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
        />
      </div>

      {/* Keys List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span className="text-xs font-mono">Loading keys...</span>
        </div>
      ) : filteredKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-2">
          <Key className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
          <p className="text-xs font-semibold text-zinc-400">No keys match criteria</p>
          <p className="text-[11px]">Generate new keys using the button above.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredKeys.map((k) => (
            <div
              key={k.id}
              className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3.5 space-y-2.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-white tracking-wider">
                    {k.key_string}
                  </span>
                  {k.is_staff_review && (
                    <span className="px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-600/40 text-[9px] font-mono text-purple-300 font-bold">
                      STAFF
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                      k.status === "active"
                        ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
                        : k.status === "unclaimed"
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                        : "bg-rose-950/40 border-rose-800/50 text-rose-400"
                    }`}
                  >
                    {k.status.toUpperCase()}
                  </span>

                  <button
                    onClick={() => copyKey(k)}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 active:scale-90 transition-all"
                    title="Copy Key"
                  >
                    {copiedId === k.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Claimant info */}
              <div className="text-[10px] font-mono bg-[#07080c] p-2 rounded-xl border border-zinc-800/60 grid grid-cols-2 gap-1.5 text-zinc-400">
                <div>
                  <span className="text-zinc-500">Duration: </span>
                  <span className="text-zinc-300">
                    {k.duration_hours ? `${k.duration_hours}h` : "Permanent"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">IP: </span>
                  <span className="text-zinc-300">{k.claimed_ip || "Unclaimed"}</span>
                </div>
                {k.claimed_discord_tag && (
                  <div className="col-span-2">
                    <span className="text-zinc-500">Discord: </span>
                    <span className="text-cyan-400">{k.claimed_discord_tag}</span>
                  </div>
                )}
                {k.notes && (
                  <div className="col-span-2 text-zinc-500 italic">
                    Note: {k.notes}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-1.5 text-[10px] font-mono">
                  {k.status !== "active" && (
                    <button
                      onClick={() => handleStatusChange(k, "active")}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 hover:border-emerald-800"
                    >
                      Activate
                    </button>
                  )}
                  {k.status !== "banned" && (
                    <button
                      onClick={() => handleStatusChange(k, "banned")}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-rose-400 hover:border-rose-800"
                    >
                      Ban Key
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(k.id)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#0e1118] border border-zinc-800 p-5 space-y-4 shadow-2xl text-zinc-100 safe-bottom max-h-[85vh] overflow-y-auto scroll-container">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Generate License Keys</span>
              </h3>
              <button
                onClick={() => setShowGenModal(false)}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#07080c] border border-zinc-800">
                <div>
                  <span className="block text-xs font-bold text-white">Staff Review Key</span>
                  <span className="block text-[10px] text-zinc-400">Unbannable key for script moderators</span>
                </div>
                <input
                  type="checkbox"
                  checked={isStaffReview}
                  onChange={(e) => setIsStaffReview(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </div>

              {!isStaffReview && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Count</label>
                    <input
                      type="number"
                      value={genCount}
                      onChange={(e) => setGenCount(Math.max(1, Number(e.target.value)))}
                      min={1}
                      max={50}
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Prefix</label>
                    <input
                      type="text"
                      value={genPrefix}
                      onChange={(e) => setGenPrefix(e.target.value)}
                      className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono uppercase"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Duration</label>
                <select
                  value={genDuration}
                  onChange={(e) => setGenDuration(e.target.value === "perm" ? "perm" : Number(e.target.value))}
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                >
                  <option value="perm">Permanent (No Expiration)</option>
                  <option value="24">24 Hours (1 Day)</option>
                  <option value="72">72 Hours (3 Days)</option>
                  <option value="168">7 Days (1 Week)</option>
                  <option value="720">30 Days (1 Month)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Notes / Tag</label>
                <input
                  type="text"
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="e.g. VIP Giveaway"
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={genLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold disabled:opacity-50"
                >
                  {genLoading ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
