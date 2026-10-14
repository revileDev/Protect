// components/ClaimScriptModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Key,
  X,
  Search,
  Terminal,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export interface ScriptSummary {
  id: string;
  name: string;
  slug: string;
  use_auth?: boolean;
  watermark_text?: string;
}

interface Props {
  scripts: ScriptSummary[];
  buttonClassName?: string;
  buttonText?: string;
}

export default function ClaimScriptModal({
  scripts,
  buttonClassName,
  buttonText = "Claim Your Key",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredScripts = scripts.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
  });

  const handleSelectScript = (slug: string) => {
    setIsOpen(false);
    router.push(`/claim?script=${encodeURIComponent(slug)}`);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ||
          "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-3 text-xs sm:text-sm font-bold text-white hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
        }
      >
        <Key className="w-4 h-4" />
        <span>{buttonText}</span>
        <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Modal Backdrop & Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg bg-[#0e111a] border border-gray-800 rounded-2xl shadow-2xl shadow-blue-950/30 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-150">
            {/* Header Ambient Glow */}
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-gray-800/80 relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      Select Target Script
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Choose which script you want to claim an authorized key for.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar (if 3 or more scripts) */}
              {scripts.length >= 3 && (
                <div className="mt-4 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search script name or slug..."
                    className="w-full bg-[#141824] border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Modal Body / Script List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
              {filteredScripts.length > 0 ? (
                filteredScripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectScript(s.slug)}
                    className="w-full text-left p-3.5 rounded-xl border border-gray-800/90 bg-[#121522] hover:bg-[#181c2d] hover:border-blue-500/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-800/80 border border-gray-700/60 text-gray-300 group-hover:text-blue-400 group-hover:border-blue-500/40 flex items-center justify-center transition-colors">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                            {s.name}
                          </span>
                          <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                            /{s.slug}
                          </span>
                          {s.use_auth !== false ? (
                            <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              Auth Gate
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold bg-gray-700/40 text-gray-400 px-1.5 py-0.5 rounded">
                              Direct
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Keys claimed here are locked strictly to {s.name}.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all pl-2">
                      <span>Select</span>
                      <ChevronRight className="w-4 h-4 text-blue-400" />
                    </div>
                  </button>
                ))
              ) : scripts.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl bg-[#0a0c13]">
                  <ShieldCheck className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-300">
                    No active scripts currently available
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Please check back later or contact administrators in Discord.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-gray-500">
                  No scripts found matching &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-gray-800/80 bg-[#0a0c13] flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Single-Script IP Lock Enabled
              </span>
              <span className="text-gray-500">
                {scripts.length} script{scripts.length === 1 ? "" : "s"} active
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
