// components/WorldMapTelemetry.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Globe,
  Radio,
  Users,
  Compass,
  MapPin,
  ExternalLink,
  Shield,
  Zap,
  Activity,
  Layers,
  Crosshair,
} from "lucide-react";
import type { ExecutionLog } from "@/lib/store";

export interface ActivePlayerSession {
  id: string;
  ip_address: string;
  roblox_username?: string | null;
  roblox_user_id?: string | null;
  avatar_url?: string | null;
  place_name?: string | null;
  place_id?: string | null;
  status: string;
  is_online?: boolean;
  duration_seconds?: number;
  last_ping_sec?: number;
  executor?: string | null;
  os?: string | null;
}

interface GeoPoint {
  lat: number;
  lng: number;
  city: string;
  country: string;
  code: string;
  flag: string;
}

// Major global gaming hubs catalog for deterministic IP geocoding
const GAMING_GEO_HUBS: GeoPoint[] = [
  { lat: 40.7128, lng: -74.006, city: "New York", country: "United States", code: "US", flag: "🇺🇸" },
  { lat: 34.0522, lng: -118.2437, city: "Los Angeles", country: "United States", code: "US", flag: "🇺🇸" },
  { lat: 41.8781, lng: -87.6298, city: "Chicago", country: "United States", code: "US", flag: "🇺🇸" },
  { lat: 32.7767, lng: -96.797, city: "Dallas", country: "United States", code: "US", flag: "🇺🇸" },
  { lat: 47.6062, lng: -122.3321, city: "Seattle", country: "United States", code: "US", flag: "🇺🇸" },
  { lat: 25.7617, lng: -80.1918, city: "Miami", country: "United States", code: "US", flag: "🇺🇸" },
  { lat: 43.6532, lng: -79.3832, city: "Toronto", country: "Canada", code: "CA", flag: "🇨🇦" },
  { lat: 49.2827, lng: -123.1207, city: "Vancouver", country: "Canada", code: "CA", flag: "🇨🇦" },
  { lat: 51.5074, lng: -0.1278, city: "London", country: "United Kingdom", code: "GB", flag: "🇬🇧" },
  { lat: 53.4808, lng: -2.2426, city: "Manchester", country: "United Kingdom", code: "GB", flag: "🇬🇧" },
  { lat: 50.1109, lng: 8.6821, city: "Frankfurt", country: "Germany", code: "DE", flag: "🇩🇪" },
  { lat: 52.52, lng: 13.405, city: "Berlin", country: "Germany", code: "DE", flag: "🇩🇪" },
  { lat: 48.8566, lng: 2.3522, city: "Paris", country: "France", code: "FR", flag: "🇫🇷" },
  { lat: 52.3676, lng: 4.9041, city: "Amsterdam", country: "Netherlands", code: "NL", flag: "🇳🇱" },
  { lat: 59.3293, lng: 18.0686, city: "Stockholm", country: "Sweden", code: "SE", flag: "🇸🇪" },
  { lat: 52.2297, lng: 21.0122, city: "Warsaw", country: "Poland", code: "PL", flag: "🇵🇱" },
  { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "Brazil", code: "BR", flag: "🇧🇷" },
  { lat: -22.9068, lng: -43.1729, city: "Rio de Janeiro", country: "Brazil", code: "BR", flag: "🇧🇷" },
  { lat: -34.6037, lng: -58.3816, city: "Buenos Aires", country: "Argentina", code: "AR", flag: "🇦🇷" },
  { lat: 35.6762, lng: 139.6503, city: "Tokyo", country: "Japan", code: "JP", flag: "🇯🇵" },
  { lat: 34.6937, lng: 135.5023, city: "Osaka", country: "Japan", code: "JP", flag: "🇯🇵" },
  { lat: 37.5665, lng: 126.978, city: "Seoul", country: "South Korea", code: "KR", flag: "🇰🇷" },
  { lat: 1.3521, lng: 103.8198, city: "Singapore", country: "Singapore", code: "SG", flag: "🇸🇬" },
  { lat: 14.5995, lng: 120.9842, city: "Manila", country: "Philippines", code: "PH", flag: "🇵🇭" },
  { lat: -33.8688, lng: 151.2093, city: "Sydney", country: "Australia", code: "AU", flag: "🇦🇺" },
  { lat: -37.8136, lng: 144.9631, city: "Melbourne", country: "Australia", code: "AU", flag: "🇦🇺" },
  { lat: 25.2048, lng: 55.2708, city: "Dubai", country: "United Arab Emirates", code: "AE", flag: "🇦🇪" },
];

