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
  buttonText = "Claim License Key",
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
          "inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-sm"
        }
      >
        <Key className="w-4 h-4" />
        <span>{buttonText}</span>
        <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Modal Backdrop & Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg bg-obsidian-900 border border-obsidian-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-obsidian-700/80 bg-obsidian-850">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-obsidian-700 flex items-center justify-center text-white">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Select Protected Script
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Choose which script license to generate for your network IP.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-obsidian-800 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              {scripts.length >= 3 && (
                <div className="mt-4 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter scripts by name or slug..."
                    className="w-full bg-obsidian-800 border border-obsidian-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-400 transition-colors font-mono"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Modal Body / Script List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1">
              {filteredScripts.length > 0 ? (
                filteredScripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectScript(s.slug)}
                    className="w-full text-left p-3.5 rounded-xl border border-obsidian-700 bg-obsidian-800/80 hover:bg-obsidian-750 hover:border-zinc-500 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-obsidian-900 border border-obsidian-700 text-zinc-300 group-hover:text-white flex items-center justify-center transition-colors">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white transition-colors">
                            {s.name}
                          </span>
                          <span className="text-[10px] font-mono bg-obsidian-900 text-zinc-400 border border-obsidian-700 px-1.5 py-0.5 rounded">
                            /{s.slug}
                          </span>
                          {s.use_auth !== false ? (
                            <span className="text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              IP Lock
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                              Direct
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Bound to claimant IP upon completion.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all pl-2">
                      <span>Select</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))
              ) : scripts.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-obsidian-700 rounded-xl bg-obsidian-850">
                  <ShieldCheck className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-300">
                    No active scripts currently available
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Check back soon or join our Discord community.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                  No scripts matching &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-obsidian-700/80 bg-obsidian-850 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                IP-Bound Verification
              </span>
              <span className="text-zinc-500">
                {scripts.length} script{scripts.length === 1 ? "" : "s"} active
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
