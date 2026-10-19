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
  ExternalLink,
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
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";

export default function ClaimKeyPage() {
  const [step, setStep] = useState<"verification" | "claimed">("verification");
  const [vpnDetected, setVpnDetected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dynamic IP Reset State
  const [ipResetting, setIpResetting] = useState(false);
  const [ipResetStatus, setIpResetStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

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

  // Creator Profile
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

  const [claimMethod, setClaimMethod] = useState<"checkpoints" | "discord_oauth">("checkpoints");
  const [discordInvite, setDiscordInvite] = useState("https://discord.gg/AeCYnnQmq5");
  const [discordJoined, setDiscordJoined] = useState(false);
  const [discordUsername, setDiscordUsername] = useState("");

  const handleResetIp = async () => {
    if (!claimedKey) return;
    setIpResetting(true);
    setIpResetStatus(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_ip", key: claimedKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset IP");
      setIpResetStatus({ message: data.message || "IP rebound successfully!", type: "success" });
      if (data.bound_ip) setBoundIp(data.bound_ip);
    } catch (err: unknown) {
      setIpResetStatus({
        message: err instanceof Error ? err.message : "Failed to reset IP",
        type: "error",
      });
    } finally {
      setIpResetting(false);
    }
  };

  const checkAlreadyClaimed = async (slugToCheck: string) => {
    try {
      const url = slugToCheck
        ? `/api/claim?script_slug=${encodeURIComponent(slugToCheck)}`
        : "/api/claim";
      const res = await fetch(url);
      const data = await res.json();
      if (data.already_claimed && data.key) {
        setClaimedKey(data.key);
        setBoundIp(data.bound_ip);
        setExpiresAt(data.expires_at);
        setAlreadyClaimed(true);
        setStep("claimed");
        if (data.discord_invite_url) {
          setDiscordInvite(data.discord_invite_url);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("script") || "";
    const cid = params.get("hwid") || params.get("claim_id") || "";

    setScriptSlug(slug);
    setClaimId(cid);

    checkAlreadyClaimed(slug);

    // Fetch site settings
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.claim_method) setClaimMethod(s.claim_method);
        if (s.discord_invite_url) setDiscordInvite(s.discord_invite_url);
      })
      .catch(() => {});

    // Fetch list of active scripts
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const activeOnly = data
            .filter((sc: { is_active?: boolean }) => sc.is_active !== false)
            .map((sc: { id: string; name: string; slug: string }) => ({
              id: sc.id,
              name: sc.name,
              slug: sc.slug,
            }));
          setAvailableScripts(activeOnly);

          if (slug) {
            const found = activeOnly.find((sc) => sc.slug === slug);
            if (found) setTargetScript(found);
          }
        }
      })
      .catch(() => {});

    // Fetch checkpoints
    const cpEndpoint = slug
      ? `/api/checkpoints?script_slug=${encodeURIComponent(slug)}`
      : "/api/checkpoints";

    fetch(cpEndpoint)
      .then((res) => {
        if (res.status === 403) {
          setVpnDetected(true);
          throw new Error("VPN_DETECTED");
        }
        return res.json();
      })
      .then((data) => {
        if (data.checkpoints && data.checkpoints.length > 0) {
          setCheckpoints(data.checkpoints);
        } else {
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

    fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_checkpoint" }),
    }).catch(() => {});
  }, []);

  // Timer Countdown Handler
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

    if (cp.url) {
      window.open(cp.url, "_blank", "noopener,noreferrer");
    }

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

    if (claimMethod === "discord_oauth" && !discordUsername.trim()) {
      setError("Please enter your Discord username to claim your license key.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sanitizedTag = discordUsername.trim();
      const sanitizedId = sanitizedTag.toLowerCase().replace(/[^a-z0-9_]/g, "") || "discord_user";

      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_slug: scriptSlug,
          claim_id: claimId,
          discord_user:
            claimMethod === "discord_oauth"
              ? { id: sanitizedId, tag: sanitizedTag }
              : null,
        }),
      });

      const data = await res.json();

      if (res.status === 403 && data.error?.includes("VPN")) {
        setVpnDetected(true);
        throw new Error(data.error);
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to claim license key");
      }

      setClaimedKey(data.key);
      setBoundIp(data.bound_ip);
      setExpiresAt(data.expires_at);
      setAlreadyClaimed(data.already_claimed || false);
      setStep("claimed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error claiming key";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!claimedKey) return;
    navigator.clipboard.writeText(claimedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderEmblemIcon = (iconName: string) => {
    switch (iconName) {
      case "shield":
        return <Shield className="w-3 h-3" />;
      case "flame":
        return <Flame className="w-3 h-3" />;
      case "zap":
        return <Zap className="w-3 h-3" />;
      case "star":
        return <Star className="w-3 h-3" />;
      case "skull":
        return <Skull className="w-3 h-3" />;
      default:
        return <ShieldCheck className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-zinc-100 selection:bg-white selection:text-black">
      <Navbar discordUrl={discordInvite} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          {/* LEFT COLUMN: CREATOR PROFILE CARD */}
          <div className="lg:col-span-5 bg-obsidian-900 border border-obsidian-700 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
            {/* Background ambient lighting */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Avatar with Guns.lol glowing ring & pulse */}
            <div className="relative mb-3.5 group">
              <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-purple-500 via-blue-500 to-emerald-400 shadow-xl shadow-purple-500/20">
                <img
                  src={profile.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21"}
                  alt="Creator Avatar"
                  className="w-full h-full rounded-full object-cover bg-black"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21";
                  }}
                />
              </div>
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-obsidian-900 animate-pulse" />
            </div>

            {/* Display Name */}
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {profile.display_name || "Revile"}
            </h2>

            {/* Emblems */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 my-3">
              {(profile.emblems || []).map((emb) => (
                <div
                  key={emb.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide uppercase border bg-obsidian-850"
                  style={{
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
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-4">
              {profile.bio || "Lead Developer & Script Engineer."}
            </p>

            {/* Target Script Indicator */}
            {targetScript ? (
              <div className="w-full mb-4 p-3 rounded-xl bg-obsidian-850 border border-obsidian-700 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Script-Locked Key</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Key authorized for <strong>{targetScript.name}</strong> (/{targetScript.slug}).
                </p>
              </div>
            ) : scriptSlug ? (
              <div className="w-full mb-4 p-3 rounded-xl bg-obsidian-850 border border-obsidian-700 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Script: {scriptSlug}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Key will be locked strictly to this script identifier.
                </p>
              </div>
            ) : null}

            {/* Branded Social Buttons (All 9 Supported Platforms) */}
            <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-obsidian-750">
              {SOCIAL_PLATFORMS.map((platform) => {
                const isEnabled = profile.social_toggles?.[platform.key] !== false;
                const link = (profile.socials as Record<string, string | undefined>)[platform.key];
                if (!isEnabled || !link) return null;

                return (
                  <a
                    key={platform.key}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-zinc-200 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    style={{ borderLeftColor: platform.color, borderLeftWidth: "3px" }}
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" style={{ color: platform.color }}>
                      <path d={platform.path} />
                    </svg>
                    <span>{platform.name}</span>
                  </a>
                );
              })}
            </div>

            {claimId && (
              <div className="mt-4 pt-3 border-t border-obsidian-750 w-full text-[10px] text-zinc-500 font-mono truncate">
                HWID: {claimId.slice(0, 16)}...
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: VERIFICATION GATE */}
          <div className="lg:col-span-7 bg-obsidian-900 border border-obsidian-700 rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-obsidian-800 border border-obsidian-700 text-white flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Script License Allocation
                </h1>
              </div>
              <p className="text-xs text-zinc-400">
                Complete the security checkpoints below to generate your single-device license key.
              </p>
            </div>

            {/* VPN Alert */}
            {vpnDetected && (
              <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-rose-300">VPN / Proxy Detected</h3>
                    <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                      Keys cannot be bound to commercial VPN or datacenter proxy IP addresses. Disconnect from your VPN and reload this page.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reload Page</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {error && !vpnDetected && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {error}
              </div>
            )}

            {/* STAGE 1: CHECKPOINTS */}
            {step === "verification" && !vpnDetected && (
              <div className="space-y-5">
                {!scriptSlug && availableScripts.length > 0 ? (
                  <div className="p-4 rounded-xl bg-obsidian-850 border border-obsidian-700 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-zinc-400" />
                        Select Target Script
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Required
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Keys are uniquely restricted to a single script:
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
                            checkAlreadyClaimed(s.slug);
                            fetch(`/api/checkpoints?script_slug=${encodeURIComponent(s.slug)}`)
                              .then((r) => r.json())
                              .then((d) => {
                                if (d.checkpoints && d.checkpoints.length > 0) setCheckpoints(d.checkpoints);
                                if (d.script) setTargetScript(d.script);
                              });
                          }}
                          className="p-3 rounded-xl border border-obsidian-700 bg-obsidian-800/60 hover:border-zinc-400 text-left transition-all flex items-center justify-between group"
                        >
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {s.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400">/{s.slug}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : targetScript ? (
                  <div className="p-3 rounded-xl bg-obsidian-850 border border-obsidian-700 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>
                        Target: <strong className="text-white">{targetScript.name}</strong> ({targetScript.slug})
                      </span>
                    </div>
                    {availableScripts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setScriptSlug("");
                          setTargetScript(null);
                        }}
                        className="text-[11px] text-zinc-400 hover:text-white underline font-medium"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : null}

                {claimMethod === "discord_oauth" ? (
                  <div className="p-4 rounded-xl bg-obsidian-850 border border-obsidian-700 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                      <span>Step 1: Join Discord Community</span>
                      {discordJoined ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-400 text-[11px] font-mono">Required</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Active membership in our Discord server is required to claim a key.
                    </p>
                    <a
                      href={discordInvite}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setDiscordJoined(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <span>Join Discord Server</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>

                    <div className="pt-2 border-t border-obsidian-750 space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-300">
                        Step 2: Enter Discord Username
                      </label>
                      <input
                        type="text"
                        value={discordUsername}
                        onChange={(e) => setDiscordUsername(e.target.value)}
                        placeholder="e.g. revile or username"
                        className="w-full bg-obsidian-800 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-400 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  /* Checkpoints */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1">
                      <span>Checkpoints Required:</span>
                      <span className="text-emerald-400">
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
                              ? "bg-obsidian-800 border-zinc-500"
                              : "bg-obsidian-850 border-obsidian-700 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 ${
                                  isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : isCurrent
                                    ? "bg-white text-black"
                                    : "bg-obsidian-750 text-zinc-500"
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
                                      : "text-zinc-400"
                                  }`}
                                >
                                  {cp.title}
                                </h4>
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {isCompleted
                                    ? "Checkpoint validated."
                                    : isCurrent && timerRunning
                                    ? `Wait ${currentTimer}s on the destination page...`
                                    : `Visit link and wait ${cp.duration_seconds}s.`}
                                </p>
                              </div>
                            </div>

                            <div>
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Done</span>
                                </span>
                              ) : isCurrent ? (
                                timerRunning ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-obsidian-750 border border-obsidian-600 text-zinc-200 text-xs font-mono">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>{currentTimer}s</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartCheckpoint(cp, idx)}
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all flex items-center gap-1.5"
                                  >
                                    <span>Visit Link</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] text-zinc-600 font-mono">
                                  Locked
                                </span>
                              )}
                            </div>
                          </div>

                          {isCurrent && timerRunning && currentTimer !== null && (
                            <div className="mt-3 w-full bg-obsidian-750 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-white h-1 transition-all duration-1000"
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

                {/* Final Button */}
                <button
                  type="button"
                  onClick={handleClaimKey}
                  disabled={
                    loading ||
                    (claimMethod === "checkpoints" && !allCheckpointsDone) ||
                    (claimMethod === "discord_oauth" && (!discordJoined || !discordUsername.trim()))
                  }
                  className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <span>Allocating key from pool...</span>
                  ) : (claimMethod === "checkpoints" && allCheckpointsDone) ||
                    (claimMethod === "discord_oauth" && discordJoined && discordUsername.trim()) ? (
                    <>
                      <span>Generate License Key</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : claimMethod === "discord_oauth" ? (
                    <span>{!discordJoined ? "Join Discord Above First" : "Enter Discord Username Above"}</span>
                  ) : (
                    <span>Complete All Checkpoints Above</span>
                  )}
                </button>
              </div>
            )}

            {/* STAGE 2: CLAIMED */}
            {step === "claimed" && claimedKey && (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border text-center ${
                    alreadyClaimed
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-emerald-500/5 border-emerald-500/20"
                  }`}
                >
                  {alreadyClaimed ? (
                    <Key className="w-7 h-7 text-amber-400 mx-auto mb-2" />
                  ) : (
                    <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                  )}
                  <h3 className="text-sm font-bold text-white">
                    {alreadyClaimed ? "Existing License Key Retrieved" : "License Key Allocated"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Bound to network IP: <code className="text-zinc-200 font-mono">{boundIp || "Your Network IP"}</code>.
                  </p>
                </div>

                {targetScript && (
                  <div className="p-3 rounded-xl bg-obsidian-850 border border-obsidian-700 text-xs text-zinc-300 flex items-center gap-2 font-mono">
                    <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    <span>
                      Locked to: <strong className="text-white">{targetScript.name}</strong>.
                    </span>
                  </div>
                )}

                {/* Key Box */}
                <div className="bg-obsidian-850 border border-obsidian-700 rounded-xl p-4 space-y-2">
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                    Your License Key
                  </label>
                  <div className="flex items-center gap-2 bg-obsidian-950 border border-obsidian-700 rounded-lg p-2.5">
                    <span className="font-mono text-sm font-bold text-white flex-1 select-all truncate">
                      {claimedKey}
                    </span>
                    <button
                      type="button"
                      onClick={copyKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold whitespace-nowrap transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {expiresAt ? (
                  <div className="text-center text-xs font-mono text-zinc-400">
                    Expires: <span className="text-white">{new Date(expiresAt).toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="text-center text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl">
                    ✓ Key active. Timer initiates on first in-game execution.
                  </div>
                )}

                {/* Self-Service Dynamic IP Reset (12h cooldown) */}
                <div className="p-4 rounded-xl bg-obsidian-850 border border-obsidian-700 space-y-2.5 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <RefreshCw className="w-4 h-4 text-blue-400" />
                      <span>Dynamic IP Address Reset</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">12-Hour Cooldown</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    If your ISP dynamic IP changed or you moved networks, click below to rebind this key to your current IP.
                  </p>
                  {ipResetStatus && (
                    <div
                      className={`p-2 rounded-lg text-xs font-mono ${
                        ipResetStatus.type === "success"
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {ipResetStatus.message}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={ipResetting}
                    onClick={handleResetIp}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ipResetting ? "animate-spin" : ""}`} />
                    <span>{ipResetting ? "Rebinding Key IP..." : "Rebind Key to Current Network IP"}</span>
                  </button>
                </div>

                {/* Discord renewal link */}
                <div className="p-4 rounded-xl bg-obsidian-850 border border-obsidian-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span>Need Another Key or HWID Reset?</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Keys are bound to a single IP address. For IP resets or key extensions, join our Discord server.
                  </p>
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <span>Open Discord Server</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                </div>

                {/* Usage instructions */}
                <div className="p-3.5 rounded-xl bg-obsidian-850 border border-obsidian-700 text-xs text-zinc-400 leading-relaxed font-mono">
                  <p className="font-bold text-white mb-1">Execution Steps:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-zinc-400">
                    <li>Execute your script loadstring in Roblox.</li>
                    <li>Paste your key into the prompt and hit Verify.</li>
                    <li>Your key caches locally to skip future prompts.</li>
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
