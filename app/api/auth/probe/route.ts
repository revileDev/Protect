// app/api/auth/probe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { generateLuaLoader } from "@/lib/lua-generator";
import { getClientIp, normalizeIp } from "@/lib/ip";
import { wrapPolymorphicLuau } from "@/lib/polymorphic";
import crypto from "crypto";

interface ProbeSession {
  sessionId: string;
  slug: string;
  salt: string;
  seed: number;
  expectedArithmetic: number;
  timestamp: number;
  ip: string;
}

const activeProbeSessions = new Map<string, ProbeSession>();
const PROBE_TIMEOUT_MS = 60 * 1000; // 60 seconds

function cleanupOldSessions() {
  const now = Date.now();
  // Only prune when the map is large to avoid per-request overhead
  if (activeProbeSessions.size > 2000) {
    activeProbeSessions.forEach((val, key) => {
      if (now - val.timestamp > PROBE_TIMEOUT_MS) {
        activeProbeSessions.delete(key);
      }
    });
  }
}

// Flags that are considered "hard" evidence of an ACTIVE running spy/interceptor tool.
// Standard executor APIs (dumpstring, rconsolename, saveinstance, etc.) are NOT in this list.
const HARD_FLAG_PREFIXES = [
  "namecall_spy_active",       // Live __namecall Lua-closure override, confirmed dual-signal
  "loadstring_replaced_live",  // loadstring replaced mid-session, deviates from boot baseline
  "active_spy_",               // Running spy tool instance (SimpleSpy, Hydroxide, GGSpy, etc.)
];

// How many distinct HARD flags must be present before the server takes any enforcement action.
// A single hard flag is logged only. Two or more trigger a soft-reject (no ban, no bypass record).
// A ban/bypass record is only written if 3+ distinct hard flags are confirmed.
const DUAL_CONFIRM_THRESHOLD = 2;
const BAN_THRESHOLD = 3;

function classifyFlags(tamperFlags: string[]): {
  hardCount: number;
  isBanworthy: boolean;
  isDualConfirmed: boolean;
  flagSummary: string;
} {
  const hardFlags = tamperFlags.filter((f) =>
    HARD_FLAG_PREFIXES.some((prefix) => f.startsWith(prefix))
  );

  return {
    hardCount: hardFlags.length,
    isDualConfirmed: hardFlags.length >= DUAL_CONFIRM_THRESHOLD,
    isBanworthy: hardFlags.length >= BAN_THRESHOLD,
    flagSummary: hardFlags.join(", "),
  };
}

/**
 * GET /api/auth/probe?slug=...
 * Issues a dynamic, randomized pre-flight challenge suite.
 */
export async function GET(req: NextRequest) {
  cleanupOldSessions();
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim().toLowerCase();

  if (!slug) {
    return NextResponse.json({ error: "Script slug required." }, { status: 400 });
  }

  const script = await dbService.getScriptBySlug(slug);
  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  const clientIp = getClientIp(req);
  const sessionId = "ps_" + crypto.randomBytes(16).toString("hex");
  const salt = crypto.randomBytes(8).toString("hex");
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const rounds = (seed % 5) + 3; // 3 to 7 rounds

  let acc = (seed ^ 0x5f3759df) >>> 0;
  for (let i = 1; i <= rounds; i++) {
    acc = ((acc * 31) ^ (i * 17)) >>> 0;
  }
  const expectedArithmetic = acc % 1000003;

  activeProbeSessions.set(sessionId, {
    sessionId,
    slug,
    salt,
    seed,
    expectedArithmetic,
    timestamp: Date.now(),
    ip: normalizeIp(clientIp),
  });

  return NextResponse.json({
    session_id: sessionId,
    salt,
    timestamp: Math.floor(Date.now() / 1000),
    challenges: [
      { type: "arithmetic", seed, rounds },
      { type: "closure_assert", targets: ["math.abs", "string.find", "table.insert"] },
      { type: "env_check", checks: ["namecall_native", "loadstring_pcount"] },
    ],
  });
}

/**
 * POST /api/auth/probe
 * Evaluates client attestation and delivers Gateway Access Token + Encrypted Auth Loader.
 *
 * False-Positive Protection Matrix:
 * ┌──────────────────────────────────┬─────────────────────┬─────────────────────────┐
 * │ Scenario                         │ Hard Flags          │ Server Action           │
 * ├──────────────────────────────────┼─────────────────────┼─────────────────────────┤
 * │ Normal executor API present      │ 0 (not flagged)     │ Pass — proceed normally │
 * │ Ambiguous / single soft signal   │ 0-1 hard flag       │ Log only — still pass   │
 * │ Dual-confirmed spy tool active   │ 2 hard flags        │ Soft block — no ban     │
 * │ Triple-confirmed active attack   │ 3+ hard flags       │ Hard block + log bypass │
 * └──────────────────────────────────┴─────────────────────┴─────────────────────────┘
 */
