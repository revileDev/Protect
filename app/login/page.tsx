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
    <div className="min-h-screen flex flex-col justify-between bg-[#0b0d13] text-gray-200">
      <header className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">AERO AUTH</span>
        </Link>
        <Link href="/" className="text-xs text-gray-400 hover:text-white transition-colors">
          Return to site
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#11131c] border border-gray-800 rounded-xl p-6 sm:p-7 shadow-2xl">
          <div className="mb-6">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-white">Admin Login</h1>
            <p className="text-xs text-gray-400 mt-1">
              Protected area. Enter authorized credentials to access management controls.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-400 font-medium mb-1">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full bg-[#0a0c12] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-gray-400 font-medium mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="w-full bg-[#0a0c12] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{submitting ? "Checking..." : "Sign In"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-gray-600 border-t border-gray-900">
        Restricted console. Unauthorized access attempts are monitored and recorded.
      </footer>
    </div>
  );
}
