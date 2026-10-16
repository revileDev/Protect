// lib/ip.ts
import { NextRequest } from "next/server";

export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const clean = ip.trim();
  // IPv4 regex (0.0.0.0 to 255.255.255.255)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(clean)) return true;
  // IPv6 regex
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv6Regex.test(clean);
}

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "127.0.0.1";
  let clean = ip.trim();
  // Strip port if present (e.g. 192.168.1.1:5024)
  if (clean.includes(":") && clean.includes(".") && !clean.startsWith("[")) {
    clean = clean.split(":")[0];
  }
  // Convert ::ffff:1.2.3.4 -> 1.2.3.4
  if (clean.startsWith("::ffff:")) {
    clean = clean.replace("::ffff:", "");
  }
  if (clean === "::1" || clean === "localhost") {
    return "127.0.0.1";
  }
  return clean;
}

/**
 * Resolves client IP address securely, prioritizing trusted server connection
 * socket and edge proxy headers ahead of spoofable headers.
 */
export function getClientIp(req: NextRequest): string {
  // 1. Direct Socket Remote Address from runtime (cannot be spoofed by client headers)
  const socketIp = (req as unknown as { ip?: string }).ip;
  if (socketIp && typeof socketIp === "string") {
    const norm = normalizeIp(socketIp);
    if (isValidIp(norm)) return norm;
  }

  // 2. Vercel Edge Server Header (set by Vercel edge network)
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp && vercelIp.trim()) {
    const firstIp = normalizeIp(vercelIp.split(",")[0].trim());
    if (isValidIp(firstIp)) return firstIp;
  }

  // 3. Cloudflare connecting IP (trusted edge network header when behind CF)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) {
    const normalized = normalizeIp(cfIp.trim());
    if (isValidIp(normalized)) return normalized;
  }

  // 4. Real-IP from trusted reverse proxy (e.g. Nginx, Caddy)
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    const normalized = normalizeIp(realIp.trim());
    if (isValidIp(normalized)) return normalized;
  }

  // 5. X-Forwarded-For header (leftmost IP is the original client)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    const firstIp = normalizeIp(forwarded.split(",")[0].trim());
    if (isValidIp(firstIp)) {
      return firstIp;
    }
  }

  return "127.0.0.1";
}
