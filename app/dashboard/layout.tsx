// app/dashboard/layout.tsx
import Link from "next/link";
import { Terminal, Sliders, Key, Users, Settings, Shield, ExternalLink, ArrowLeft, BarChart3, CheckCircle2 } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-zinc-100 flex flex-col md:flex-row selection:bg-white selection:text-black">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-obsidian-700/80 bg-obsidian-900 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-obsidian-700/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-obsidian-800 border border-obsidian-700 text-white shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white font-mono">AEROAUTH</span>
              <span className="block text-[10px] text-zinc-500 font-mono -mt-0.5">Admin Console</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-obsidian-800 transition-colors"
            title="Public site"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        <nav className="p-3 space-y-1 flex-1 text-xs font-mono">
          <Link
            href="/dashboard/scripts"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <Terminal className="h-4 w-4 text-cyan-400" />
            Scripts Vault
          </Link>

          <Link
            href="/dashboard/loader-builder"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <Sliders className="h-4 w-4 text-purple-400" />
            Build Auth Loader
          </Link>

          <Link
            href="/dashboard/checkpoints"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Checkpoints & Profile
          </Link>

          <Link
            href="/dashboard/keys"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <Key className="h-4 w-4 text-amber-400" />
            Keys Pool
          </Link>

          <Link
            href="/dashboard/players"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <Users className="h-4 w-4 text-emerald-400" />
            Players & Telemetry
          </Link>

          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            Analytics
          </Link>

          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <Settings className="h-4 w-4 text-zinc-400" />
            Settings
          </Link>
        </nav>

        <div className="p-3 border-t border-obsidian-700/80 bg-obsidian-950 space-y-2">
          <Link
            href="/claim"
            target="_blank"
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-xs font-mono text-zinc-300 hover:text-white border border-obsidian-700 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            Open Claim Page
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
