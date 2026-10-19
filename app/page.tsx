// app/page.tsx
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Key,
  ShieldCheck,
  Cpu,
  Shield,
  Lock,
  Terminal,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  FileCode,
  ArrowRight,
  Activity,
} from "lucide-react";
import { dbService } from "@/lib/store";
import ClaimScriptModal, { ScriptSummary } from "@/components/ClaimScriptModal";
import InteractiveTelemetryDemo from "@/components/InteractiveTelemetryDemo";
import DocsSection from "@/components/DocsSection";

export const revalidate = 0;

export default async function HomePage() {
  const [settings, allScripts] = await Promise.all([
    dbService.getSettings(),
    dbService.getScripts(),
  ]);

  const activeScripts: ScriptSummary[] = (allScripts || [])
    .filter((s) => s.is_active !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      use_auth: s.use_auth !== false,
      watermark_text: s.watermark_text,
    }));

  const discordUrl =
    settings.discord_invite_url &&
    settings.discord_invite_url !== "https://discord.gg/" &&
    settings.discord_invite_url !== "https://discord.gg/yourserver"
      ? settings.discord_invite_url
      : "https://discord.gg/AeCYnnQmq5";

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-zinc-100 selection:bg-white selection:text-black">
      <Navbar scripts={activeScripts} discordUrl={discordUrl} />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 lg:px-8 border-b border-obsidian-700/80 bg-dot-matrix overflow-hidden">
        {/* Subtle dark radial vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-obsidian-950/60 to-obsidian-950 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-obsidian-700 bg-obsidian-850 px-3.5 py-1 text-xs font-mono text-zinc-400 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AEROAUTH // SCRIPT ACCESS GATEWAY & TELEMETRY</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Single-Device IP Whitelisting & Live Heartbeat Protection
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Distribute Roblox scripts securely. Generate license keys bound to claimant network IPs, verify players through an in-game UI loader, and monitor sessions in real time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <ClaimScriptModal
              scripts={activeScripts}
              buttonText="Claim License Key"
              buttonClassName="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-xs sm:text-sm font-bold text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5"
            />

            <a
              href="#docs"
              className="inline-flex items-center gap-2 rounded-xl border border-obsidian-700 bg-obsidian-850 px-5 py-3 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
            >
              <FileCode className="w-4 h-4 text-zinc-400" />
              <span>Explore Docs</span>
            </a>

            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-obsidian-700 bg-obsidian-850 px-5 py-3 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
            >
              <span>Join Discord</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </a>
          </div>
        </div>

        {/* Live Interactive Telemetry Showcase inside Hero Flow */}
        <div id="telemetry" className="relative z-10 mt-14 max-w-4xl mx-auto">
          <InteractiveTelemetryDemo />
        </div>
      </section>

      {/* Bento Grid Architecture Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-obsidian-700 bg-obsidian-850 px-3 py-1 text-xs font-mono text-zinc-400 mb-3">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>CORE ARCHITECTURE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Built for Zero-Leak Script Execution
          </h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Four defensive layers protect script source code from being dumped, shared across networks, or cracked.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-obsidian-900 border border-obsidian-700 hover:border-zinc-500 transition-colors space-y-3">
            <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-obsidian-700 text-zinc-200 flex items-center justify-center font-mono">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Single-Device Network Binding</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Every key is cryptographically bound to the claimant network IP during generation. If another user on a different network attempts execution with the same key, authentication is rejected instantly.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>VPN & Datacenter Proxy Filtering Active</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-obsidian-900 border border-obsidian-700 hover:border-zinc-500 transition-colors space-y-3">
            <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-obsidian-700 text-zinc-200 flex items-center justify-center font-mono">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">In-Game UI Loader</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              The universal loadstring draws a sleek verification interface inside the Roblox client. Users paste their key once; subsequent launches automatically authenticate against local cached tokens.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Compatible across Windows, Android, and macOS</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-obsidian-900 border border-obsidian-700 hover:border-zinc-500 transition-colors space-y-3">
            <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-obsidian-700 text-zinc-200 flex items-center justify-center font-mono">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">1-Second Anti-Tamper Heartbeat</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              The client thread maintains an ongoing handshake every 1000ms. Tampering with global metatables, detouring HTTP requests, or attaching debuggers halts heartbeat delivery and drops script memory.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Sub-15ms Roundtrip Validation Ping</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-obsidian-900 border border-obsidian-700 hover:border-zinc-500 transition-colors space-y-3">
            <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-obsidian-700 text-zinc-200 flex items-center justify-center font-mono">
              <Terminal className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Modular Memory Streaming</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Scripts do not save raw Lua payloads to player storage. Code chunks stream encrypted over HTTPS straight into executor memory, mitigating static file dumps.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>Instant Remote Script Updates & Hot-Patching</span>
            </div>
          </div>
        </div>
      </section>

      {/* Available Protected Scripts Hub */}
      {activeScripts.length > 0 && (
        <section id="scripts" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full border-t border-obsidian-700/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-obsidian-700 bg-obsidian-850 px-3 py-1 text-xs font-mono text-zinc-400 mb-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                <span>SCRIPTS VAULT</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Active Protected Scripts ({activeScripts.length})
              </h2>
            </div>
            <p className="text-xs font-mono text-zinc-500">
              Select a script below to claim an authorized key
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeScripts.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl border border-obsidian-700 bg-obsidian-900 hover:border-zinc-500 transition-all flex flex-col justify-between group space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-white group-hover:text-zinc-200 transition-colors">
                      {s.name}
                    </span>
                    {s.use_auth !== false ? (
                      <span className="text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        IP Locked
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                        Direct
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {s.use_auth !== false
                      ? "Requires authorized license key bound to claimant IP."
                      : "Direct execution without license verification."}
                  </p>

                  <div className="rounded-lg bg-obsidian-800 border border-obsidian-700/80 p-2 font-mono text-[11px] text-zinc-400 flex items-center justify-between gap-2">
                    <span className="truncate">
                      loadstring(game:HttpGet(&quot;.../api/loader/{s.slug}&quot;))()
                    </span>
                    <span className="text-[10px] text-zinc-500 flex-shrink-0">
                      /{s.slug}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-obsidian-750">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {s.watermark_text || "AeroAuth Protected"}
                  </span>

                  <Link
                    href={`/claim?script=${encodeURIComponent(s.slug)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-obsidian-800 hover:bg-white hover:text-black border border-obsidian-700 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <span>Claim Key</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Developer Documentation Section */}
      <DocsSection />

      {/* Terms of Service Section */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 border-t border-obsidian-700/80 bg-obsidian-900 mt-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider font-mono">
              Terms of Service & Usage Policy
            </h2>
          </div>

          <div className="rounded-xl border border-obsidian-700 bg-obsidian-950 p-4 text-xs text-zinc-300 font-mono whitespace-pre-line leading-relaxed">
            {settings.tos_content || "Keys are bound to claimant IP addresses. VPNs and proxies are blocked. Multi-device key sharing results in automatic revocation."}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-zinc-500 pt-1">
            <span>• Keys bound to network IP</span>
            <span>• Commercial VPN & Proxy traffic blocked</span>
            <span>• One active key per IP address</span>
          </div>
        </div>
      </section>

      {/* Clean Footer with hidden Admin link */}
      <footer className="py-5 px-6 border-t border-obsidian-800 bg-obsidian-950 flex items-center justify-between text-xs font-mono text-zinc-500">
        <span>&copy; {new Date().getFullYear()} AeroAuth. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <a
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            Community Discord
          </a>
          <Link
            href="/login"
            className="text-zinc-700 hover:text-zinc-400 transition-colors p-1"
            title="Staff Console"
          >
            <Lock className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
