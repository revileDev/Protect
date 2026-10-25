// mobile/src/screens/CheckpointsScreen.tsx
import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Unlock,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  Check,
  RefreshCw,
  User,
  Sliders,
  Save,
} from "lucide-react";
import { ApiService } from "../lib/api";

interface CheckpointItem {
  id: string;
  script_id: string;
  title: string;
  url: string;
  duration_seconds: number;
  order: number;
}

export default function CheckpointsScreen() {
  const [tab, setTab] = useState<"lockouts" | "steps">("lockouts");
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [lockedIps, setLockedIps] = useState<Array<{ ip: string; reason: string; banned_at: string; attemptCount: number }>>([]);
  const [lockedHwids, setLockedHwids] = useState<Array<{ hwid: string; reason: string; banned_at: string; attemptCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  // New Checkpoint Form
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDuration, setNewDuration] = useState(15);
  const [showAddStep, setShowAddStep] = useState(false);

  const fetchData = async () => {
    try {
      const [cpData, bpData] = await Promise.all([
        ApiService.getCheckpoints().catch(() => ({ checkpoints: [] })),
        ApiService.getBypassAttempts().catch(() => ({ locked_ips: [], locked_hwids: [] })),
      ]);

      if (cpData.checkpoints) setCheckpoints(cpData.checkpoints);
      if (bpData.locked_ips) setLockedIps(bpData.locked_ips);
      if (bpData.locked_hwids) setLockedHwids(bpData.locked_hwids);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReleaseLock = async (payload: { ip?: string; hwid?: string }) => {
    try {
      await ApiService.releaseBypassLock(payload);
      if (payload.ip) {
        setLockedIps((prev) => prev.filter((item) => item.ip !== payload.ip));
      }
      if (payload.hwid) {
        setLockedHwids((prev) => prev.filter((item) => item.hwid !== payload.hwid));
      }
    } catch (err: any) {
      alert(err.message || "Failed to release lockout");
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    const newStep: CheckpointItem = {
      id: "cp_" + Date.now(),
      script_id: "all",
      title: newTitle.trim(),
      url: newUrl.trim(),
      duration_seconds: newDuration,
      order: checkpoints.length + 1,
    };

    const updated = [...checkpoints, newStep];
    try {
      await ApiService.saveCheckpoints(updated);
      setCheckpoints(updated);
      setShowAddStep(false);
      setNewTitle("");
      setNewUrl("");
    } catch (err: any) {
      alert(err.message || "Failed to add step");
    }
  };

  const handleDeleteStep = async (id: string) => {
    const updated = checkpoints.filter((c) => c.id !== id);
    try {
      await ApiService.saveCheckpoints(updated);
      setCheckpoints(updated);
    } catch (err: any) {
      alert(err.message || "Failed to delete step");
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Gateway & Security
            </h2>
            <p className="text-[11px] text-zinc-400">
              Anti-Bypass Lockouts & Monetization
            </p>
          </div>
        </div>

        {tab === "steps" && (
          <button
            onClick={() => setShowAddStep(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Step</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-[#0e1118] p-1 rounded-xl border border-zinc-800 text-xs">
        <button
          onClick={() => setTab("lockouts")}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            tab === "lockouts"
              ? "bg-emerald-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Bypass Lockouts ({lockedIps.length + lockedHwids.length})</span>
        </button>
        <button
          onClick={() => setTab("steps")}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            tab === "steps"
              ? "bg-emerald-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Checkpoint Steps ({checkpoints.length})</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs font-mono">Syncing gateway...</span>
        </div>
      ) : tab === "lockouts" ? (
        <div className="space-y-3">
          {lockedIps.length === 0 && lockedHwids.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-1">
              <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500/70 mb-2" />
              <p className="text-xs font-semibold text-zinc-300">No Active Lockouts</p>
              <p className="text-[11px]">All claimants are genuine. Anti-bypass scraper locks will appear here.</p>
            </div>
          ) : (
            <>
              {lockedIps.map((item, idx) => (
                <div
                  key={"ip_" + idx}
                  className="rounded-2xl bg-[#0e1118] border border-rose-900/40 p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-300">
                        IP: {item.ip}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800">
                        {item.attemptCount} ATTEMPTS
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{item.reason}</p>
                  </div>

                  <button
                    onClick={() => handleReleaseLock({ ip: item.ip })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-mono hover:border-emerald-800 active:scale-95"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Release</span>
                  </button>
                </div>
              ))}

              {lockedHwids.map((item, idx) => (
                <div
                  key={"hwid_" + idx}
                  className="rounded-2xl bg-[#0e1118] border border-amber-900/40 p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-300">
                        HWID: {item.hwid.slice(0, 16)}...
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{item.reason}</p>
                  </div>

                  <button
                    onClick={() => handleReleaseLock({ hwid: item.hwid })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-mono hover:border-emerald-800 active:scale-95"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Release</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {checkpoints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-1">
              <Sliders className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-xs font-semibold text-zinc-300">No Checkpoint Steps Configured</p>
              <p className="text-[11px]">Direct key claims are enabled without monetization steps.</p>
            </div>
          ) : (
            checkpoints.map((cp, idx) => (
              <div
                key={cp.id}
                className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center font-mono text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-white">{cp.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{cp.duration_seconds}s timer</span>
                    </span>
                    <a
                      href={cp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 flex items-center gap-0.5 truncate max-w-[150px]"
                    >
                      <span>{cp.url}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteStep(cp.id)}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Step Modal */}
      {showAddStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#0e1118] border border-zinc-800 p-5 space-y-4 shadow-2xl text-zinc-100 safe-bottom max-h-[85vh] overflow-y-auto scroll-container">
            <h3 className="font-bold text-sm text-white">Add Checkpoint Monetization Step</h3>
            <form onSubmit={handleAddStep} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Step Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Complete Linkvertise Task"
                  required
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Destination URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://linkvertise.com/..."
                  required
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Required Delay (seconds)
                </label>
                <input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  min={1}
                  max={120}
                  className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddStep(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"
                >
                  Save Step
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
