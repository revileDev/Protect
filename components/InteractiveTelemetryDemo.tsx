"use client";

import React, { useState, useEffect } from "react";
import {
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Lock,
  Cpu,
  AlertTriangle,
} from "lucide-react";

export default function InteractiveTelemetryDemo() {
  const [keyInput, setKeyInput] = useState("AERO-89F2-C14D-7E80");
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "tampered">("verified");
  const [latency, setLatency] = useState(11);
  const [pulseCount, setPulseCount] = useState(42);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"telemetry" | "loadstring">("telemetry");

  // Simulated 1s heartbeat ticker
  useEffect(() => {
    if (status !== "verified") return;
    const interval = setInterval(() => {
      setPulseCount((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleRunVerification = () => {
    setStatus("verifying");
    const simulatedLatency = Math.floor(Math.random() * 8) + 8; // 8 - 15ms
    setLatency(simulatedLatency);

    setTimeout(() => {
      setStatus("verified");
    }, 450);
  };

  const handleSimulateTamper = () => {
    setStatus("tampered");
  };

  const handleGenerateKey = () => {
    const chars = "ABCDEF0123456789";
    const segment = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const newKey = `AERO-${segment(4)}-${segment(4)}-${segment(4)}`;
    setKeyInput(newKey);
    setStatus("idle");
  };

  const sampleLoadstring = `-- AeroAuth Direct Loadstring
local AeroAuth = loadstring(game:HttpGet("https://aeroauth.net/api/loader/universal"))()
AeroAuth:Verify("${keyInput || "AERO-XXXX-AUTH"}")`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sampleLoadstring);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-obsidian-700 bg-obsidian-900/90 shadow-2xl backdrop-blur-sm overflow-hidden text-left">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-700/80 bg-obsidian-850">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-xs font-mono text-zinc-400 pl-2 border-l border-obsidian-700">
            aero-telemetry-node // v2.4.0
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === "telemetry"
                ? "bg-obsidian-750 text-white font-medium border border-obsidian-600"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Live Monitor
          </button>
          <button
            onClick={() => setActiveTab("loadstring")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === "loadstring"
                ? "bg-obsidian-750 text-white font-medium border border-obsidian-600"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Loadstring Preview
          </button>
        </div>
      </div>

      {activeTab === "telemetry" ? (
        <div className="p-5 sm:p-6 space-y-5">
          {/* Top Controls: Input Key + Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (status !== "idle") setStatus("idle");
                }}
                placeholder="Enter license key (e.g. AERO-...)"
                className="w-full bg-obsidian-800 border border-obsidian-700 focus:border-zinc-500 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm font-mono text-white placeholder-zinc-500 outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRunVerification}
                disabled={status === "verifying"}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                {status === "verifying" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    <span>Test Handshake</span>
                  </>
                )}
              </button>

              <button
                onClick={handleGenerateKey}
                title="Generate sample key"
                className="px-3 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-zinc-300 hover:text-white text-xs font-mono transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleSimulateTamper}
                title="Simulate hook attempt to test kill-switch"
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  status === "tampered"
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : "bg-obsidian-800 hover:bg-red-950/40 border-obsidian-700 text-zinc-400 hover:text-red-400"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Simulate Hook</span>
              </button>
            </div>
          </div>

          {/* Metric Status Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-obsidian-800/80 border border-obsidian-700">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                Handshake Status
              </span>
              <div className="flex items-center gap-1.5">
                {status === "verified" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-emerald-400">AUTHORIZED</span>
                  </>
                )}
                {status === "verifying" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-mono font-bold text-amber-400">CHECKING...</span>
                  </>
                )}
                {status === "tampered" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-mono font-bold text-red-400">REVOKED</span>
                  </>
                )}
                {status === "idle" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-zinc-500" />
                    <span className="text-xs font-mono font-bold text-zinc-400">READY</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-obsidian-800/80 border border-obsidian-700">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                Network Latency
              </span>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-white">{latency} ms</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-obsidian-800/80 border border-obsidian-700">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                IP Binding
              </span>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-mono text-zinc-300">198.51.100.24</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-obsidian-800/80 border border-obsidian-700">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                Heartbeat Loop
              </span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      status === "verified" ? "bg-emerald-400" : "bg-zinc-600"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      status === "verified" ? "bg-emerald-500" : "bg-zinc-500"
                    }`}
                  />
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  {status === "verified" ? `${pulseCount} pulses (1s)` : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Terminal Log */}
          <div className="rounded-xl border border-obsidian-700 bg-[#06070a] p-3.5 font-mono text-xs leading-relaxed overflow-x-auto space-y-1">
            <div className="text-zinc-500">[00:00:01] Initializing AeroAuth client runtime...</div>
            <div className="text-zinc-400">
              [00:00:02] Client network identified: IP bound to session slot 0
            </div>
            {status === "verifying" && (
              <div className="text-amber-400 animate-pulse">
                [00:00:03] Cryptographic check underway for key {keyInput}...
              </div>
            )}
            {status === "verified" && (
              <>
                <div className="text-emerald-400">
                  [00:00:03] Key validated in {latency}ms. Single-device lock confirmed.
                </div>
                <div className="text-zinc-300">
                  [00:00:04] 1-second telemetry heartbeat active. Session token:{" "}
                  <span className="text-cyan-400">sess_9a8f7c1d3e2b</span>
                </div>
                <div className="text-zinc-500">
                  [00:00:{pulseCount < 10 ? `0${pulseCount}` : pulseCount}] Heartbeat ping #{pulseCount} confirmed (200 OK)
                </div>
              </>
            )}
            {status === "tampered" && (
              <>
                <div className="text-red-400 font-bold">
                  [ALERT] Tamper detected: getrawmetatable hook intercepted.
                </div>
                <div className="text-red-400 font-bold">
                  [KILL-SWITCH] Session revoked immediately. Memory cleared. Execution halted.
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Loadstring Code Preview Tab */
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">
              Universal Roblox Loadstring Script
            </span>
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-xs text-zinc-300 hover:text-white transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl border border-obsidian-700 bg-[#06070a] p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
            <pre>
              <code>{sampleLoadstring}</code>
            </pre>
          </div>

          <p className="text-xs text-zinc-400">
            Paste this snippet into any standard executor. The loader automatically launches the verification UI, checks the key, and runs the script.
          </p>
        </div>
      )}
    </div>
  );
}
