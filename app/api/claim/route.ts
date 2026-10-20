import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { getClientIp } from "@/lib/ip";
import { antiBypassService } from "@/lib/anti-bypass";

async function isVpnOrProxy(req: NextRequest, ip: string): Promise<boolean> {
  const via = req.headers.get("via");
  const forwardHeader = req.headers.get("x-forwarded-proto");
  const proxyConnection = req.headers.get("proxy-connection");

  if (via || proxyConnection) return true;

  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return false;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,proxy,hosting`, {
      cache: "no-store",
      headers: { "User-Agent": "AeroAuthProxyCheck/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.proxy === true || data.hosting === true) {
        return true;
      }
    }
  } catch {
    // If external service is unavailable, fail open
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { searchParams } = new URL(req.url);
    const script_slug = searchParams.get("script") || searchParams.get("script_slug") || "";
    const script_id = searchParams.get("script_id") || "";

    let targetScriptId = script_id;
    if (!targetScriptId && script_slug) {
      const script = await dbService.getScriptBySlug(script_slug);
      if (script) targetScriptId = script.id;
    }

    const existingKey = await dbService.getActiveKeyForIp(ip, targetScriptId);
    const settings = await dbService.getSettings();

    if (existingKey) {
      return NextResponse.json({
        already_claimed: true,
        key: existingKey.key_string,
        duration_hours: existingKey.duration_hours,
        bound_ip: existingKey.claimed_ip,
        expires_at: existingKey.expires_at,
        discord_invite_url: settings.discord_invite_url || "https://discord.gg/AeCYnnQmq5",
        message:
          "You have already claimed a license key for this script on your IP address. If you need another key, please join our Discord.",
      });
    }

    return NextResponse.json({
      already_claimed: false,
      discord_invite_url: settings.discord_invite_url || "https://discord.gg/AeCYnnQmq5",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error checking active key";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, script_slug, script_id, discord_user } = body;
    const ip = getClientIp(req);

    // If client is pinging that checkpoint validation has started
    if (action === "start_checkpoint") {
      await dbService.recordCheckpoint("started", ip);
      return NextResponse.json({ status: "checkpoint_started" });
    }

    // Handle self-service Dynamic IP Reset (12h cooldown)
    if (action === "reset_ip") {
      const { key } = body;
      if (!key || typeof key !== "string" || !key.trim()) {
        return NextResponse.json({ error: "License key is required to reset IP." }, { status: 400 });
      }
      try {
        const updated = await dbService.resetKeyIp(key.trim(), ip);
        return NextResponse.json({
          success: true,
          message: `License key successfully rebound to your current IP (${ip}).`,
          bound_ip: updated.claimed_ip,
        });
      } catch (resetErr: unknown) {
        const msg = resetErr instanceof Error ? resetErr.message : "Failed to reset IP";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const settings = await dbService.getSettings();

    // 1. IP Ban check
    if (await dbService.isIpBanned(ip)) {
      return NextResponse.json(
        { error: "Access Denied: Your IP is banned from claiming keys." },
        { status: 403 }
      );
    }

    // 2. VPN Detection check
    if (settings.vpn_detection_enabled) {
      const vpnDetected = await isVpnOrProxy(req, ip);
      if (vpnDetected) {
        return NextResponse.json(
          {
            error: "VPN or Proxy Detected! Please turn off your VPN/Proxy and reload this page to claim a key.",
            is_vpn: true,
          },
          { status: 403 }
        );
      }
    }

    // 3. Resolve target script ID
    let targetScriptId = script_id || "";
    if (!targetScriptId && script_slug) {
      const script = await dbService.getScriptBySlug(script_slug);
      if (script) targetScriptId = script.id;
    }

    // 4. Validate claim method
    if (settings.claim_method === "discord_oauth") {
      if (!discord_user || !discord_user.id) {
        return NextResponse.json(
          { error: "Discord authentication required. Please join our Discord and link your account." },
          { status: 400 }
        );
      }
    } else {
      // Enforce strict Anti-Bypass checkpoint verification token
      const { session_id, claim_token } = body;
      if (!session_id || !claim_token) {
        return NextResponse.json(
          {
            error: "Access Denied: Valid checkpoint verification token is required. Bypassing checkpoints is not permitted.",
            bypass_blocked: true,
          },
          { status: 403 }
        );
      }

      const claimValidation = antiBypassService.verifyAndConsumeClaimToken(
        String(session_id),
        String(claim_token),
        ip,
        targetScriptId
      );

      if (!claimValidation.valid) {
        return NextResponse.json(
          {
            error: claimValidation.error || "Checkpoint authorization failed. Please complete all checkpoints legitimately.",
            bypass_blocked: true,
          },
          { status: 403 }
        );
      }
    }

    // 5. Enforce 1 key per user / IP: Check if an active unexpired key is already bound to this IP
    const existingActiveKey = await dbService.getActiveKeyForIp(ip, targetScriptId);
    if (existingActiveKey) {
      return NextResponse.json({
        success: true,
        key: existingActiveKey.key_string,
        duration_hours: existingActiveKey.duration_hours,
        bound_ip: existingActiveKey.claimed_ip,
        expires_at: existingActiveKey.expires_at,
        already_claimed: true,
        message: "Active key found for your IP address.",
      });
    }

    // 6. Claim fresh key from pool and bind to IP and Discord
    const claimedKey = await dbService.claimKey(targetScriptId, ip, discord_user);

    if (!claimedKey) {
      return NextResponse.json(
        {
          error: "No available keys in the pool! Please contact the administrator to generate more keys.",
        },
        { status: 404 }
      );
    }

    // Record checkpoint completion
    await dbService.recordCheckpoint("completed", ip);

    return NextResponse.json({
      success: true,
      key: claimedKey.key_string,
      duration_hours: claimedKey.duration_hours,
      bound_ip: claimedKey.claimed_ip,
      expires_at: claimedKey.expires_at,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error claiming key";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
