// lib/ip.ts
import { NextRequest } from "next/server";

/**
 * Resolves client IP address securely, prioritizing trusted reverse proxy
 * and edge headers (e.g. Cloudflare CF-Connecting-IP) ahead of spoofable headers.
 */
export function getClientIp(req: NextRequest): string {
  // 1. Cloudflare connecting IP (trusted edge network header)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) {
    return cfIp.trim();
  }

  // 2. Real-IP from trusted reverse proxy
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  // 3. X-Forwarded-For header (leftmost IP is the original client)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return "127.0.0.1";
}
