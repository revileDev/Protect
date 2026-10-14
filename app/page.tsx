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
  Sparkles,
  ChevronRight,
  Layers,
  ArrowRight,
} from "lucide-react";
import { dbService } from "@/lib/store";
import ClaimScriptModal, { ScriptSummary } from "@/components/ClaimScriptModal";

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

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-gray-200">
      <Navbar scripts={activeScripts} />

      {/* Main Hero Header */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-gray-800/80 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-3xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-[#12141e] px-4 py-1.5 text-xs text-gray-400 mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ATOM PROTECT • Script Verification & Access Portal</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-5 leading-tight">
            Script License & Key Gateway
          </h1>

          <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Obtain an authorized license key to run our Roblox scripts. Keys are bound to your network IP and validated through in-game authentication.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Modal Trigger Button */}
            <ClaimScriptModal
              scripts={activeScripts}
              buttonText="Claim Your Key"
            />

            {settings.discord_invite_url && (
              <a
                href={settings.discord_invite_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/70 px-5 py-3 text-xs sm:text-sm font-semibold text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <span>Join Discord Community</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Active Protected Scripts Showcase */}
      {activeScripts.length > 0 && (
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-800/80">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Available Protected Scripts ({activeScripts.length})
              </h2>
            </div>
            <span className="text-[11px] text-gray-500">
              Click any script to claim its key
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeScripts.map((s) => (
              <Link
                key={s.id}
                href={`/claim?script=${encodeURIComponent(s.slug)}`}
                className="p-4 rounded-xl border border-gray-800/90 bg-[#11131c] hover:bg-[#161a29] hover:border-blue-500/50 transition-all flex items-center justify-between group shadow-sm hover:shadow-blue-500/10"
              >
                <div className="space-y-1.5 flex-1 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                      {s.name}
                    </span>
                    <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                      /{s.slug}
                    </span>
                    {s.use_auth !== false ? (
                      <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        Auth Key
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">
                        Direct
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {s.use_auth !== false
                      ? "Requires authorized license key • Locked to claimant IP"
                      : "Direct execution without license key"}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform flex-shrink-0">
                  <span>Claim</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Public Technical Information */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-[#11131c] border border-gray-800">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <Key className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1.5">Single-Device Key Lock</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Each generated key is locked to the claimant IP address and device identifier. Sharing keys across multiple networks results in an automatic rejection.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#11131c] border border-gray-800">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1.5">In-Game UI Loader</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              When executing the public loadstring, our verification loader opens in-game. Paste your license key and press Verify to load your script.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#11131c] border border-gray-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1.5">Anti-Tamper Integrity</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Live heartbeat checks monitor session status and execution integrity. Tampering with internal functions immediately terminates the script.
            </p>
          </div>
        </div>
      </section>

      {/* Terms of Service Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800/80 bg-[#0d0f16] mt-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gray-300" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Terms of Service</h2>
          </div>

          <p className="text-xs text-gray-400">
            By obtaining a key or executing our scripts, you agree to these rules:
          </p>

          <div className="rounded-lg border border-gray-800 bg-[#12141f] p-4 text-xs text-gray-300 font-mono whitespace-pre-line leading-relaxed">
            {settings.tos_content}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
            <span>• Keys bind to the claimant IP</span>
            <span>• VPN & proxy connections are blocked</span>
            <span>• Limit of one key per user</span>
          </div>
        </div>
      </section>

      {/* Discreet footer with hidden admin link */}
      <footer className="py-4 px-6 border-t border-gray-900 bg-[#07080c] flex items-center justify-between text-[11px] text-gray-600">
        <span>&copy; {new Date().getFullYear()} ATOM PROTECT. All rights reserved.</span>
        <Link
          href="/login"
          className="text-gray-800 hover:text-gray-600 transition-colors p-1"
          title="Staff Console"
        >
          <Lock className="w-3 h-3 opacity-30 hover:opacity-100" />
        </Link>
      </footer>
    </div>
  );
}