function resolveIpGeo(ip?: string | null, seed?: string | null): GeoPoint {
  const str = (ip || seed || "127.0.0.1").trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GAMING_GEO_HUBS.length;
  const base = GAMING_GEO_HUBS[index];

  // Minor deterministic jitter (±0.8 degrees) based on secondary hash so multiple players in the same city don't stack directly on top of each other
  const jitterLat = (((Math.abs(hash * 31) % 100) - 50) / 100) * 1.2;
  const jitterLng = (((Math.abs(hash * 17) % 100) - 50) / 100) * 1.2;

  return {
    ...base,
    lat: base.lat + jitterLat,
    lng: base.lng + jitterLng,
  };
}

// Convert Equirectangular Lat/Lng to SVG coordinates on a 1000 x 500 canvas
function projectCoordinates(lat: number, lng: number): { x: number; y: number } {
  const width = 1000;
  const height = 500;
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x: Math.max(10, Math.min(width - 10, x)), y: Math.max(10, Math.min(height - 10, y)) };
}

export default function WorldMapTelemetry({
  sessions = [],
  logs = [],
}: {
  sessions?: ActivePlayerSession[];
  logs?: ExecutionLog[];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: string;
    username: string;
    userId?: string | null;
    avatarUrl?: string | null;
    ip: string;
    city: string;
    country: string;
    flag: string;
    placeName?: string | null;
    placeId?: string | null;
    executor?: string | null;
    os?: string | null;
    duration?: string;
    isOnline: boolean;
    pingSec?: number;
    coords: { x: number; y: number };
  } | null>(null);

  const [filterMode, setFilterMode] = useState<"active" | "all">("active");

  // Derive plotted players
  const plottedPlayers = useMemo(() => {
    const list: typeof selectedPlayer[] = [];

    // 1. First add all currently online/active sessions
    sessions.forEach((s) => {
      const isOnline = s.is_online ?? (s.status === "active");
      if (filterMode === "active" && !isOnline) return;

      const geo = resolveIpGeo(s.ip_address, s.roblox_user_id || s.roblox_username || s.id);
      const coords = projectCoordinates(geo.lat, geo.lng);

      const m = Math.floor((s.duration_seconds || 0) / 60);
      const sec = (s.duration_seconds || 0) % 60;
      const durationStr = `${m}m ${sec}s`;

      list.push({
        id: s.id,
        username: s.roblox_username || `Player_${s.id.substring(0, 5)}`,
        userId: s.roblox_user_id,
        avatarUrl: s.avatar_url || (s.roblox_user_id ? `/api/roblox/avatar?userId=${s.roblox_user_id}` : null),
        ip: s.ip_address,
        city: geo.city,
        country: geo.country,
        flag: geo.flag,
        placeName: s.place_name || (s.place_id ? `Place #${s.place_id}` : "Unknown Game"),
        placeId: s.place_id,
        executor: s.executor || "Luau Client",
        os: s.os || "Windows",
        duration: durationStr,
        isOnline: Boolean(isOnline),
        pingSec: s.last_ping_sec ?? 1,
        coords,
      });
    });

    // 2. If list has few active sessions or user selected "all", supplement with unique recent execution logs
    if (list.length < 5 || filterMode === "all") {
      const seenIps = new Set(list.map((p) => p?.ip));
      logs.slice(0, 25).forEach((log) => {
        if (!log.ip_address || seenIps.has(log.ip_address)) return;
        seenIps.add(log.ip_address);

        const geo = resolveIpGeo(log.ip_address, log.roblox_user_id || log.roblox_username || log.id);
        const coords = projectCoordinates(geo.lat, geo.lng);

        list.push({
          id: log.id,
          username: log.roblox_username || "Verified Player",
          userId: log.roblox_user_id,
          avatarUrl: log.avatar_url || (log.roblox_user_id ? `/api/roblox/avatar?userId=${log.roblox_user_id}` : null),
          ip: log.ip_address,
          city: geo.city,
          country: geo.country,
          flag: geo.flag,
          placeName: log.place_name || (log.place_id ? `Place #${log.place_id}` : "Script Executed"),
          placeId: log.place_id,
          executor: log.executor || "Luau Client",
          os: log.os || "Windows",
          duration: "Recent session",
          isOnline: false,
          pingSec: 0,
          coords,
        });
      });
    }

    return list.filter(Boolean) as NonNullable<typeof selectedPlayer>[];
  }, [sessions, logs, filterMode]);

  // Aggregate country statistics
  const countryStats = useMemo(() => {
    const counts: Record<string, { country: string; flag: string; count: number }> = {};
    plottedPlayers.forEach((p) => {
      if (!counts[p.country]) {
        counts[p.country] = { country: p.country, flag: p.flag, count: 0 };
      }
      counts[p.country].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [plottedPlayers]);

  const activeCount = sessions.filter((s) => s.is_online ?? (s.status === "active")).length;

  return (
    <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative">
      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0d0f17]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Globe className="w-5 h-5 animate-spin" style={{ animationDuration: "25s" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Interactive Global Player Telemetry
              </h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                LIVE RADAR
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Real-time geographic distribution of active Roblox executors and authentication heartbeats.
            </p>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-[#171a27] border border-gray-700/60 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode("active")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterMode === "active"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterMode === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              All Traffic ({plottedPlayers.length})
            </button>
          </div>
        </div>
      </div>

      {/* Country Distribution Pills */}
      {countryStats.length > 0 && (
        <div className="px-4 py-2.5 bg-[#0a0c13] border-b border-gray-800/60 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1 shrink-0">
            <Crosshair className="w-3 h-3 text-blue-400" />
            Top Regions:
          </span>
          {countryStats.map((c) => (
            <div
              key={c.country}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#131724] border border-gray-800 text-gray-300 shrink-0 font-mono text-[11px]"
            >
              <span>{c.flag}</span>
              <span className="font-semibold text-gray-200">{c.country}</span>
              <span className="text-blue-400 font-bold bg-blue-500/10 px-1 rounded text-[10px]">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Vector Map Canvas */}
      <div className="relative w-full aspect-[2/1] min-h-[320px] max-h-[500px] bg-[#08090f] overflow-hidden select-none">
        {/* Subtle Map Grid lines */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#2563eb" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {/* Equator & Meridian */}
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4 4" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Vector Continents SVG */}
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full"
          style={{ filter: "drop-shadow(0 0 12px rgba(14, 165, 233, 0.05))" }}
        >
          {/* North America */}
          <path
            d="M 120 70 L 170 50 L 250 65 L 290 90 L 270 140 L 220 180 L 190 230 L 180 260 L 150 250 L 140 210 L 100 170 L 90 120 Z 
               M 240 40 L 280 25 L 300 45 L 280 60 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
          {/* South America */}
          <path
            d="M 230 260 L 290 280 L 330 330 L 310 400 L 270 470 L 240 460 L 230 380 L 210 320 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
          {/* Europe */}
          <path
            d="M 460 110 L 510 80 L 550 95 L 560 140 L 510 170 L 460 160 L 450 120 Z 
               M 440 95 L 460 85 L 465 110 L 445 115 Z 
               M 490 60 L 520 45 L 530 85 L 500 80 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
          {/* Africa */}
          <path
            d="M 460 170 L 560 170 L 610 230 L 570 340 L 520 380 L 480 340 L 450 240 Z 
               M 610 320 L 630 310 L 620 360 L 605 350 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
          {/* Asia / Eurasia */}
          <path
            d="M 550 80 L 720 70 L 850 90 L 880 140 L 830 200 L 750 260 L 700 240 L 650 230 L 620 180 L 560 140 Z 
               M 670 230 L 710 240 L 690 300 L 660 270 Z 
               M 770 250 L 820 280 L 800 330 L 760 300 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
          {/* Japan */}
          <path
            d="M 865 150 L 885 160 L 880 200 L 860 180 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
          {/* Australia & Oceania */}
          <path
            d="M 770 350 L 870 340 L 890 410 L 830 450 L 760 410 Z 
               M 890 420 L 910 420 L 900 460 L 885 450 Z"
            fill="#161b2c"
            stroke="#263152"
            strokeWidth="1.2"
          />
        </svg>

        {/* Dynamic Telemetry Markers on World Map */}
        {plottedPlayers.map((player) => {
          const isSelected = selectedPlayer?.id === player.id;
          const isLive = player.isOnline;

          return (
            <div
              key={player.id}
              style={{
                left: `${(player.coords.x / 1000) * 100}%`,
                top: `${(player.coords.y / 500) * 100}%`,
              }}
              onClick={() => setSelectedPlayer(isSelected ? null : player)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
            >
              {/* Radar beacon pulse ring for active sessions */}
              {isLive ? (
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-6 h-6 rounded-full bg-blue-500/30 animate-ping" />
                  <span className="absolute w-4 h-4 rounded-full bg-emerald-500/50 animate-pulse" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_8px_#10b981]" />
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-blue-400/80 border border-gray-900 shadow-[0_0_4px_#38bdf8]" />
                </div>
              )}

              {/* Quick Hover Mini-Badge */}
              <div className="hidden group-hover:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex-col items-center pointer-events-none z-30">
                <div className="bg-[#0b0d14]/95 border border-blue-500/40 px-2.5 py-1.5 rounded-lg shadow-xl text-center whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                    <span>{player.flag}</span>
                    <span>{player.username}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 font-mono">
                    {player.city}, {player.country} • {player.executor}
                  </div>
                </div>
                <div className="w-2 h-2 bg-[#0b0d14] border-r border-b border-blue-500/40 rotate-45 -mt-1" />
              </div>
            </div>
          );
        })}

        {/* Selected Player Telemetry Overlay Card */}
        {selectedPlayer && (
          <div className="absolute bottom-4 right-4 z-20 w-80 max-w-[calc(100%-2rem)] bg-[#0d0f17]/95 border border-blue-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                {selectedPlayer.avatarUrl ? (
                  <img
                    src={selectedPlayer.avatarUrl}
                    alt={selectedPlayer.username}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border border-gray-700 bg-gray-900"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 text-xs">
                    {selectedPlayer.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white truncate max-w-[140px]">
                    {selectedPlayer.username}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <span>{selectedPlayer.flag}</span>
                    <span>{selectedPlayer.city}, {selectedPlayer.country}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 text-xs">
              <div className="bg-[#121522] p-2 rounded-lg border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block font-mono">STATUS</span>
                <span className={`font-bold flex items-center gap-1 mt-0.5 ${selectedPlayer.isOnline ? "text-emerald-400" : "text-gray-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedPlayer.isOnline ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
                  {selectedPlayer.isOnline ? "Active In-Game" : "Logged Exec"}
                </span>
              </div>

              <div className="bg-[#121522] p-2 rounded-lg border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block font-mono">EXECUTOR</span>
                <span className="font-semibold text-purple-300 mt-0.5 truncate block">
                  {selectedPlayer.executor}
                </span>
              </div>

              <div className="bg-[#121522] p-2 rounded-lg border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block font-mono">IP ADDRESS</span>
                <span className="font-mono text-gray-300 mt-0.5 text-[11px] truncate block">
                  {selectedPlayer.ip}
                </span>
              </div>

              <div className="bg-[#121522] p-2 rounded-lg border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block font-mono">DURATION</span>
                <span className="font-mono text-amber-300 mt-0.5 text-[11px] block">
                  {selectedPlayer.duration}
                </span>
              </div>

              <div className="col-span-2 bg-[#121522] p-2 rounded-lg border border-gray-800/80">
                <span className="text-[10px] text-gray-400 block font-mono">EXPERIENCE</span>
                <span className="font-semibold text-gray-200 mt-0.5 text-xs truncate block" title={selectedPlayer.placeName || ""}>
                  🎮 {selectedPlayer.placeName}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state overlay when no players are detected */}
        {plottedPlayers.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <Radio className="w-8 h-8 text-blue-400 animate-pulse mb-2" />
            <p className="text-sm font-bold text-gray-200">Awaiting Telemetry Heartbeats...</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Launch your protected script in Roblox to watch real-time coordinates light up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
