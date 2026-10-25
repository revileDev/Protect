// mobile/src/components/ServerConfigModal.tsx
import React, { useState } from "react";
import { X, Globe, Check, AlertCircle } from "lucide-react";
import { ApiService, DEFAULT_SERVER_URL } from "../lib/api";

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ServerConfigModal({ isOpen, onClose, onSaved }: ServerConfigModalProps) {
  const [url, setUrl] = useState(ApiService.getServerUrl());
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Server URL cannot be empty");
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }

    try {
      await ApiService.setServerUrl(url.trim());
      setError(null);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save server URL");
    }
  };

  const handlePreset = (preset: string) => {
    setUrl(preset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-[#0e1118] border border-zinc-800 p-5 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto scroll-container">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm text-white">Target Server URL</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">
              Backend API Base URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-domain.vercel.app"
              className="w-full rounded-xl bg-[#07080c] border border-zinc-700/80 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <span className="block text-[10px] uppercase tracking-wider font-mono text-zinc-500">
              Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset("http://192.168.4.113:3000")}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-cyan-800/60 text-[10px] font-mono text-cyan-300 hover:text-white hover:border-cyan-500"
              >
                PC Wi-Fi (192.168.4.113)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("http://10.0.2.2:3000")}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-white hover:border-cyan-500/50"
              >
                Emulator (10.0.2.2)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-black transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Connect</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
