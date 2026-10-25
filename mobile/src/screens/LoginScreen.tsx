// mobile/src/screens/LoginScreen.tsx
import React, { useState } from "react";
import { Shield, Lock, User, Globe, ArrowRight, AlertCircle, Settings2 } from "lucide-react";
import { ApiService } from "../lib/api";

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onOpenServerConfig: () => void;
}

export default function LoginScreen({ onLoginSuccess, onOpenServerConfig }: LoginScreenProps) {
  const [username, setUsername] = useState("Revile2120516501");
  const [password, setPassword] = useState("2120516501Id@y6y7y8y9pl");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const ok = await ApiService.login(username.trim(), password.trim());
      if (ok) {
        onLoginSuccess();
      } else {
        setError("Invalid credentials or server rejected login");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reach server. Check server URL.");
    } finally {
      setLoading(false);
    }
  };

  const serverUrl = ApiService.getServerUrl();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#07080c] p-6 safe-top safe-bottom">
      {/* Top Bar with Server Switcher */}
      <div className="flex justify-end">
        <button
          onClick={onOpenServerConfig}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-cyan-400 transition-colors"
        >
          <Globe className="w-3 h-3" />
          <span className="truncate max-w-[150px]">{serverUrl.replace(/^https?:\/\//, "")}</span>
          <Settings2 className="w-3 h-3 ml-0.5 text-zinc-500" />
        </button>
      </div>

      {/* Center Auth Card */}
      <div className="max-w-sm mx-auto w-full my-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-950/50">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-mono">
            ATOMPROTECT
          </h1>
          <p className="text-xs text-zinc-400">
            Mobile Remote Commander & Telemetry Gateway
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Admin Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-xl bg-[#0e1118] border border-zinc-800 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="Admin username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-[#0e1118] border border-zinc-800 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="Admin password"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold text-xs py-3 px-4 shadow-lg shadow-cyan-950/50 active:scale-98 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Access Admin Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Branding */}
      <div className="text-center text-[10px] text-zinc-600 font-mono">
        ATOMPROTECT // V1.0.0 NATIVE MOBILE
      </div>
    </div>
  );
}
