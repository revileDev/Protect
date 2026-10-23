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
  if (activeProbeSessions.size > 2000) {
    activeProbeSessions.forEach((val, key) => {
      if (now - val.timestamp > PROBE_TIMEOUT_MS) {
        activeProbeSessions.delete(key);
      }
    });
  }
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

  // Compute expected arithmetic solution:
  // Initial accumulator = (seed ^ 0x5F3759DF) % 65536
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
      {
        type: "arithmetic",
        seed,
        rounds,
      },
      {
        type: "closure_assert",
        targets: ["math.abs", "string.find", "table.insert"],
      },
      {
        type: "env_check",
        checks: ["namecall_native", "loadstring_pcount", "dumper_globals"],
      },
    ],
  });
}

/**
 * POST /api/auth/probe
 * Evaluates client pre-flight attestation solutions and delivers Gateway Access Token + Encrypted Auth Loader.
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

    // Single-use session check
    activeProbeSessions.delete(session_id);

    // Verify script slug
    if (session.slug !== slug.trim().toLowerCase()) {
      return NextResponse.json({ error: "Session script mismatch." }, { status: 403 });
    }

    // 1. Evaluate Tamper Flags
    if (Array.isArray(tamper_flags) && tamper_flags.length > 0) {
      console.warn(`[Security Alert] Tamper flags reported by client ${clientIp}:`, tamper_flags);
      await dbService.recordBypassAttempt({
        script_slug: slug,
        ip_address: clientIp,
        hwid: hwid || null,
        bypass_type: "Pre-Flight Probe Hook/Tamper Detection: " + tamper_flags.join(", "),
        details: { tamper_flags, c_signature },
      });

      return NextResponse.json(
        { error: "Access Denied: Environment integrity verification failed." },
        { status: 403 }
      );
    }

    // 2. Validate Challenge Solutions
    const arithmeticSolution = solutions?.arithmetic;
    if (typeof arithmeticSolution !== "number" || arithmeticSolution !== session.expectedArithmetic) {
      console.warn(`[Security Alert] Arithmetic challenge mismatch from ${clientIp}. Expected ${session.expectedArithmetic}, got ${arithmeticSolution}`);
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
      expires_in_sec: 120, // 2 minutes to submit key
    });

    // 4. Retrieve Script & Loader Config
    const script = await dbService.getScriptBySlug(slug);
    if (!script) {
      return NextResponse.json({ error: "Script not found." }, { status: 404 });
    }

    // Determine host baseUrl
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // Fetch loader config
    let loaderConfig = null;
    if (script.loader_config_id) {
      loaderConfig = await dbService.getLoaderConfigById(script.loader_config_id);
    }
    if (!loaderConfig) {
      const configs = await dbService.getLoaderConfigs();
      loaderConfig = configs[0];
    }

    // Generate the Auth Loader payload (Contains UI and saved autoload key evaluator)
    const rawLoaderLua = generateLuaLoader(baseUrl, slug, {
      brand_name: loaderConfig?.brand_name || "AERO AUTH",
      title: loaderConfig?.title || "Key System",
      accent_color: loaderConfig?.accent_color || "#00a2ff",
      background_color: loaderConfig?.background_color || "#16161e",
      card_color: loaderConfig?.card_color || "#21222e",
      text_color: loaderConfig?.text_color || "#ffffff",
      subtext_color: loaderConfig?.subtext_color || "#9ca3af",
      corner_radius: loaderConfig?.corner_radius ?? 10,
      frame_width: loaderConfig?.frame_width || 360,
      frame_height: loaderConfig?.frame_height || 250,
      font_face: loaderConfig?.font_face || "GothamMedium",
      custom_subtitle: loaderConfig?.custom_subtitle || "Enter your license key below",
      key_placeholder: loaderConfig?.key_placeholder || "Paste your license key here...",
      verify_button_text: loaderConfig?.verify_button_text || "VERIFY KEY",
      claim_button_text: loaderConfig?.claim_button_text || "CLAIM YOUR KEY (COPY LINK)",
      show_discord_button: loaderConfig?.show_discord_button,
      discord_button_text: loaderConfig?.discord_button_text,
      discord_invite_url: loaderConfig?.discord_invite_url,
      watermark_text: script.watermark_text || loaderConfig?.watermark_text || "AERO PROTECT",
      show_watermark: script.show_watermark !== false && loaderConfig?.show_watermark !== false,
      layout_positions: loaderConfig?.layout_positions,
    });

    // Embed the gateway token into the delivered loader payload closure so it submits it automatically
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
