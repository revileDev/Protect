import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";
import { wrapPolymorphicLuau } from "@/lib/polymorphic";

function isBrowserRequest(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  const secFetchMode = req.headers.get("sec-fetch-mode") || "";
  const secFetchDest = req.headers.get("sec-fetch-dest") || "";
  const userAgent = req.headers.get("user-agent") || "";
  const lowerUA = userAgent.toLowerCase();

  // Known executor user-agents or patterns are NEVER browsers
  const isKnownExecutor =
    lowerUA.includes("roblox") ||
    lowerUA.includes("synapse") ||
    lowerUA.includes("fluxus") ||
    lowerUA.includes("krnl") ||
    lowerUA.includes("delta") ||
    lowerUA.includes("codex") ||
    lowerUA.includes("luasocket") ||
    lowerUA.includes("wininet") ||
    lowerUA.includes("curl") ||
    lowerUA.includes("httpclient");

  if (isKnownExecutor) return false;

  // 1. Browsers explicitly request text/html in their Accept header
  if (accept.includes("text/html") || accept.includes("application/xhtml")) return true;

  // 2. Browser navigation fetch modes
  if (secFetchMode === "navigate" || secFetchDest === "document") return true;

  // 3. Browser client hints
  if (req.headers.get("sec-ch-ua")) return true;

  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; modulePath: string[] } }
) {
  const { slug, modulePath } = params;
  const script = await dbService.getScriptBySlug(slug);

  if (isBrowserRequest(req)) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="background:#0b0d14;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
        <h2>🛡️ Direct Module Access Protected</h2>
        <p>This module can only be loaded within authorized Roblox executors.</p>
        <p><a href="/claim?script=${encodeURIComponent(slug)}" style="color:#60a5fa;">Claim Key</a></p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!script) {
    return new NextResponse(
      `-- Error: Script with slug '${slug}' not found.\ngame.Players.LocalPlayer:Kick("[AERO AUTH] Invalid Script")`,
      { status: 404, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Authorization gate: If script requires auth and requester is not admin, verify key or session
  if (script.use_auth !== false && !isAuthenticated()) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key") || req.headers.get("x-license-key");
    const sessionToken =
      searchParams.get("session") ||
      searchParams.get("token") ||
      req.headers.get("x-session-id");

    let isAuthorized = false;

    if (sessionToken) {
      if (sessionToken.startsWith("staff_review")) {
        isAuthorized = true;
      } else {
        const sessions = await dbService.getSessions();
        const active = sessions.find(
          (s) => s.id === sessionToken && s.script_id === script.id && s.status === "active"
        );
        if (active) isAuthorized = true;
      }
    }

    if (!isAuthorized && key) {
      const keys = await dbService.getKeys();
      const validKey = keys.find(
        (k) =>
          k.key_string.toUpperCase() === key.trim().toUpperCase() &&
          k.status === "active" &&
          (k.script_id === "all" || k.script_id === script.id)
      );
      if (validKey) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new NextResponse(
        `-- Error: Unauthorized module request. Valid session or key required.\ngame.Players.LocalPlayer:Kick("[AERO AUTH] Unauthorized Module")`,
        { status: 401, headers: { "Content-Type": "text/plain" } }
      );
    }
  }

  const requestedPath = (modulePath || []).join("/").replace(/\\/g, "/");
  const cleanRequested = requestedPath.replace(/\.(lua|txt)$/i, "");
  const requestedBase = requestedPath.split("/").pop() || requestedPath;
  const requestedBaseNoExt = requestedBase.replace(/\.(lua|txt)$/i, "");

  const modules = script.modules || {};

  // 1. Direct match with all extension variations
  let matchedContent =
    modules[requestedPath] ||
    modules[cleanRequested] ||
    modules[cleanRequested + ".lua"] ||
    modules[cleanRequested + ".txt"] ||
    modules[requestedPath + ".lua"] ||
    modules[requestedPath + ".txt"];

  // 2. Basename search across stored keys
  if (!matchedContent) {
    for (const [key, content] of Object.entries(modules)) {
      const normalizedKey = key.replace(/\\/g, "/");
      const base = normalizedKey.split("/").pop() || normalizedKey;
      const baseNoExt = base.replace(/\.(lua|txt)$/i, "");

      if (
        normalizedKey === requestedPath ||
        normalizedKey === cleanRequested ||
        normalizedKey === cleanRequested + ".txt" ||
        normalizedKey === cleanRequested + ".lua" ||
        base === requestedBase ||
        baseNoExt === requestedBaseNoExt ||
        (requestedBaseNoExt === "features" && baseNoExt === "fetaures") ||
        (requestedBaseNoExt === "fetaures" && baseNoExt === "features") ||
        normalizedKey.endsWith("/" + requestedPath) ||
        normalizedKey.endsWith("/" + cleanRequested + ".txt") ||
        normalizedKey.endsWith("/" + cleanRequested + ".lua")
      ) {
        matchedContent = content;
        break;
      }
    }
  }

  // 3. Check entry_file if requested
  if (!matchedContent) {
    const entryBase = (script.entry_file || "").replace(/\\/g, "/").split("/").pop();
    if (requestedBase === entryBase || requestedBaseNoExt === entryBase?.replace(/\.lua$/i, "")) {
      matchedContent =
        modules[script.entry_file] ||
        modules[script.entry_file.replace(/\\/g, "/")] ||
        Object.values(modules)[0];
    }
  }

  if (!matchedContent) {
    return new NextResponse(
      `-- Error: Module '${requestedPath}' not found in script '${slug}'.`,
      { status: 404, headers: { "Content-Type": "text/plain" } }
    );
  }

  return new NextResponse(wrapPolymorphicLuau(matchedContent), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, proxy-revalidate",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "X-Frame-Options": "DENY",
    },
  });
}
