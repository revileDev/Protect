// app/login/page.tsx
"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, AlertCircle, Shield } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid username or password");
      }

      window.location.href = data.redirect || "/dashboard/scripts";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-obsidian-950 text-zinc-100 selection:bg-white selection:text-black">
      <header className="px-6 py-4 border-b border-obsidian-700/80 bg-obsidian-900/60 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-obsidian-800 border border-obsidian-700 flex items-center justify-center font-bold text-white">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white font-mono">AEROAUTH</span>
        </Link>
        <Link href="/" className="text-xs text-zinc-400 hover:text-white transition-colors font-mono">
          Return to site
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-obsidian-900 border border-obsidian-700 rounded-2xl p-6 sm:p-7 shadow-2xl">
          <div className="mb-6">
            <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-obsidian-700 text-white flex items-center justify-center mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-white">Admin Console</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Authorized credentials required for management access.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full bg-obsidian-800 border border-obsidian-700 rounded-xl px-3 py-2.5 text-white outline-none focus:border-zinc-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="w-full bg-obsidian-800 border border-obsidian-700 rounded-xl px-3 py-2.5 text-white outline-none focus:border-zinc-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-sm"
            >
              <span>{submitting ? "Authenticating..." : "Sign In"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-zinc-600 border-t border-obsidian-800 font-mono">
        Restricted console. IP logging and intrusion detection active.
      </footer>
    </div>
  );
}
