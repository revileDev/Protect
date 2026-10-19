"use client";

import React from "react";
import Link from "next/link";
import { Shield, Key, ExternalLink, MessageSquare } from "lucide-react";
import ClaimScriptModal, { ScriptSummary } from "./ClaimScriptModal";

interface Props {
  scripts?: ScriptSummary[];
  discordUrl?: string;
}

export default function Navbar({ scripts, discordUrl = "https://discord.gg/AeCYnnQmq5" }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-obsidian-700/80 bg-obsidian-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand identity + status */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-obsidian-800 border border-obsidian-700 group-hover:border-zinc-500 text-white transition-all shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-sm font-mono">
                ATOM<span className="text-zinc-400">PROTECT</span>
              </span>
            </div>
          </Link>

          {/* Operational status badge */}
          <div className="hidden md:inline-flex items-center gap-2 rounded-full border border-obsidian-700 bg-obsidian-850 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Normal</span>
          </div>
        </div>

        {/* Center Nav Anchors */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">
            Capabilities
          </a>
          <a href="#telemetry" className="hover:text-white transition-colors">
            Telemetry
          </a>
          <a href="#scripts" className="hover:text-white transition-colors">
            Scripts
          </a>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-2.5">
          <a
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-obsidian-700 bg-obsidian-850 hover:bg-obsidian-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Discord</span>
          </a>

          {scripts ? (
            <ClaimScriptModal
              scripts={scripts}
              buttonText="Claim Key"
              buttonClassName="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-sm"
            />
          ) : (
            <Link
              href="/claim"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-sm"
            >
              <Key className="h-3.5 w-3.5" />
              <span>Claim Key</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
