// app/claim/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ExternalLink,
  Shield,
  Flame,
  Zap,
  Star,
  Skull,
  Clock,
  Lock,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import type { CheckpointItem, CreatorProfile } from "@/lib/store";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";

// Fast client-side Proof-of-Work solver (takes ~20ms in genuine browsers, defeats headless HTTP scrapers)
async function solvePoW(nonce: string, difficulty: number): Promise<string> {
  const prefix = "0".repeat(difficulty);
  const encoder = new TextEncoder();
  let i = 0;
  while (i < 300000) {
    const data = encoder.encode(nonce + i);
    const hashBuf = await window.crypto.subtle.digest("SHA-256", data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hashHex.startsWith(prefix)) {
      return String(i);
    }
    i++;
  }
  return String(i);
}

// Anti-tamper check to detect typical browser bypass scripts / userscripts
function checkClientIntegrity(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const fetchStr = Function.prototype.toString.call(window.fetch);
    // If fetch has been replaced by an extension wrapper with typical bypass keywords
    if (
      fetchStr.includes("bypass") ||
      fetchStr.includes("linkvertise") ||
      fetchStr.includes("tampermonkey")
    ) {
      return false;
    }
  } catch {
    // ignore
  }
  return true;
}

// Interactive Slide to Claim Component (blocks bot .click() automation)
function SlideToClaim({
  onComplete,
  disabled,
  loading,
}: {
  onComplete: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const [sliderPos, setSliderPos] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartTimeRef = useRef(0);

  const handleStart = (clientX: number) => {
    if (disabled || loading || completed) return;
    setIsDragging(true);
    dragStartTimeRef.current = Date.now();
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !trackRef.current || completed) return;
    const rect = trackRef.current.getBoundingClientRect();
    const max = rect.width - 44;
    const current = Math.max(0, Math.min(max, clientX - rect.left - 20));
    setSliderPos(current);

    if (current >= max * 0.92) {
      // Must take at least 150ms of human drag movement (anti-bot instant drag spoof)
      if (Date.now() - dragStartTimeRef.current >= 140) {
        setCompleted(true);
        setIsDragging(false);
        setSliderPos(max);
        onComplete();
      }
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!completed) {
      setSliderPos(0);
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={trackRef}
      className={`relative w-full h-12 rounded-xl border flex items-center select-none overflow-hidden transition-all ${
        disabled
          ? "bg-obsidian-850/60 border-obsidian-750 opacity-40 cursor-not-allowed"
          : completed
          ? "bg-emerald-950/30 border-emerald-500/40"
          : "bg-obsidian-850 border-obsidian-700 shadow-inner"
      }`}
    >
      {/* Background progress fill */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-white/10 transition-all pointer-events-none"
        style={{ width: `${sliderPos + 44}px` }}
      />

      {/* Guide Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-bold text-zinc-400">
        {loading ? (
          <span className="flex items-center gap-1.5 text-zinc-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Allocating license key...
          </span>
        ) : completed ? (
          <span className="flex items-center gap-1 text-emerald-400 font-mono">
            <CheckCircle2 className="w-4 h-4" /> Verified • Generating Key...
          </span>
        ) : (
          <span className="flex items-center gap-1.5 tracking-wide text-zinc-400">
            <span>Slide to Claim License Key</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-60" />
          </span>
        )}
      </div>

      {/* Draggable Thumb */}
      <div
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => e.touches[0] && handleStart(e.touches[0].clientX)}
        style={{ transform: `translateX(${sliderPos}px)` }}
        className={`absolute left-1 w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-75 cursor-grab active:cursor-grabbing shadow-md ${
          completed
            ? "bg-emerald-500 text-black cursor-default"
            : disabled
            ? "bg-zinc-700 text-zinc-400"
            : "bg-white text-black hover:bg-zinc-200"
        }`}
      >
        {completed ? (
          <Check className="w-5 h-5 font-bold" />
        ) : (
          <Key className="w-4 h-4" />
        )}
      </div>
    </div>
  );
}

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

  // Anti-Bypass Security Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepToken, setCurrentStepToken] = useState<string | null>(null);
  const [powChallenge, setPowChallenge] = useState<{ nonce: string; difficulty: number } | null>(null);
  const [stepGatewayUrls, setStepGatewayUrls] = useState<string[]>([]);
  const [stepGatewayTokens, setStepGatewayTokens] = useState<string[]>([]);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [verifyingStep, setVerifyingStep] = useState(false);

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
  const [isLockedOut, setIsLockedOut] = useState(false);

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

  // Initialize anti-bypass checkpoint session with server clock
  const initCheckpointSession = async (slug: string, hwidParam?: string) => {
    try {
      const activeHwid = hwidParam || claimId;
      const res = await fetch("/api/checkpoints/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          script_slug: slug,
          hwid: activeHwid,
        }),
      });
      const data = await res.json();
      if (data.locked_out) {
        setIsLockedOut(true);
        setError(data.error || "Access Denied: Your IP or device (HWID) is locked out from claiming keys.");
        return;
      }
      if (data.success) {
        setSessionId(data.sessionId || data.sessionToken);
        setPowChallenge(data.powChallenge);
        if (data.stepDetails && Array.isArray(data.stepDetails) && data.stepDetails.length > 0) {
          setCheckpoints(
            data.stepDetails.map((s: any) => ({
              id: s.id,
              script_id: "all",
              title: s.title,
              url: s.gatewayUrl, // Uses secure gateway redirect
              duration_seconds: s.duration_seconds,
              order: s.order,
              created_at: new Date().toISOString(),
              gatewayToken: s.gatewayToken,
              gatewayUrl: s.gatewayUrl,
            }))
          );
          setStepGatewayUrls(data.stepDetails.map((s: any) => s.gatewayUrl));
          setStepGatewayTokens(data.stepDetails.map((s: any) => s.gatewayToken));
        }
      }
    } catch (err) {
      console.error("Failed to init checkpoint session:", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("script") || "";
    const cid = params.get("hwid") || params.get("claim_id") || params.get("id") || "";

    setScriptSlug(slug);
    setClaimId(cid);

    checkAlreadyClaimed(slug);

    // Fetch site settings
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        const actual = s?.settings || s;
        if (actual?.claim_method) setClaimMethod(actual.claim_method);
        if (actual?.discord_invite_url) setDiscordInvite(actual.discord_invite_url);
      })
      .catch(() => {});

    // Fetch list of active scripts
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data) => {
        const scriptList = Array.isArray(data) ? data : (data.scripts || []);
        const activeOnly = scriptList
          .filter((sc: { is_active?: boolean }) => sc.is_active !== false)
          .map((sc: { id: string; name: string; slug: string }) => ({
            id: sc.id,
            name: sc.name,
            slug: sc.slug,
          }));
        setAvailableScripts(activeOnly);

        let target: { id: string; name: string; slug: string } | null = null;
        if (slug) {
          target =
            activeOnly.find(
              (sc: { id: string; name: string; slug: string }) =>
                sc.slug.toLowerCase() === slug.toLowerCase() ||
                sc.id === slug ||
                sc.name.toLowerCase() === slug.toLowerCase()
            ) || null;
        }
        if (!target && activeOnly.length > 0) {
          target =
            activeOnly.find(
              (sc: { id: string; name: string; slug: string }) =>
                sc.slug === "rivals" || sc.slug === "atomware-hub" || sc.name.toLowerCase().includes("atom")
            ) ||
            activeOnly[activeOnly.length - 1] ||
            activeOnly[0] ||
            null;
        }
        if (target) {
          setTargetScript(target);
          if (!slug) {
            setScriptSlug(target.slug);
            checkAlreadyClaimed(target.slug);
            initCheckpointSession(target.slug, cid);
          }
        }
      })
      .catch(() => {});

    // Fetch checkpoints & profile
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
        if (data.profile) setProfile(data.profile);
        if (data.checkpoints && Array.isArray(data.checkpoints) && data.checkpoints.length > 0) {
          setCheckpoints(data.checkpoints);
        }
        if (data.script) {
          setTargetScript(data.script);
          if (!slug && data.script.slug) {
            setScriptSlug(data.script.slug);
          }
        }
      })
      .catch(() => {});

    // Initialize anti-bypass session if slug present
    if (slug) {
      initCheckpointSession(slug, cid);
    }
  }, []);

  // Timer Countdown Handler
  useEffect(() => {
    if (!timerRunning || currentTimer === null) return;

    if (currentTimer <= 0) {
      setTimerRunning(false);
      handleVerifyCurrentStep();
      return;
    }

    const interval = setInterval(() => {
      setCurrentTimer((t) => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, currentTimer]);

  // Click handler: opens secure gateway link and starts timer
  const handleStartCheckpoint = async (cp: CheckpointItem, index: number) => {
    if (completedCpIds.includes(cp.id)) return;
    if (index !== activeCpIndex) return;

    setError(null);

    // Verify browser integrity
    if (!checkClientIntegrity()) {
      setError("Tampermonkey / Bypasser script detected. Please disable any script extensions and reload.");
      return;
    }

    const gatewayToken = stepGatewayTokens[index] || (cp as any).gatewayToken;
    const gatewayUrl = stepGatewayUrls[index] || cp.url;

    // Open target task in new tab synchronously to avoid browser popup blockers
    if (gatewayUrl) {
      window.open(gatewayUrl, "_blank", "noopener,noreferrer");
    }

    // Call server to stamp start time on the server clock and get active step token
    try {
      const res = await fetch("/api/checkpoints/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_step",
          gatewayToken,
        }),
      });

      const data = await res.json();
      if (data.success && data.activeStepToken) {
        setCurrentStepToken(data.activeStepToken);
        if (data.powChallenge) {
          setPowChallenge(data.powChallenge);
        }
        const dur = data.duration || cp.duration_seconds || 5;
        setCurrentTimer(dur);
        setTimerRunning(true);
      } else {
        setError(data.error || "Failed to start checkpoint step.");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to connect to verification server.");
    }
  };

  // Verify step completion with server
  const handleVerifyCurrentStep = async () => {
    const activeCp = checkpoints[activeCpIndex];
    if (!activeCp || !currentStepToken) return;

    setVerifyingStep(true);
    setError(null);

    try {
      // Compute proof of work in background
      let powSolution = "";
      if (powChallenge) {
        powSolution = await solvePoW(powChallenge.nonce, powChallenge.difficulty);
      }

      const res = await fetch("/api/checkpoints/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_step",
          activeStepToken: currentStepToken,
          powSolution,
          powNonce: powChallenge?.nonce || "",
          hwid: claimId,
          stepIndex: activeCpIndex,
          script_id: targetScript?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.locked_out) {
          setIsLockedOut(true);
          setError(data.error || "Access Denied: You have been locked out due to multiple bypass attempts.");
          return;
        }
        if (data.remainingSeconds) {
          setError(
            data.error ||
              `Task dwell time not reached. Please wait ${data.remainingSeconds}s on the destination page.`
          );
          setCurrentTimer(data.remainingSeconds);
          setTimerRunning(true);
        } else {
          setError(data.error || "Verification failed. Please complete the task genuinely.");
        }
        return;
      }

      // Step successfully verified on server!
      setCompletedCpIds((prev) => [...prev, activeCp.id]);

      if (data.allCompleted && data.claimToken) {
        setClaimToken(data.claimToken);
      } else if (data.nextStep !== undefined) {
        setActiveCpIndex(data.nextStep);
        setCurrentStepToken(null);
        if (data.nextPowChallenge) {
          setPowChallenge(data.nextPowChallenge);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to verify step with server. Please try again.");
    } finally {
      setVerifyingStep(false);
    }
  };

  const allCheckpointsDone =
    checkpoints.length > 0 && checkpoints.every((cp) => completedCpIds.includes(cp.id));

  // Claim key handler (validates claim_token with server)
  const handleClaimKey = async () => {
    if (!scriptSlug && availableScripts.length > 0) {
      setError("Please select which script you want to claim a key for.");
      return;
    }

    if (claimMethod === "discord_oauth" && !discordUsername.trim()) {
      setError("Please enter your Discord username to claim your license key.");
      return;
    }

    if (claimMethod === "checkpoints" && (!sessionId || !claimToken)) {
      setError("Missing checkpoint authorization token. Please complete all tasks.");
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
          hwid: claimId,
          session_id: sessionId,
          claim_token: claimToken,
          discord_user:
            claimMethod === "discord_oauth"
              ? { id: sanitizedId, tag: sanitizedTag }
              : null,
        }),
      });

      const data = await res.json();

      if (data.locked_out) {
        setIsLockedOut(true);
        throw new Error(data.error || "Access Denied: You have been locked out due to multiple bypass attempts.");
      }

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
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center relative">
        {/* Glow backdrop matching site style */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-zinc-700/10 rounded-full blur-[128px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start z-10">
          {/* LEFT COLUMN: CREATOR PROFILE CARD */}
          <div className="lg:col-span-5 bg-obsidian-900 border border-obsidian-800 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
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
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {profile.display_name || "Revile"}
              </h2>
              <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Official
              </span>
            </div>

            {/* Emblems */}
            {profile.emblems && profile.emblems.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 my-3">
                {profile.emblems.map((emb) => (
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
            )}

            {/* Bio */}
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-4">
              {profile.bio || "Lead Developer & Script Engineer."}
            </p>

            {/* Branded Social Buttons (All Supported Platforms with SVG icons) */}
            <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-obsidian-800">
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
                    className="px-3 py-1.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-zinc-200 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
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
              <div className="mt-4 pt-3 border-t border-obsidian-800 w-full text-[10px] text-zinc-500 font-mono truncate">
                HWID: {claimId.slice(0, 16)}...
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: MAIN KEY CLAIM CONTAINER */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-obsidian-900 border border-obsidian-800 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-obsidian-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-white">License Key Gateway</h1>
                  <p className="text-[11px] text-zinc-400">
                    Complete the secure checkpoint tasks below to allocate your key.
                  </p>
                </div>
              </div>

              {/* Anti-Bypass Protected Badge */}
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-mono font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Anti-Bypass Shield</span>
              </span>
            </div>

            {/* Lockout Banner */}
            {isLockedOut && (
              <div className="mb-4 p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <Skull className="w-4 h-4 text-rose-400" />
                  <span>Access Permanently Locked Out</span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  Your network IP and device HWID have been locked out due to repeated checkpoint bypass violations (3/3 attempts). You can no longer claim license keys.
                </p>
                <div className="pt-2 border-t border-rose-900/50 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">If you believe this is an error, appeal in Discord:</span>
                  <a href={discordInvite} target="_blank" rel="noreferrer" className="text-rose-300 hover:text-white underline font-semibold">Join Discord</a>
                </div>
              </div>
            )}

            {/* VPN Detected Banner */}
            {vpnDetected && (
              <div className="mb-4 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-200">VPN / Proxy Detected</h4>
                    <p className="text-zinc-300 mt-1 leading-relaxed">
                      To prevent abuse, claiming license keys through a VPN or Proxy network is strictly disabled. Please turn off your VPN, then reload this page.
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

            {/* Error Banner */}
            {error && !vpnDetected && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs font-mono leading-relaxed">
                ⚠️ {error}
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
                            initCheckpointSession(s.slug);
                            fetch(`/api/checkpoints?script_slug=${encodeURIComponent(s.slug)}`)
                              .then((r) => r.json())
                              .then((data) => {
                                if (data.checkpoints && Array.isArray(data.checkpoints) && data.checkpoints.length > 0) {
                                  setCheckpoints(data.checkpoints);
                                }
                              })
                              .catch(() => {});
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
                          setCompletedCpIds([]);
                          setActiveCpIndex(0);
                          setClaimToken(null);
                          setCurrentStepToken(null);
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
                  /* Checkpoints List */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1">
                      <span>Checkpoints Required:</span>
                      <span className="text-emerald-400 font-bold">
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
                              ? "bg-obsidian-800 border-zinc-500 shadow-sm"
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
                                    ? "Verified by server clock."
                                    : isCurrent && timerRunning
                                    ? `Wait ${currentTimer}s on the destination task page...`
                                    : `Visit task and spend ${cp.duration_seconds}s.`}
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
                                verifyingStep ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-obsidian-750 border border-obsidian-600 text-zinc-200 text-xs font-mono">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                    <span>Verifying...</span>
                                  </div>
                                ) : timerRunning ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-obsidian-750 border border-obsidian-600 text-zinc-200 text-xs font-mono">
                                    <Clock className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                    <span>{currentTimer}s</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartCheckpoint(cp, idx)}
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                  >
                                    <span>Visit Task</span>
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

                {/* Final Claim Section */}
                {claimMethod === "checkpoints" ? (
                  allCheckpointsDone && claimToken ? (
                    /* Interactive Slide-to-Claim to prevent automated headless bypass bots */
                    <div className="space-y-2 pt-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All checkpoints verified
                        </span>
                        <span>Drag slider to finalize</span>
                      </div>
                      <SlideToClaim
                        onComplete={handleClaimKey}
                        disabled={loading}
                        loading={loading}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={true}
                      className="w-full py-3 rounded-xl bg-obsidian-800 border border-obsidian-700 text-zinc-500 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Complete All Checkpoints Above</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleClaimKey}
                    disabled={loading || !discordJoined || !discordUsername.trim()}
                    className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <span>Allocating key from pool...</span>
                    ) : (
                      <>
                        <span>Generate License Key</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
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
                    {alreadyClaimed ? "Existing Key Allocated" : "License Key Generated"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {alreadyClaimed
                      ? "Your IP already has an active key. Copy and paste it into your script."
                      : "Your key has been allocated and cryptographically bound to your IP."}
                  </p>
                </div>

                {/* Key Display Card */}
                <div className="p-3.5 rounded-xl bg-obsidian-850 border border-obsidian-700 flex items-center justify-between gap-3">
                  <div className="font-mono text-xs font-bold text-white tracking-wider truncate select-all">
                    {claimedKey}
                  </div>
                  <button
                    type="button"
                    onClick={copyKey}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Key Metadata */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-obsidian-850 border border-obsidian-800">
                    <span className="text-zinc-500 block">Bound IP:</span>
                    <span className="text-zinc-300 font-bold truncate block">{boundIp || "Your Network"}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-obsidian-850 border border-obsidian-800">
                    <span className="text-zinc-500 block">Status:</span>
                    <span className="text-emerald-400 font-bold block">Active</span>
                  </div>
                </div>

                {/* Dynamic IP Reset Self-Service */}
                <div className="pt-2 border-t border-obsidian-800">
                  <button
                    type="button"
                    onClick={handleResetIp}
                    disabled={ipResetting}
                    className="w-full py-2 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-zinc-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ipResetting ? "animate-spin" : ""}`} />
                    <span>{ipResetting ? "Rebinding IP..." : "Reset Bound IP to Current Location"}</span>
                  </button>

                  {ipResetStatus && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg text-xs font-mono ${
                        ipResetStatus.type === "success"
                          ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                          : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
                      }`}
                    >
                      {ipResetStatus.message}
                    </div>
                  )}
                </div>

                {/* Discord Help Button */}
                <div className="text-center pt-2">
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors underline font-medium"
                  >
                    <span>Need help with your key? Join Discord</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
