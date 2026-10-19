"use client";

import React, { useState } from "react";
import {
  Code2,
  Key,
  Shield,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  Terminal,
  ExternalLink,
} from "lucide-react";

interface DocsTab {
  id: "execution" | "keys" | "telemetry" | "faq";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function DocsSection() {
  const [activeTab, setActiveTab] = useState<"execution" | "keys" | "telemetry" | "faq">("execution");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const tabs: DocsTab[] = [
    { id: "execution", label: "In-Game Execution", icon: Code2 },
    { id: "keys", label: "Key Whitelisting", icon: Key },
    { id: "telemetry", label: "Heartbeat & Telemetry", icon: Shield },
    { id: "faq", label: "FAQ & Troubleshooting", icon: HelpCircle },
  ];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const faqs = [
    {
      q: "Why does the site say 'VPN or Proxy Detected'?",
      a: "AeroAuth locks keys to your network IP address to prevent multi-device sharing and duplicate key farming. Commercial VPNs, Tor nodes, and datacenter proxies are rejected automatically during claiming. Turn off your VPN before claiming.",
    },
    {
      q: "How long does a claimed key remain valid?",
      a: "Default claimed keys are valid for 24 hours from generation. Once expired, you can return to the claim portal and obtain a fresh key for your IP address.",
    },
    {
      q: "Does the 1-second heartbeat drop my in-game FPS?",
      a: "No. Heartbeat validation runs asynchronously on a non-blocking thread using Roblox HttpService/request. It uses less than 0.5% CPU and average ping is under 15ms.",
    },
    {
      q: "What happens if my internet disconnects or my IP changes?",
      a: "If the client fails 3 consecutive heartbeats or reports a different network IP, the server closes the session and unloads script functions from memory.",
    },
  ];

  return (
    <section id="docs" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Section Header */}
      <div className="mb-10 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-obsidian-700 bg-obsidian-850 px-3.5 py-1 text-xs font-mono text-zinc-400 mb-3">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>DOCUMENTATION & PROTOCOL</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Developer Reference & Setup Guide
        </h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
          Complete implementation details for executing scripts, understanding IP binding, and troubleshooting client verification.
        </p>
      </div>

      {/* Docs Tabs */}
      <div className="flex items-center gap-2 border-b border-obsidian-700 pb-3 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-obsidian-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-6 rounded-2xl border border-obsidian-700 bg-obsidian-900/90 p-6 sm:p-8 backdrop-blur-sm">
        {/* TAB 1: In-Game Execution */}
        {activeTab === "execution" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white mb-2">Executing AeroAuth Scripts</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                AeroAuth protected scripts run through a unified loader. When you execute the loadstring, the loader checks for a local saved key in your executor workspace. If none exists, an in-game UI opens automatically to let you paste your license key.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Standard Roblox Loadstring Snippet</span>
                <button
                  onClick={() =>
                    handleCopy(
                      `loadstring(game:HttpGet("https://aeroauth.net/api/loader/YOUR_SCRIPT_SLUG"))()`,
                      "std-loader"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-zinc-300 hover:text-white transition-colors"
                >
                  {copiedIndex === "std-loader" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-obsidian-700 bg-[#06070a] p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
                <code>
                  loadstring(game:HttpGet(&quot;https://aeroauth.net/api/loader/YOUR_SCRIPT_SLUG&quot;))()
                </code>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-obsidian-700/80 bg-obsidian-800/50">
                <span className="text-xs font-bold text-white block mb-1">1. Compatible Executors</span>
                <p className="text-xs text-zinc-400">
                  Runs on all Level 7/8 Windows, Android, and macOS executors that support standard HttpGet and makefolder/writefile.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-obsidian-700/80 bg-obsidian-800/50">
                <span className="text-xs font-bold text-white block mb-1">2. Automatic Key Caching</span>
                <p className="text-xs text-zinc-400">
                  Your validated key saves to <code className="text-zinc-200">aero_auth_key.txt</code> so you do not need to retype it every execution.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-obsidian-700/80 bg-obsidian-800/50">
                <span className="text-xs font-bold text-white block mb-1">3. Direct Memory Delivery</span>
                <p className="text-xs text-zinc-400">
                  Script logic streams into memory without saving raw protected code to the player hard drive.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Key Whitelisting */}
        {activeTab === "keys" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white mb-2">Network Binding & Key Protocol</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Keys generated through AeroAuth enforce a single-network restriction. Each key record contains the client IP hash, generation timestamp, and expiration limit.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border border-obsidian-700 bg-obsidian-800/60 space-y-2">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  Network Locking Rule
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  When a player submits their key inside Roblox, the backend verifies that the executing network matches the network IP recorded at claim time.
                </p>
                <div className="p-2.5 rounded-lg bg-obsidian-900 border border-obsidian-700 font-mono text-[11px] text-zinc-400">
                  Claim IP: 203.0.113.15 == Exec IP: 203.0.113.15 [OK]
                </div>
              </div>

              <div className="p-5 rounded-xl border border-obsidian-700 bg-obsidian-800/60 space-y-2">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  Anti-Sharing Protection
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  If another player on a different network attempts to use the same key, the server rejects authentication with code <code>ERR_IP_MISMATCH</code>.
                </p>
                <div className="p-2.5 rounded-lg bg-obsidian-900 border border-obsidian-700 font-mono text-[11px] text-rose-400">
                  Claim IP: 203.0.113.15 != Exec IP: 198.51.100.99 [DENIED]
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Telemetry */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white mb-2">1-Second Heartbeat & Tamper Detection</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Active sessions continuously exchange ping signatures with the AeroAuth API to ensure execution environment integrity.
              </p>
            </div>

            <div className="rounded-xl border border-obsidian-700 bg-[#06070a] p-4 font-mono text-xs text-zinc-300 space-y-2">
              <div className="text-zinc-500">// Telemetry Heartbeat Specification</div>
              <div>POST /api/session/heartbeat HTTP/1.1</div>
              <div>Host: aeroauth.net</div>
              <div>Content-Type: application/json</div>
              <div className="text-cyan-400">
                &#123;&quot;session_id&quot;: &quot;sess_...&quot;, &quot;script_slug&quot;: &quot;universal&quot;, &quot;client_time&quot;: 1729227000&#125;
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Active Tamper Defenses
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
                <li className="flex items-start gap-2 p-3 rounded-lg bg-obsidian-800/60 border border-obsidian-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                  <span><strong>Hook Detection:</strong> Checks raw metatables and HttpGet hooks.</span>
                </li>
                <li className="flex items-start gap-2 p-3 rounded-lg bg-obsidian-800/60 border border-obsidian-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                  <span><strong>Immediate Session Kill:</strong> Tampered instances terminate in under 1 second.</span>
                </li>
                <li className="flex items-start gap-2 p-3 rounded-lg bg-obsidian-800/60 border border-obsidian-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                  <span><strong>Memory Purge:</strong> Variables and functions clear on termination.</span>
                </li>
                <li className="flex items-start gap-2 p-3 rounded-lg bg-obsidian-800/60 border border-obsidian-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                  <span><strong>Error Telemetry:</strong> Crash logs transmit to the staff console for debugging.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 4: FAQ */}
        {activeTab === "faq" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white mb-2">Frequently Answered Questions</h3>
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-obsidian-700 bg-obsidian-800/60 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-semibold text-white hover:text-cyan-300 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform ${
                      expandedFaq === idx ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedFaq === idx && (
                  <div className="px-4 pb-4 pt-1 text-xs text-zinc-400 border-t border-obsidian-700/60 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
