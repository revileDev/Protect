// app/api/loader/[slug]/[...modulePath]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

function isBrowserRequest(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  const secFetchMode = req.headers.get("sec-fetch-mode") || "";
  const secFetchDest = req.headers.get("sec-fetch-dest") || "";
  const userAgent = req.headers.get("user-agent") || "";

  if (accept.includes("text/html")) return true;
  if (secFetchMode === "navigate" || secFetchDest === "document") return true;

  const lowerUA = userAgent.toLowerCase();
  const isKnownExecutor =
    lowerUA.includes("roblox") ||
    lowerUA.includes("synapse") ||
    lowerUA.includes("fluxus") ||
    lowerUA.includes("krnl") ||
    lowerUA.includes("delta") ||
    lowerUA.includes("codex") ||
    lowerUA.includes("luasocket") ||
    lowerUA.includes("wininet");

  if (isKnownExecutor) return false;

  if (
    (lowerUA.includes("mozilla") || lowerUA.includes("chrome") || lowerUA.includes("safari") || lowerUA.includes("edge")) &&
    !isKnownExecutor
  ) {
    return true;
  }

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
        <p>This module can only be loaded within Roblox executors.</p>
        <p><a href="/claim?script=${encodeURIComponent(slug)}" style="color:#60a5fa;">Claim Key</a></p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!script) {
    return new NextResponse(
      `-- Error: Script with slug '${slug}' not found.\ngame.Players.LocalPlayer:Kick("[ATOM PROTECT] Invalid Script")`,
      { status: 404, headers: { "Content-Type": "text/plain" } }
    );
  }

  const requestedPath = (modulePath || []).join("/").replace(/\\/g, "/");
  const cleanRequested = requestedPath.replace(/\.lua$/i, "");
  const requestedBase = requestedPath.split("/").pop() || requestedPath;
  const requestedBaseNoExt = requestedBase.replace(/\.lua$/i, "");

  const modules = script.modules || {};

  // 1. Direct match
  let matchedContent =
    modules[requestedPath] ||
    modules[cleanRequested] ||
    modules[requestedPath + ".lua"];

  // 2. Basename search across stored keys
  if (!matchedContent) {
    for (const [key, content] of Object.entries(modules)) {
      const normalizedKey = key.replace(/\\/g, "/");
      const base = normalizedKey.split("/").pop() || normalizedKey;
      const baseNoExt = base.replace(/\.lua$/i, "");

      if (
        normalizedKey === requestedPath ||
        normalizedKey === cleanRequested ||
        base === requestedBase ||
        baseNoExt === requestedBaseNoExt ||
        normalizedKey.endsWith("/" + requestedPath)
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

  return new NextResponse(matchedContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