export async function POST(req: NextRequest) {
  cleanupOldSessions();
  const clientIp = getClientIp(req);

  try {
    const body = await req.json();
    const { session_id, slug, hwid, solutions, tamper_flags, c_signature } = body;

    if (!session_id || !slug) {
      return NextResponse.json({ error: "Invalid probe payload." }, { status: 400 });
    }

    const session = activeProbeSessions.get(session_id);
    if (!session) {
      return NextResponse.json({ error: "Probe session expired or invalid." }, { status: 403 });
    }

    // Single-use session
    activeProbeSessions.delete(session_id);

    if (session.slug !== slug.trim().toLowerCase()) {
      return NextResponse.json({ error: "Session script mismatch." }, { status: 403 });
    }

    // 1. Evaluate Tamper Flags with dual-confirmation threshold
    if (Array.isArray(tamper_flags) && tamper_flags.length > 0) {
      const { hardCount, isDualConfirmed, isBanworthy, flagSummary } = classifyFlags(tamper_flags);

      if (isBanworthy) {
        // 3+ distinct hard signals = active confirmed attack → log bypass attempt
        console.warn(`[Security] Hard block: ${clientIp} | Flags: ${flagSummary}`);
        // Fire-and-forget — do not await, do not let this slow down legitimate users
        dbService.recordBypassAttempt(
          clientIp,
          hwid || null,
          slug,
          "Pre-Flight Probe: Active Spy Tool Confirmed (" + flagSummary + ")"
        ).catch(() => {});

        return NextResponse.json(
          { blocked: true, error: "Access Denied: Active interception tool detected." },
          { status: 403 }
        );
      }

      if (isDualConfirmed) {
        // 2 hard signals = soft block, log only, no ban record (prevents false-positive bans)
        console.warn(`[Security] Soft block (no ban): ${clientIp} | Flags: ${flagSummary}`);
        return NextResponse.json(
          { blocked: true, error: "Access Denied: Environment integrity check failed." },
          { status: 403 }
        );
      }

      // 0-1 hard flags = ambiguous single signal, likely executor quirk — allow through, log softly
      console.info(`[Security] Soft flag (ignored): ${clientIp} | Flags: ${tamper_flags.join(", ")} | Hard: ${hardCount}`);
      // Deliberately fall through and allow access — no block, no ban record
    }

    // 2. Validate arithmetic challenge solution
    const arithmeticSolution = solutions?.arithmetic;
    if (typeof arithmeticSolution !== "number" || arithmeticSolution !== session.expectedArithmetic) {
      console.warn(`[Security] Challenge mismatch from ${clientIp}. Expected ${session.expectedArithmetic}, got ${arithmeticSolution}`);
      return NextResponse.json(
        { error: "Access Denied: Challenge attestation mismatch." },
        { status: 403 }
      );
    }

    // 3. Issue Gateway Access Token
    const gatewayToken = await dbService.createProbeToken({
      script_slug: slug,
      ip_address: clientIp,
      hwid: hwid || null,
      challenge_seed: session.salt,
      expires_in_sec: 120,
    });

    // 4. Retrieve Script & Loader Config
    const script = await dbService.getScriptBySlug(slug);
    if (!script) {
      return NextResponse.json({ error: "Script not found." }, { status: 404 });
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    let loaderConfig = null;
    if (script.loader_config_id) {
      loaderConfig = await dbService.getLoaderConfigById(script.loader_config_id);
    }
    if (!loaderConfig) {
      const configs = await dbService.getLoaderConfigs();
      loaderConfig = configs[0];
    }

    const rawLoaderLua = generateLuaLoader(baseUrl, slug, {
      brand_name:          loaderConfig?.brand_name || "AERO AUTH",
      title:               loaderConfig?.title || "Key System",
      accent_color:        loaderConfig?.accent_color || "#00a2ff",
      background_color:    loaderConfig?.background_color || "#16161e",
      card_color:          loaderConfig?.card_color || "#21222e",
      text_color:          loaderConfig?.text_color || "#ffffff",
      subtext_color:       loaderConfig?.subtext_color || "#9ca3af",
      corner_radius:       loaderConfig?.corner_radius ?? 10,
      frame_width:         loaderConfig?.frame_width || 360,
      frame_height:        loaderConfig?.frame_height || 250,
      font_face:           loaderConfig?.font_face || "GothamMedium",
      custom_subtitle:     loaderConfig?.custom_subtitle || "Enter your license key below",
      key_placeholder:     loaderConfig?.key_placeholder || "Paste your license key here...",
      verify_button_text:  loaderConfig?.verify_button_text || "VERIFY KEY",
      claim_button_text:   loaderConfig?.claim_button_text || "CLAIM YOUR KEY (COPY LINK)",
      show_discord_button: loaderConfig?.show_discord_button,
      discord_button_text: loaderConfig?.discord_button_text,
      discord_invite_url:  loaderConfig?.discord_invite_url,
      watermark_text:      script.watermark_text || loaderConfig?.watermark_text || "AERO PROTECT",
      show_watermark:      script.show_watermark !== false && loaderConfig?.show_watermark !== false,
      layout_positions:    loaderConfig?.layout_positions,
    });

    const loaderWithToken = `--[[ AERO GATEWAY AUTHORIZED PAYLOAD ]]
_G.__AERO_GATEWAY_TOKEN = "${gatewayToken}";
${rawLoaderLua}`;

    const polymorphicPayload = wrapPolymorphicLuau(loaderWithToken);

    return NextResponse.json({
      success: true,
      gateway_token: gatewayToken,
      loader_payload: polymorphicPayload,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error evaluating probe";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
