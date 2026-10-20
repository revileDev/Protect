// components/DashboardNav.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal,
  Sliders,
  Key,
  Users,
  Settings,
  Shield,
  ExternalLink,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const NAV_ITEMS = [
  {
    href: "/dashboard/scripts",
    label: "Scripts Vault",
    icon: Terminal,
    color: "text-cyan-400",
    activeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    dot: "bg-cyan-400",
  },
  {
    href: "/dashboard/loader-builder",
    label: "Build Auth Loader",
    icon: Sliders,
    color: "text-purple-400",
    activeColor: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    dot: "bg-purple-400",
  },
  {
    href: "/dashboard/checkpoints",
    label: "Checkpoints & Profile",
    icon: CheckCircle2,
    color: "text-emerald-400",
    activeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  {
    href: "/dashboard/keys",
    label: "Keys Pool",
    icon: Key,
    color: "text-amber-400",
    activeColor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  {
    href: "/dashboard/players",
    label: "Players & Telemetry",
    icon: Users,
    color: "text-teal-400",
    activeColor: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    dot: "bg-teal-400",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    color: "text-blue-400",
    activeColor: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    color: "text-zinc-400",
    activeColor: "bg-zinc-500/10 text-zinc-200 border-zinc-500/30",
    dot: "bg-zinc-400",
  },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0D1017] border-b border-zinc-800/80 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-xs text-white tracking-wider font-mono">ATOMPROTECT</span>
            <span className="block text-[9px] text-zinc-500 font-mono -mt-0.5">Admin Console</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile Slide) */}
      <aside
        className={`w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-[#0B0D14] flex flex-col flex-shrink-0 z-30 transition-all ${
          mobileOpen ? "block" : "hidden md:flex"
        }`}
      >
        {/* Brand Banner */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-[#0E111A]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-950 via-zinc-900 to-black border border-cyan-500/40 text-cyan-400 shadow-sm group-hover:border-cyan-400 transition-all">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white font-mono tracking-tight">ATOMPROTECT</span>
                <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  PRO
                </span>
              </div>
              <span className="block text-[10px] text-zinc-500 font-mono">Control Dashboard</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700/60 transition-all"
            title="Public Homepage"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Live System Status Pill */}
        <div className="px-3.5 py-2.5 bg-[#090B10] border-b border-zinc-800/60 flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-zinc-400 font-medium">Cron & VFS Active</span>
          </div>
          <span className="text-[9px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
            v2.4
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 flex-1 text-xs font-mono overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard/scripts" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                  isActive
                    ? `${item.activeColor} font-semibold shadow-sm shadow-black/40`
                    : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 hover:border-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? item.color : "text-zinc-500"}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full ${item.dot} shadow-sm`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#0A0C13] space-y-2">
          <Link
            href="/claim"
            target="_blank"
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Public Claim</span>
          </Link>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
