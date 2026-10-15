// app/claim/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import {
  Key,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
  Info,
  ExternalLink,
  Sparkles,
  Crown,
  Shield,
  Flame,
  Zap,
  Star,
  Skull,
  Link2,
  Clock,
  Lock,
  ChevronRight,
} from "lucide-react";
import type { CheckpointItem, CreatorProfile, CreatorEmblem } from "@/lib/store";

export default function ClaimKeyPage() {
  const [step, setStep] = useState<"verification" | "claimed">("verification");
  const [vpnDetected, setVpnDetected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Script and HWID parameters from URL
  const [scriptSlug, setScriptSlug] = useState("");
  const [claimId, setClaimId] = useState("");
  const [targetScript, setTargetScript] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [availableScripts, setAvailableScripts] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Checkpoints & Profile State
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [activeCpIndex, setActiveCpIndex] = useState(0);
  const [completedCpIds, setCompletedCpIds] = useState<string[]>([]);
  const [currentTimer, setCurrentTimer] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  // Guns.lol Creator Profile
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
      discord: "https://discord.gg/AeCYnnQmq5",
      youtube: "https://youtube.com/@revile",
      twitter: "https://x.com/revile",
      github: "https://github.com/",
    },
  });

  // Claim Result State
  const [claimedKey, setClaimedKey] = useState<string | null>(null);
  const [boundIp, setBoundIp] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [claimMethod, setClaimMethod] = useState<"checkpoints" | "discord_oauth">("checkpoints");
  const [discordInvite, setDiscordInvite] = useState("https://discord.gg/AeCYnnQmq5");
  const [discordJoined, setDiscordJoined] = useState(false);

  useEffect(() => {
    let slug = "";
    let id = "";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      slug = params.get("script") || "";
      id = params.get("id") || params.get("hwid") || "";
      setScriptSlug(slug);
      setClaimId(id);
    }

    // Fetch active scripts
    fetch("/api/scripts")
      .then((res) => res.json())
      .then((data) => {
        if (data.scripts) {
          const active = data.scripts.filter((s: any) => s.is_active !== false);
          setAvailableScripts(active);
          if (!slug && active.length === 1) {
            setScriptSlug(active[0].slug);
            setTargetScript(active[0]);
          }
        }
      })
      .catch(() => {});

    // Fetch system settings
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setClaimMethod(data.settings.claim_method || "checkpoints");
          if (data.settings.discord_invite_url) {
            setDiscordInvite(data.settings.discord_invite_url);
          }
        }
      })
      .catch(() => {});

    // Fetch checkpoints and profile for this script
    const cpUrl = slug ? `/api/checkpoints?script_slug=${encodeURIComponent(slug)}` : "/api/checkpoints";
    fetch(cpUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.checkpoints && data.checkpoints.length > 0) {
          setCheckpoints(data.checkpoints);
        } else {
          // Fallback single checkpoint if none configured
          setCheckpoints([
            {
              id: "fallback-cp-1",
              script_id: "all",
              title: "Security Verification",
              url: data.profile?.socials?.discord || "https://discord.gg/",
              duration_seconds: 5,
              order: 1,
              created_at: new Date().toISOString(),
            },
          ]);
        }
        if (data.profile) setProfile(data.profile);
        if (data.script) setTargetScript(data.script);
      })
      .catch(() => {});

    // Notify telemetry that claimant arrived
    fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_checkpoint" }),
    }).catch(() => {});
  }, []);

  // Timer Countdown Handler for Active Checkpoint
  useEffect(() => {
    if (!timerRunning || currentTimer === null) return;

    if (currentTimer <= 0) {
      setTimerRunning(false);
      const activeCp = checkpoints[activeCpIndex];
      if (activeCp) {
        setCompletedCpIds((prev) => [...prev, activeCp.id]);
        if (activeCpIndex + 1 < checkpoints.length) {
          setActiveCpIndex((prev) => prev + 1);
        }
      }
      return;
    }

    const interval = setInterval(() => {
      setCurrentTimer((t) => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, currentTimer, checkpoints, activeCpIndex]);

  const handleStartCheckpoint = (cp: CheckpointItem, index: number) => {
    if (completedCpIds.includes(cp.id)) return;
    if (index !== activeCpIndex) return;

    // Open checkpoint link in a new tab
    if (cp.url) {
      window.open(cp.url, "_blank", "noopener,noreferrer");
    }

    // Start timer for duration
    setCurrentTimer(cp.duration_seconds || 5);
    setTimerRunning(true);
  };

  const allCheckpointsDone =
    checkpoints.length > 0 && checkpoints.every((cp) => completedCpIds.includes(cp.id));

  const handleClaimKey = async () => {
    if (!scriptSlug && availableScripts.length > 0) {
      setError("Please select which script you want to claim a key for.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_slug: scriptSlug,
          claim_id: claimId,
          discord_user: claimMethod === "discord_oauth" ? { id: "9823412312", tag: "User#0001" } : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.is_vpn) setVpnDetected(true);
        throw new Error(data.error || "Failed to claim key.");
      }

      setClaimedKey(data.key);
      setBoundIp(data.bound_ip);
      setExpiresAt(data.expires_at);
      setAlreadyClaimed(Boolean(data.already_claimed));
      setStep("claimed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error claiming key";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!claimedKey) return;
    navigator.clipboard?.writeText(claimedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="min-h-screen flex flex-col bg-[#08090f] text-gray-200">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: GUNS.LOL CREATOR PROFILE CARD */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#141624] via-[#0f111d] to-[#090b12] border border-gray-800 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
            {/* Ambient Background Glow */}
            <div className="absolute -top-14 -left-14 w-40 h-40 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-14 -right-14 w-40 h-40 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Avatar with Guns.lol glowing ring & pulse */}
            <div className="relative mb-3.5">
              <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-purple-500 via-blue-500 to-emerald-400 shadow-xl shadow-purple-500/20">
                <img
                  src={profile.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21"}
                  alt="Creator Avatar"
                  className="w-full h-full rounded-full object-cover bg-black"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21";
                  }}
                />
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#12141e] animate-pulse" />
            </div>

            {/* Display Name with Sparkle */}
            <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center justify-center gap-1.5">
              <span>{profile.display_name || "Revile"}</span>
              <Sparkles className="w-4 h-4 text-blue-400" />
            </h2>

            {/* Guns.lol Emblems & Badges */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 my-3">
              {(profile.emblems || []).map((emb) => (
                <div
                  key={emb.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border backdrop-blur-sm shadow-sm"
                  style={{
                    backgroundColor: `${emb.color || "#3b82f6"}15`,
                    borderColor: `${emb.color || "#3b82f6"}40`,
                    color: emb.color || "#3b82f6",
                  }}
                >
                  {renderEmblemIcon(emb.icon)}
                  <span>{emb.label}</span>
                </div>
              ))}
            </div>

            {/* Bio */}
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-4">
              {profile.bio || "Lead Developer & Script Engineer."}
            </p>

            {/* Target Script Isolation Indicator */}
            {targetScript ? (
              <div className="w-full mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Script-Locked Key</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                  This key will be authorized exclusively for <strong>{targetScript.name}</strong> (/{targetScript.slug}).
                </p>
              </div>
            ) : scriptSlug ? (
              <div className="w-full mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Script: {scriptSlug}</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                  Key will be locked exclusively to this script identifier.
                </p>
              </div>
            ) : null}

            {/* Social Buttons */}
            <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-gray-800/80">
              {profile.socials.discord && (
                <a
                  href={profile.socials.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-gray-800/90 hover:bg-[#5865F2] text-gray-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
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
                  className="px-3 py-1.5 rounded-lg bg-gray-800/90 hover:bg-red-600 text-gray-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
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
                  className="px-3 py-1.5 rounded-lg bg-gray-800/90 hover:bg-blue-500 text-gray-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Twitter</span>
                </a>
              )}
              {profile.socials.github && (
                <a
                  href={profile.socials.github}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>
              )}
            </div>

            {claimId && (
              <div className="mt-4 pt-3 border-t border-gray-800/60 w-full text-[10px] text-gray-500 font-mono truncate">
                HWID: {claimId.slice(0, 16)}...
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: MULTI-CHECKPOINT VERIFICATION GATE */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 bg-[#12141f] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  License Key Gateway
                </h1>
              </div>
              <p className="text-xs text-gray-400">
                Complete the security checkpoints below to allocate your verified license key. Single-device lock enforced.
              </p>
            </div>

            {/* VPN Alert Modal */}
            {vpnDetected && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-rose-300">VPN / Proxy Detected</h3>
                    <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                      Our anti-tamper system detected an active VPN or proxy. Please turn off your VPN/proxy and reload this page to claim a key.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reload Page
                    </button>
                  </div>
                </div>
              </div>
            )}

            {error && !vpnDetected && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* =================================================================== */}
            {/* STAGE 1: VERIFICATION & SEQUENTIAL CHECKPOINTS */}
            {/* =================================================================== */}
            {step === "verification" && !vpnDetected && (
              <div className="space-y-5">
                {/* Script Selector Banner if not pre-selected */}
                {!scriptSlug && availableScripts.length > 0 ? (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5 text-blue-300">
                        <Lock className="w-4 h-4 text-blue-400" />
                        Select Target Script
                      </span>
                      <span className="text-[10px] text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Selection Required
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">
                      Keys are uniquely restricted to a single script. Please select the script you want to claim a key for:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {availableScripts.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setScriptSlug(s.slug);
                            setTargetScript(s);
                            setError(null);
                            fetch(`/api/checkpoints?script_slug=${encodeURIComponent(s.slug)}`)
                              .then((r) => r.json())
                              .then((d) => {
                                if (d.checkpoints && d.checkpoints.length > 0) setCheckpoints(d.checkpoints);
                                if (d.script) setTargetScript(d.script);
                              });
                          }}
                          className="p-3 rounded-xl border border-gray-700 bg-[#121422] hover:border-blue-500 hover:bg-[#181c2f] text-left transition-all flex items-center justify-between group"
                        >
                          <div>
                            <span className="text-xs font-bold text-white group-hover:text-blue-300 block">
                              {s.name}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">/{s.slug}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : targetScript ? (
                  <div className="p-3 rounded-xl bg-[#0f1322] border border-blue-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-gray-300">
                        Target Script: <strong className="text-white">{targetScript.name}</strong> <span className="text-[10px] text-blue-400 font-mono">({targetScript.slug})</span>
                      </span>
                    </div>
                    {availableScripts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setScriptSlug("");
                          setTargetScript(null);
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                      >
                        Change Script
                      </button>
                    )}
                  </div>
                ) : null}

                {claimMethod === "discord_oauth" ? (
                  /* Discord OAuth alternative mode */
                  <div className="p-4 rounded-xl bg-[#0e1018] border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                      <span>Step 1: Join Discord Community</span>
                      {discordJoined ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-400 text-[11px]">Required</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      You must be an active member in our Discord server to claim a valid key.
                    </p>
                    <a
                      href={discordInvite}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setDiscordJoined(true)}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      Join Discord Server
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  /* Multi-Checkpoint Sequential Steps */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                      <span>Checkpoints Required:</span>
                      <span className="text-emerald-400 font-mono text-[11px]">
                        {completedCpIds.length} of {checkpoints.length} Completed
                      </span>
                    </div>

                    {checkpoints.map((cp, idx) => {
                      const isCompleted = completedCpIds.includes(cp.id);
                      const isCurrent = idx === activeCpIndex && !isCompleted;
                      const isLocked = idx > activeCpIndex && !isCompleted;

                      return (
                        <div
                          key={cp.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isCompleted
                              ? "bg-emerald-500/5 border-emerald-500/30"
                              : isCurrent
                              ? "bg-[#161826] border-blue-500/50 shadow-md shadow-blue-500/5"
                              : "bg-[#0d0f17] border-gray-800 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 ${
                                  isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : isCurrent
                                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/40"
                                    : "bg-gray-800 text-gray-500"
                                }`}
                              >
                                {isCompleted ? <Check className="w-4 h-4" /> : `#${idx + 1}`}
                              </div>

                              <div className="min-w-0">
                                <h4
                                  className={`text-xs font-bold truncate ${
                                    isCompleted
                                      ? "text-emerald-300"
                                      : isCurrent
                                      ? "text-white"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {cp.title}
                                </h4>
                                <p className="text-[11px] text-gray-400 truncate">
                                  {isCompleted
                                    ? "Checkpoint validated."
                                    : isCurrent && timerRunning
                                    ? `Please wait ${currentTimer}s on the destination page...`
                                    : `Visit link and wait ${cp.duration_seconds}s to validate.`}
                                </p>
                              </div>
                            </div>

                            {/* Action Button / Status */}
                            <div>
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Done</span>
                                </span>
                              ) : isCurrent ? (
                                timerRunning ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-mono">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>{currentTimer}s</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartCheckpoint(cp, idx)}
                                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
                                  >
                                    <span>Visit Link</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] text-gray-600 font-mono">
                                  Locked
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Countdown Progress Bar for active checkpoint */}
                          {isCurrent && timerRunning && currentTimer !== null && (
                            <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-blue-500 h-1.5 transition-all duration-1000"
                                style={{
                                  width: `${
                                    ((cp.duration_seconds - currentTimer) /
                                      cp.duration_seconds) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Final Claim Key Button */}
                <button
                  type="button"
                  onClick={handleClaimKey}
                  disabled={
                    loading ||
                    (claimMethod === "checkpoints" && !allCheckpointsDone) ||
                    (claimMethod === "discord_oauth" && !discordJoined)
                  }
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Allocating Key from Script Pool...</span>
                  ) : allCheckpointsDone || discordJoined ? (
                    <>
                      <span>Get My License Key</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <span>Complete All Checkpoints Above</span>
                  )}
                </button>
              </div>
            )}

            {/* =================================================================== */}
            {/* STAGE 2: KEY CLAIMED SUCCESSFULLY */}
            {/* =================================================================== */}
            {step === "claimed" && claimedKey && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-white">
                    {alreadyClaimed ? "Existing Active License Key" : "License Key Allocated"}
                  </h3>
                  <p className="text-[11px] text-gray-300 mt-1">
                    Bound to IP: <code>{boundIp || "Your Network IP"}</code>.
                    {alreadyClaimed && " (Each IP address is restricted to 1 active key)."}
                  </p>
                </div>

                {targetScript && (
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Locked to: <strong>{targetScript.name}</strong>. This key cannot be used with other scripts.
                    </span>
                  </div>
                )}

                {/* The License Key Box */}
                <div className="bg-[#0b0d14] border border-gray-800 rounded-xl p-4">
                  <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Your License Key:
                  </label>
                  <div className="flex items-center gap-2 bg-[#12141f] border border-gray-700/80 rounded-lg p-2.5">
                    <span className="font-mono text-sm font-bold text-blue-300 flex-1 select-all truncate">
                      {claimedKey}
                    </span>
                    <button
                      type="button"
                      onClick={copyKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy Key"}
                    </button>
                  </div>
                </div>

                {expiresAt ? (
                  <div className="text-center text-[11px] text-gray-400">
                    Expires: <span className="text-gray-200 font-mono">{new Date(expiresAt).toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-emerald-400/90 font-medium bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-lg">
                    <span>✓ Key Saved: Your timer does not start until your first in-game execution.</span>
                  </div>
                )}

                {/* Discord Renewal Card */}
                <div className="p-4 rounded-xl bg-[#151824] border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span>Need Key Renewal or Another Key?</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Users can claim one active key per network. Once your timer expires or if you require an additional key, join our community Discord to request a renewal.
                  </p>
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    Join Discord Server
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Usage Instructions */}
                <div className="p-3.5 rounded-lg bg-gray-900/60 border border-gray-800 text-[11px] text-gray-400 leading-relaxed">
                  <p className="font-semibold text-gray-200 mb-1">Execution Steps:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Launch Roblox and execute your script loadstring.</li>
                    <li>Paste your key into the Auth Loader and hit <strong>Verify</strong>.</li>
                    <li>Your session starts and connects to the background telemetry heartbeat.</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
