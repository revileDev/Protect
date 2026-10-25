// mobile/src/components/TopHeader.tsx
import React from "react";
import { Shield, Globe, LogOut, RefreshCw, Radio } from "lucide-react";
import { ApiService } from "../lib/api";

interface TopHeaderProps {
  onRefresh?: () => void;
  onLogout: () => void;
  onOpenServerConfig: () => void;
  refreshing?: boolean;
  title?: string;
  subtitle?: string;
}

export default function TopHeader({
  onRefresh,
  onLogout,
  onOpenServerConfig,
  refreshing = false,
  title = "ATOMPROTECT",
  subtitle = "Mobile Commander",
}: TopHeaderProps) {
  const serverUrl = ApiService.getServerUrl();
  const hostDisplay = serverUrl.replace(/^https?:\/\//, "").slice(0, 24);

  return (
    <header className="sticky top-0 z-40 bg-[#0c0e14]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between safe-top">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold tracking-wider text-white">
              {title}
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <button
            onClick={onOpenServerConfig}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-cyan-400 font-mono transition-colors"
          >
            <Globe className="w-2.5 h-2.5" />
            <span className="truncate max-w-[130px]">{hostDisplay}</span>
          </button>
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        )}

        <button
          onClick={onLogout}
          className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-rose-400 active:scale-95 transition-all"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
