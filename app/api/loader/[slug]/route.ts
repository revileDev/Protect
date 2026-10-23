import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { generateLuaLoader } from "@/lib/lua-generator";
import { bundleModularScript } from "@/lib/module-bundler";
import { getClientIp } from "@/lib/ip";
import { wrapPolymorphicLuau } from "@/lib/polymorphic";
import { syncScriptFromGitHub } from "@/lib/github-sync";

// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    rateLimitMap.forEach((value, key) => {
      if (now > value.resetAt) rateLimitMap.delete(key);
    });
  }
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count += 1;
  return true;
}

function isMaliciousScraper(userAgent: string): boolean {
  const lower = userAgent.toLowerCase();
  return (
    lower.includes("python-requests") ||
    lower.includes("aiohttp") ||
    lower.includes("scrapy") ||
    lower.includes("wget") ||
    lower.includes("go-http-client") ||
    lower.includes("postmanruntime") ||
    lower.includes("insomnia")
  );
}

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
    lowerUA.includes("solara") ||
    lowerUA.includes("wave") ||
    lowerUA.includes("celery") ||
    lowerUA.includes("swift") ||
    lowerUA.includes("xeno") ||
    lowerUA.includes("arceus") ||
    lowerUA.includes("macsploit") ||
    lowerUA.includes("appleware") ||
    lowerUA.includes("valyse") ||
    lowerUA.includes("vega") ||
    lowerUA.includes("hydrogen") ||
    lowerUA.includes("oxygen") ||
    lowerUA.includes("electron") ||
    lowerUA.includes("cryptic") ||
    lowerUA.includes("luasocket") ||
    lowerUA.includes("wininet") ||
    lowerUA.includes("curl") ||
    lowerUA.includes("httpclient");

  if (isKnownExecutor) return false;

  // 1. Browser navigation fetch modes (Standard in Chromium/Firefox/WebKit tab navigations)
  if (secFetchMode === "navigate" || secFetchDest === "document") return true;

  // 2. Browser client hints
  if (req.headers.get("sec-ch-ua")) return true;

  // 3. Browsers explicitly request text/html in their Accept header along with browser user-agent tokens
  const isBrowserUA =
    lowerUA.includes("mozilla") ||
    lowerUA.includes("chrome") ||
    lowerUA.includes("safari") ||
    lowerUA.includes("edge") ||
    lowerUA.includes("firefox");

  if (isBrowserUA && (accept.includes("text/html") || accept.includes("application/xhtml"))) {
    return true;
  }

  return false;
}

