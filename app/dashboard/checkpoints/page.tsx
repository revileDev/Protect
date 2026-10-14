// app/dashboard/checkpoints/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { CheckpointItem, CreatorProfile, CreatorEmblem, ScriptRecord } from "@/lib/store";
import {
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  Save,
  Check,
  AlertCircle,
  User,
  Shield,
  Crown,
  Flame,
  Zap,
  Star,
  Skull,
  Sparkles,
  Link2,
  Globe,
  Layers,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

export default function CheckpointsPage() {
  const [activeTab, setActiveTab] = useState<"checkpoints" | "profile">("checkpoints");
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [filterScript, setFilterScript] = useState<string>("all");

  // Checkpoint Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cpScriptId, setCpScriptId] = useState<string>("all");
  const [cpTitle, setCpTitle] = useState("");
  const [cpUrl, setCpUrl] = useState("");
  const [cpDuration, setCpDuration] = useState<number>(5);
  const [cpOrder, setCpOrder] = useState<number>(1);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [checkpointSuccess, setCheckpointSuccess] = useState(false);

  // Profile Form State (Guns.lol style)
  const [profile, setProfile] = useState<CreatorProfile>({
    display_name: "Revile",
    bio: "Lead Developer & Script Engineer. High performance Lua scripts with advanced protection.",
    avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21",
    emblems: [
      { id: "1", label: "Verified Developer", icon: "verified", color: "#3b82f6" },
      { id: "2", label: "Founder", icon: "crown", color: "#eab308" },
      { id: "3", label: "Tamper Proof", icon: "shield", color: "#10b981" },
    ],
    socials: {
      discord: "https://discord.gg/yourserver",
      youtube: "https://youtube.com/@revile",
      twitter: "https://x.com/revile",
      github: "https://github.com/",
      tiktok: "",
      roblox: "",
      telegram: "",
    },
  });

  // New Emblem Inputs
  const [newEmblemLabel, setNewEmblemLabel] = useState("");
  const [newEmblemIcon, setNewEmblemIcon] = useState<string>("verified");
  const [newEmblemColor, setNewEmblemColor] = useState("#3b82f6");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    fetchScripts();
    fetchCheckpoints();
    fetchProfile();
  }, []);

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/scripts");
      const data = await res.json();
      if (data.scripts) setScripts(data.scripts);
    } catch (err) {
      console.error("Error fetching scripts", err);
    }
  };

  const fetchCheckpoints = async () => {
    try {
      const res = await fetch("/api/checkpoints");
      const data = await res.json();
      if (data.checkpoints) setCheckpoints(data.checkpoints);
    } catch (err) {
      console.error("Error fetching checkpoints", err);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/creator-profile");
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
    } catch (err) {
      console.error("Error fetching creator profile", err);
    }
  };

  const resetCheckpointForm = () => {
    setEditingId(null);
    setCpScriptId("all");
    setCpTitle("");
    setCpUrl("");
    setCpDuration(5);
    setCpOrder(checkpoints.length + 1);
    setCheckpointError(null);
  };

  const handleEditCheckpoint = (cp: CheckpointItem) => {
    setEditingId(cp.id);
    setCpScriptId(cp.script_id || "all");
    setCpTitle(cp.title);
    setCpUrl(cp.url);
    setCpDuration(cp.duration_seconds || 5);
    setCpOrder(cp.order || 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckpointError(null);

    if (!cpTitle.trim()) {
      setCheckpointError("Please provide a title for the checkpoint.");
      return;
    }
    if (!cpUrl.trim() || (!cpUrl.startsWith("http://") && !cpUrl.startsWith("https://"))) {
      setCheckpointError("Please provide a valid URL starting with http:// or https://");
      return;
    }

    setSavingCheckpoint(true);
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          script_id: cpScriptId,
          title: cpTitle.trim(),
          url: cpUrl.trim(),
          duration_seconds: cpDuration,
          order: cpOrder,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save checkpoint.");

      setCheckpointSuccess(true);
      setTimeout(() => setCheckpointSuccess(false), 2000);
      resetCheckpointForm();
      fetchCheckpoints();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error saving checkpoint";
      setCheckpointError(message);
    } finally {
      setSavingCheckpoint(false);
    }
  };

  const handleDeleteCheckpoint = async (id: string) => {
    if (!confirm("Are you sure you want to delete this checkpoint?")) return;
    try {
      const res = await fetch(`/api/checkpoints?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCheckpoints((prev) => prev.filter((cp) => cp.id !== id));
      }
    } catch (err) {
      console.error("Error deleting checkpoint", err);
    }
  };

  const handleAddEmblem = () => {
    if (!newEmblemLabel.trim()) return;
    const newEmblem: CreatorEmblem = {
      id: crypto.randomUUID(),
      label: newEmblemLabel.trim(),
      icon: newEmblemIcon,
      color: newEmblemColor,
    };
    setProfile((prev) => ({
      ...prev,
      emblems: [...(prev.emblems || []), newEmblem],
    }));
    setNewEmblemLabel("");
  };

  const handleRemoveEmblem = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      emblems: (prev.emblems || []).filter((e) => e.id !== id),
    }));
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    setSavingProfile(true);
    try {
      const res = await fetch("/api/creator-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile.");

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile";
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const renderEmblemIcon = (icon: string) => {
    switch (icon) {
      case "crown":
        return <Crown className="w-3.5 h-3.5" />;
      case "shield":
        return <Shield className="w-3.5 h-3.5" />;
      case "flame":
        return <Flame className="w-3.5 h-3.5" />;
      case "zap":
        return <Zap className="w-3.5 h-3.5" />;
      case "star":
        return <Star className="w-3.5 h-3.5" />;
      case "skull":
        return <Skull className="w-3.5 h-3.5" />;
      case "verified":
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const filteredCheckpoints = checkpoints.filter((cp) => {
    if (filterScript === "all") return true;
    return cp.script_id === filterScript || cp.script_id === "all";
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Checkpoints & Creator Profile
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure multi-step checkpoint links, duration countdowns, script locks, and your guns.lol-style creator profile shown on the key claim portal.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#11131c] p-1 rounded-xl border border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("checkpoints")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "checkpoints"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Checkpoints Setup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "profile"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>guns.lol Profile</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CHECKPOINTS SETUP */}
      {/* ========================================================================= */}
      {activeTab === "checkpoints" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Checkpoint Creation / Edit Form */}
          <div className="lg:col-span-5 bg-[#12141e] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                {editingId ? "Edit Checkpoint" : "Add Checkpoint"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetCheckpointForm}
                  className="text-[11px] text-gray-400 hover:text-white"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {checkpointError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{checkpointError}</span>
              </div>
            )}

            {checkpointSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>Checkpoint saved successfully!</span>
              </div>
            )}

            <form onSubmit={handleSaveCheckpoint} className="space-y-4 text-xs">
              {/* Target Script Selector */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Target Script
                </label>
                <select
                  value={cpScriptId}
                  onChange={(e) => setCpScriptId(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                >
                  <option value="all">All Scripts (Global Default)</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (/{s.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Bind this checkpoint to a specific script (e.g. Trident vs Rivals) or all scripts.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Checkpoint Title
                </label>
                <input
                  type="text"
                  value={cpTitle}
                  onChange={(e) => setCpTitle(e.target.value)}
                  placeholder="e.g. Visit Community Sponsor, Subscribe on YouTube"
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Destination URL */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Destination Link (URL)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={cpUrl}
                    onChange={(e) => setCpUrl(e.target.value)}
                    placeholder="https://linkvertise.com/... or https://discord.gg/..."
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 pr-9"
                  />
                  <Link2 className="w-4 h-4 text-gray-500 absolute right-2.5 top-2.5" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Users click this link in a new tab to complete this checkpoint step.
                </p>
              </div>

              {/* Duration and Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-gray-300 font-semibold mb-1">
                    <span>Duration (Timer)</span>
                    <span className="font-mono text-emerald-400">{cpDuration}s</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={cpDuration}
                    onChange={(e) => setCpDuration(Number(e.target.value))}
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Seconds to wait</p>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Step Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={cpOrder}
                    onChange={(e) => setCpOrder(Number(e.target.value))}
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Execution sequence</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCheckpoint}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingCheckpoint ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingId ? "Update Checkpoint" : "Add Checkpoint"}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Checkpoints List Panel */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12141e] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Configured Checkpoints</span>
                <span className="text-[11px] text-gray-500">({filteredCheckpoints.length})</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Filter:</span>
                <select
                  value={filterScript}
                  onChange={(e) => setFilterScript(e.target.value)}
                  className="bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-500"
                >
                  <option value="all">All Checkpoints</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredCheckpoints.length === 0 ? (
              <div className="p-8 text-center bg-[#12141e] border border-gray-800 rounded-xl text-gray-500 text-xs">
                No checkpoints configured for this selection yet. Add your first checkpoint using the form on the left.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCheckpoints.map((cp, idx) => {
                  const boundScript = scripts.find((s) => s.id === cp.script_id);
                  return (
                    <div
                      key={cp.id}
                      className="p-4 bg-[#12141e] border border-gray-800 hover:border-gray-700 rounded-xl flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold flex-shrink-0">
                          #{cp.order || idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-bold text-white truncate">{cp.title}</h3>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                                cp.script_id === "all" || !cp.script_id
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              }`}
                            >
                              {boundScript ? boundScript.name : "Global (All Scripts)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1 truncate">
                            <span className="flex items-center gap-1 font-mono text-emerald-400/90">
                              <Clock className="w-3 h-3" />
                              {cp.duration_seconds}s timer
                            </span>
                            <a
                              href={cp.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 hover:text-white flex items-center gap-1 truncate max-w-xs"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{cp.url}</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditCheckpoint(cp)}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCheckpoint(cp.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete Checkpoint"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GUNS.LOL CREATOR PROFILE CUSTOMIZER */}
      {/* ========================================================================= */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Profile Form Controls */}
          <div className="lg:col-span-6 bg-[#12141e] border border-gray-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  Guns.lol Profile Settings
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Customize avatar, display name, bio, social links, and emblems displayed to users on the claim key portal.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
              >
                {profileSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
                  </>
                )}
              </button>
            </div>

            {profileError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Avatar URL & Presets */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Profile Picture (PFP URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={profile.avatar_url}
                    onChange={(e) => setProfile((p) => ({ ...p, avatar_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-500">Avatar Presets:</span>
                  {[
                    "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21",
                    "https://api.dicebear.com/7.x/identicon/svg?seed=TridentApex",
                    "https://api.dicebear.com/7.x/thumbs/svg?seed=ShadowDev",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, avatar_url: preset }))}
                      className="w-6 h-6 rounded-full overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors"
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                  placeholder="e.g. Revile"
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Bio / Description
                </label>
                <textarea
                  rows={2}
                  value={profile.bio}
                  onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Tell users about your scripts and development community..."
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              {/* Emblems & Badges (Guns.lol style) */}
              <div className="pt-2 border-t border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Guns.lol Emblems & Badges
                  </label>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {profile.emblems?.length || 0} active
                  </span>
                </div>

                {/* Active emblems pills */}
                <div className="flex flex-wrap gap-2">
                  {(profile.emblems || []).map((emb) => (
                    <div
                      key={emb.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm"
                      style={{
                        backgroundColor: `${emb.color || "#3b82f6"}15`,
                        borderColor: `${emb.color || "#3b82f6"}40`,
                        color: emb.color || "#3b82f6",
                      }}
                    >
                      {renderEmblemIcon(emb.icon)}
                      <span>{emb.label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmblem(emb.id)}
                        className="ml-1 opacity-60 hover:opacity-100 hover:text-rose-400"
                        title="Remove emblem"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new emblem row */}
                <div className="grid grid-cols-12 gap-2 pt-1">
                  <input
                    type="text"
                    value={newEmblemLabel}
                    onChange={(e) => setNewEmblemLabel(e.target.value)}
                    placeholder="Emblem label (e.g. VIP, Founder)"
                    className="col-span-5 bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />

                  <select
                    value={newEmblemIcon}
                    onChange={(e) => setNewEmblemIcon(e.target.value)}
                    className="col-span-4 bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  >
                    <option value="verified">Verified</option>
                    <option value="crown">Crown</option>
                    <option value="shield">Shield</option>
                    <option value="flame">Flame</option>
                    <option value="zap">Zap</option>
                    <option value="star">Star</option>
                    <option value="skull">Skull</option>
                  </select>

                  <div className="col-span-2 flex items-center justify-center bg-[#0d0f17] border border-gray-700/80 rounded-lg p-1">
                    <input
                      type="color"
                      value={newEmblemColor}
                      onChange={(e) => setNewEmblemColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      title="Emblem color"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEmblem}
                    className="col-span-1 flex items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold"
                    title="Add Emblem"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Socials Section */}
              <div className="pt-2 border-t border-gray-800 space-y-3">
                <label className="block text-gray-300 font-semibold">
                  Social Links
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-0.5">Discord Server</span>
                    <input
                      type="text"
                      value={profile.socials.discord || ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          socials: { ...p.socials, discord: e.target.value },
                        }))
                      }
                      placeholder="https://discord.gg/..."
                      className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 block mb-0.5">YouTube</span>
                    <input
                      type="text"
                      value={profile.socials.youtube || ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          socials: { ...p.socials, youtube: e.target.value },
                        }))
                      }
                      placeholder="https://youtube.com/@..."
                      className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 block mb-0.5">Twitter / X</span>
                    <input
                      type="text"
                      value={profile.socials.twitter || ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          socials: { ...p.socials, twitter: e.target.value },
                        }))
                      }
                      placeholder="https://x.com/..."
                      className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 block mb-0.5">GitHub / Portfolio</span>
                    <input
                      type="text"
                      value={profile.socials.github || ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          socials: { ...p.socials, github: e.target.value },
                        }))
                      }
                      placeholder="https://github.com/..."
                      className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Guns.lol Profile Card Simulator */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span> Live Guns.lol Card Simulator
              </h3>
              <span className="text-[11px] text-gray-500 font-mono">
                Shown to Claimants on /claim
              </span>
            </div>

            {/* Guns.lol Card Canvas */}
            <div className="p-8 rounded-2xl border border-gray-800 bg-gradient-to-b from-[#141624] via-[#0f111c] to-[#0a0c13] shadow-2xl relative overflow-hidden text-center flex flex-col items-center">
              {/* Background ambient lighting */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

              {/* Avatar with guns.lol glowing ring & status pulse */}
              <div className="relative mb-3.5 group">
                <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-purple-500 via-blue-500 to-emerald-400 shadow-xl shadow-purple-500/20">
                  <img
                    src={profile.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21"}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover bg-black"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21";
                    }}
                  />
                </div>
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#12141e] animate-pulse" />
              </div>

              {/* Display Name with Badges */}
              <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center justify-center gap-1.5">
                <span>{profile.display_name || "Revile"}</span>
                <span title="Verified Developer">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </span>
              </h2>

              {/* Emblems List */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 my-3">
                {(profile.emblems || []).map((emb) => (
                  <div
                    key={emb.id}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border backdrop-blur-sm"
                    style={{
                      backgroundColor: `${emb.color || "#3b82f6"}15`,
                      borderColor: `${emb.color || "#3b82f6"}50`,
                      color: emb.color || "#3b82f6",
                    }}
                  >
                    {renderEmblemIcon(emb.icon)}
                    <span>{emb.label}</span>
                  </div>
                ))}
              </div>

              {/* Bio */}
              <p className="text-xs text-gray-300/90 max-w-sm leading-relaxed mb-4">
                {profile.bio || "Lead Developer & Script Engineer."}
              </p>

              {/* Social Links Bar */}
              <div className="flex items-center justify-center gap-2.5">
                {profile.socials.discord && (
                  <a
                    href={profile.socials.discord}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-gray-800/80 hover:bg-[#5865F2] text-gray-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discord</span>
                  </a>
                )}
                {profile.socials.youtube && (
                  <a
                    href={profile.socials.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-gray-800/80 hover:bg-red-600 text-gray-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>YouTube</span>
                  </a>
                )}
                {profile.socials.twitter && (
                  <a
                    href={profile.socials.twitter}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-gray-800/80 hover:bg-blue-500 text-gray-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Twitter/X</span>
                  </a>
                )}
                {profile.socials.github && (
                  <a
                    href={profile.socials.github}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                )}
              </div>

              {/* Simulated Script Key Claim Badge */}
              <div className="mt-5 w-full pt-4 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">Gate Status: Active</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready for Claimants
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