function renderProtectedPage(slug: string, scriptName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Protected Script — Aero Auth</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #07090e;
      color: #e2e8f0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
      overflow-x: hidden;
    }
    .ambient-bg {
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
    }
    .card {
      position: relative;
      z-index: 10;
      max-width: 580px;
      width: 100%;
      background: #0f121a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 2.5rem 2rem;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(59, 130, 246, 0.1);
      text-align: center;
    }
    .shield-badge {
      width: 64px;
      height: 64px;
      margin: 0 auto 1.5rem;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #60a5fa;
      font-size: 28px;
      box-shadow: 0 0 25px rgba(59, 130, 246, 0.25);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.6rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-size: 0.85rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .info-box {
      background: #090b10;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: left;
      margin-bottom: 1.75rem;
    }
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.78rem;
      color: #cbd5e1;
      line-height: 1.5;
      margin-bottom: 0.75rem;
    }
    .info-item:last-child { margin-bottom: 0; }
    .info-item span.bullet {
      color: #3b82f6;
      font-weight: bold;
    }
    .code-pill {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      color: #93c5fd;
      font-size: 0.75rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.4);
    }
    .btn-primary:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }
    footer {
      margin-top: 2rem;
      font-size: 0.7rem;
      color: #475569;
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>
  <div class="ambient-bg"></div>

  <div class="card">
    <div class="shield-badge">🛡️</div>
    <div class="tag">● API Protected Script</div>

    <h1>Direct Access Prohibited</h1>
    <p class="subtitle">
      This script endpoint is protected. Raw source code, loaders, and virtual file system modules cannot be accessed or downloaded from a web browser.
    </p>

    <div class="info-box">
      <div class="info-item">
        <span class="bullet">🔒</span>
        <div><strong>Access Restriction:</strong> This script can only be executed directly inside an authenticated in-game Lua executor environment via <span class="code-pill">game:HttpGet()</span>.</div>
      </div>
      <div class="info-item">
        <span class="bullet">🛡️</span>
        <div><strong>Anti-Leak Shield:</strong> In-memory virtual modules are stored in our backend and are never transmitted to unauthorized clients.</div>
      </div>
      <div class="info-item">
        <span class="bullet">🔑</span>
        <div><strong>License Required:</strong> You must claim a valid license key bound to your IP address to run this script in-game.</div>
      </div>
    </div>

    <div class="actions">
      <a href="/claim?script=${encodeURIComponent(slug)}" class="btn btn-primary">
        🔑 Claim License Key
      </a>
      <a href="/" class="btn btn-secondary">
        Return Home
      </a>
    </div>
  </div>

  <footer>
    AERO AUTH SECURE CLIENT GATEWAY • SCRIPT: ${slug.toUpperCase()}
  </footer>
</body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const clientIp = getClientIp(req);
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();

  // 1. IP Rate Limiting Guard
  if (!checkRateLimit(clientIp)) {
    return new NextResponse(
      `-- Error: Rate limit exceeded.\ngame.Players.LocalPlayer:Kick("[AERO AUTH] Rate Limit Exceeded. Try again in 60s.")`,
      {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": "60",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const script = await dbService.getScriptBySlug(slug);

  // 2. Automated Web Scraper & Crawlers Blocker
  if (isMaliciousScraper(userAgent)) {
    const html = renderProtectedPage(slug, script ? script.name : slug);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  // 3. Browser Access Gate
  if (isBrowserRequest(req)) {
    const html = renderProtectedPage(slug, script ? script.name : slug);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  // If script does not exist
  if (!script) {
    return new NextResponse(
      `-- Error: Script with slug '${slug}' not found.\ngame.Players.LocalPlayer:Kick("[AERO AUTH] Invalid Script URL")`,
      { status: 404, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Determine host baseUrl
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  // Check Maintenance Kill-Switch
  if (script.is_maintenance) {
    const rawMsg = script.maintenance_message || "This script is currently under scheduled maintenance. Please check our Discord for updates.";
    const safeMsg = rawMsg.replace(/"/g, '\\"');
    const maintenanceLua = `--[[ AERO AUTH SCRIPT UNDER MAINTENANCE ]]--
pcall(function()
    local StarterGui = game:GetService("StarterGui")
    StarterGui:SetCore("SendNotification", {
        Title = "[AERO AUTH] Under Maintenance",
        Text = "${safeMsg}",
        Duration = 15
    })
end)
warn("[AERO AUTH] Script '${slug}' is currently under maintenance: ${safeMsg}")`;

    return new NextResponse(wrapPolymorphicLuau(maintenanceLua), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  // If script has use_auth === false (Direct Run Mode - Auth Bypassed)
  if (script.use_auth === false) {
    const clientIp = getClientIp(req);
    const userAgent = (req.headers.get("user-agent") || "").toLowerCase();

    let execName = "Unknown Executor";
    if (userAgent.includes("synapse")) execName = "Synapse X";
    else if (userAgent.includes("krnl")) execName = "Krnl";
    else if (userAgent.includes("fluxus")) execName = "Fluxus";
    else if (userAgent.includes("delta")) execName = "Delta";
    else if (userAgent.includes("codex")) execName = "Codex";
    else if (userAgent.includes("roblox")) execName = "Roblox Client";

    const osName =
      userAgent.includes("android") || userAgent.includes("mobile")
        ? "Mobile (Android)"
        : userAgent.includes("iphone") || userAgent.includes("ipad")
        ? "Mobile (iOS)"
        : userAgent.includes("mac")
        ? "Mac OS"
        : "Desktop (Windows)";

    dbService.recordExecution({
      script_id: script.id,
      script_name: script.name,
      roblox_username: "Direct Runner",
      roblox_user_id: null,
      ip_address: clientIp,
      isp: "Direct Execution",
      os: osName,
      executor: execName,
      key_last4: "DIRECT",
      status: "success",
      failure_reason: null,
    }).catch(() => {});

    const directPayload = bundleModularScript({
      entryFile: script.entry_file || "init.lua",
      files: script.modules || {},
    });
    return new NextResponse(wrapPolymorphicLuau(directPayload), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  // Default: Auth Gate is ENABLED
  // Fetch associated loader config
  let loaderConfig = null;
  if (script.loader_config_id) {
    loaderConfig = await dbService.getLoaderConfigById(script.loader_config_id);
  }
  if (!loaderConfig) {
    const configs = await dbService.getLoaderConfigs();
    loaderConfig = configs[0];
  }

  // Check GitHub Auto-Pull if enabled (debounced to once every 60 seconds)
  if (script.github_auto_pull && script.github_repo) {
    const lastPullTime = script.github_last_pulled_at ? new Date(script.github_last_pulled_at).getTime() : 0;
    if (Date.now() - lastPullTime > 60 * 1000) {
      syncScriptFromGitHub(script.id).catch((err) => {
        console.warn(`[Auto-Pull Background] Failed to sync ${script.name}:`, err);
      });
    }
  }

  // Generate the Stage 0 Pre-Flight Middleware Guard Stub
  // Zero UI, zero license keys, zero autoload routines are in this code.
  // Sensitive auth logic is only released after /api/auth/probe verification.
  const stage0Stub = `--[=[
    Aero Auth - Stage 0 Pre-Flight Integrity Guard
    Zero sensitive auth or UI code is contained in this stub.
]=]
local HttpService = game:GetService("HttpService")
local BASE_URL = "${baseUrl}"
local SCRIPT_SLUG = "${slug}"

local function sampleBaseline()
    local sig = ""
    pcall(function()
        if type(debug) == "table" and type(debug.info) == "function" then
            sig = tostring(debug.info(math.abs, "s")) .. ":" .. tostring(debug.info(table.insert, "s"))
        end
    end)
    return sig
end

local function scanEnvironment()
    local flags = {}
    pcall(function()
        local gm = getrawmetatable and getrawmetatable(game)
        if gm and rawget(gm, "__namecall") and islclosure and islclosure(rawget(gm, "__namecall")) then
            table.insert(flags, "namecall_lclosure")
        end
        local dumpers = {"saveinstance", "dumpstring", "rconsolename", "SimpleSpy"}
        for _, d in ipairs(dumpers) do
            if getgenv and getgenv()[d] ~= nil then
                table.insert(flags, "dumper_" .. d)
            end
        end
    end)
    return flags
end

local function executePreFlight()
    local getReq = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)
    local challengeData = nil
    pcall(function()
        local raw = game:HttpGet(BASE_URL .. "/api/auth/probe?slug=" .. SCRIPT_SLUG .. "&_t=" .. os.time())
        challengeData = HttpService:JSONDecode(raw)
    end)
    
    if not challengeData or not challengeData.session_id or not challengeData.challenges then
        return
    end
    
    local solutions = {}
    for _, ch in ipairs(challengeData.challenges) do
        if ch.type == "arithmetic" then
            local seed = ch.seed
            local rounds = ch.rounds
            local acc = bit32.bxor(seed, 0x5F3759DF)
            for i = 1, rounds do
                acc = bit32.bxor(bit32.band(acc * 31, 0xFFFFFFFF), bit32.band(i * 17, 0xFFFFFFFF))
            end
            solutions.arithmetic = acc % 1000003
        end
    end
    
    local flags = scanEnvironment()
    local baseline = sampleBaseline()
    
    local payload = HttpService:JSONEncode({
        session_id = challengeData.session_id,
        slug = SCRIPT_SLUG,
        hwid = (type(gethwid) == "function" and gethwid()) or "",
        solutions = solutions,
        tamper_flags = flags,
        c_signature = baseline,
    })
    
    local respBody = nil
    if getReq then
        local res = getReq({
            Url = BASE_URL .. "/api/auth/probe",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = payload,
        })
        if res and (res.StatusCode == 200 or res.Status == 200) then
            respBody = res.Body
        end
    else
        pcall(function()
            respBody = game:HttpPost(BASE_URL .. "/api/auth/probe", payload, "application/json")
        end)
    end
    
    if not respBody then return end
    
    local verified = nil
    pcall(function()
        verified = HttpService:JSONDecode(respBody)
    end)
    
    if verified and verified.success and verified.loader_payload then
        local fn, err = loadstring(verified.loader_payload)
        if fn then
            task.spawn(fn)
        end
    end
end

task.spawn(executePreFlight)
`;

  const polymorphicLoader = wrapPolymorphicLuau(stage0Stub);

  return new NextResponse(polymorphicLoader, {
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
