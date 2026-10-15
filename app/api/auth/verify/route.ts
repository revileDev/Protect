import { NextRequest, NextResponse } from "next/server";
import { dbService, isStaffReviewKey } from "@/lib/store";
import { bundleModularScript } from "@/lib/module-bundler";
import { sendExecutionWebhook } from "@/lib/discord-webhook";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

async function lookupIsp(ip: string): Promise<string> {
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return "Localhost / Private Network";
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=isp,org`, {
      cache: "force-cache",
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      return data.isp || data.org || "Generic ISP";
    }
  } catch {
    // ignore
  }
  return "Generic ISP";
}

export async function POST(req: NextRequest) {
  let clientIp = "127.0.0.1";
  let targetScriptName = "Unknown Script";
  let targetScriptId = "";
  let keyLast4 = "NONE";
  let robloxUser = "Unknown";
  let robloxId = "N/A";
  let detectedExecutor = "Unknown";
  let detectedOs = "Unknown";
  let webhookUrl = "";
  let webhookEnabled = false;

  try {
    const body = await req.json();
    const { key, script_slug, hwid, roblox_username, roblox_user_id, executor, os } = body;

    clientIp = getClientIp(req);
    robloxUser = roblox_username || "Unknown";
    robloxId = roblox_user_id || "N/A";
    detectedExecutor = executor || "Unknown Executor";
    detectedOs = os || "Desktop (Windows)";

    if (key && typeof key === "string") {
      keyLast4 = key.trim().slice(-4).toUpperCase();
    }

    // Resolve script and loader config early for webhook and logging
    let script = null;
    if (script_slug) {
      script = await dbService.getScriptBySlug(script_slug);
    }
    if (script) {
      targetScriptName = script.name;
      targetScriptId = script.id;
      if (script.loader_config_id) {
        const loaderConfig = await dbService.getLoaderConfigById(script.loader_config_id);
        if (loaderConfig?.webhook_enabled && loaderConfig.webhook_url) {
          webhookEnabled = true;
          webhookUrl = loaderConfig.webhook_url;
        }
      }
    }

    const isp = await lookupIsp(clientIp);

    const logAndNotifyFailure = async (reason: string) => {
      await dbService.recordExecution({
        script_id: targetScriptId,
        script_name: targetScriptName,
        roblox_username: robloxUser,
        roblox_user_id: robloxId,
        ip_address: clientIp,
        isp,
        os: detectedOs,
        executor: detectedExecutor,
        key_last4: keyLast4,
        status: "failed",
        failure_reason: reason,
      });

      if (webhookEnabled && webhookUrl) {
        await sendExecutionWebhook({
          webhookUrl,
          scriptName: targetScriptName,
          robloxUsername: robloxUser,
          robloxUserId: robloxId,
          ipAddress: clientIp,
          isp,
          os: detectedOs,
          executor: detectedExecutor,
          keyLast4,
          success: false,
          failureReason: reason,
        });
      }
    };

    if (!key) {
      await logAndNotifyFailure("Missing Key: No license key provided.");
      return NextResponse.json({ error: "License key is required." }, { status: 400 });
    }

    // 1. Check IP Ban status
    const isBanned = await dbService.isIpBanned(clientIp);
    if (isBanned) {
      await logAndNotifyFailure("IP Banned: Client IP is blacklisted.");
      return NextResponse.json(
        { error: "Access Denied: Your IP address is banned from this service." },
        { status: 403 }
      );
    }

    // 2. Fetch Key Record
    const keyRecord = await dbService.getKeyByString(key.trim());
    if (!keyRecord) {
      await logAndNotifyFailure("Invalid Key: License key does not exist.");
      return NextResponse.json(
        { error: "Invalid Key: License key does not exist." },
        { status: 401 }
      );
    }

    const isStaff = isStaffReviewKey(keyRecord);

    if (keyRecord.status === "banned") {
      if (!isStaff) await logAndNotifyFailure("Revoked Key: License key was banned.");
      return NextResponse.json(
        { error: "Key Revoked: This license has been permanently banned." },
        { status: 403 }
      );
    }

    if (!isStaff && keyRecord.status === "unclaimed") {
      await logAndNotifyFailure("Unclaimed Key: Key not claimed from website.");
      return NextResponse.json(
        { error: "Unclaimed Key: Please claim this key from the website first." },
        { status: 403 }
      );
    }

    // 3. Check Expiration (Skipped for staff review keys - completely lifetime)
    if (!isStaff && keyRecord.expires_at) {
      const now = new Date();
      const expires = new Date(keyRecord.expires_at);
      if (now > expires) {
        await logAndNotifyFailure("Expired Key: License expired.");
        return NextResponse.json(
          { error: "Expired Key: Your license key has expired." },
          { status: 403 }
        );
      }
    }

    // 4. IP Matching: Must match claimed IP (Skipped for staff review keys - infinite users)
    if (!isStaff) {
      const normalizeIp = (ip: string | null) => (ip === "::1" ? "127.0.0.1" : ip);
      const normalizedClaimed = normalizeIp(keyRecord.claimed_ip);
      const normalizedClient = normalizeIp(clientIp);

      if (normalizedClaimed && normalizedClaimed !== normalizedClient) {
        const reason = `IP Mismatch (Claimed on ${normalizedClaimed.slice(0, 8)}..., executed from ${normalizedClient})`;
        await logAndNotifyFailure(reason);
        return NextResponse.json(
          {
            error: `IP Mismatch! This key was claimed by IP ${normalizedClaimed.slice(0, 7)}... but your IP is ${normalizedClient}. Re-claim your key on your network.`,
          },
          { status: 403 }
        );
      }
    }

    // 5. Fetch Script if not already resolved
    if (!script) {
      if (keyRecord.script_id && keyRecord.script_id !== "all") {
        const allScripts = await dbService.getScripts();
        script = allScripts.find((s) => s.id === keyRecord.script_id) || null;
      }
      if (script) {
        targetScriptName = script.name;
        targetScriptId = script.id;
        if (script.loader_config_id) {
          const loaderConfig = await dbService.getLoaderConfigById(script.loader_config_id);
          if (loaderConfig?.webhook_enabled && loaderConfig.webhook_url) {
            webhookEnabled = true;
            webhookUrl = loaderConfig.webhook_url;
          }
        }
      }
    }

    if (!script) {
      if (!isStaff) await logAndNotifyFailure("Script Not Found: Missing target script.");
      return NextResponse.json({ error: "Script payload not found." }, { status: 404 });
    }

    // 5b. Script-Specific Key Isolation: Ensure key claimed for Script A cannot be used on Script B (unless assigned to "all")
    if (keyRecord.script_id && keyRecord.script_id !== "all" && script.id && keyRecord.script_id !== script.id) {
      const allScripts = await dbService.getScripts();
      const claimedForScript = allScripts.find((s) => s.id === keyRecord.script_id);
      const claimedForName = claimedForScript ? claimedForScript.name : "another script";
      const reason = `Script Mismatch: Key was claimed for "${claimedForName}", but executed on "${script.name}"`;
      if (!isStaff) await logAndNotifyFailure(reason);
      return NextResponse.json(
        {
          error: `Script Mismatch! This key was claimed specifically for "${claimedForName}" and cannot be used for "${script.name}".`,
        },
        { status: 403 }
      );
    }

    // 6. STAFF REVIEW KEY FAST-PATH:
    // Completely lifetime, zero user PII, anonymous staff review session tracking
    if (isStaff) {
      const staffReview = await dbService.createStaffReview({
        key_id: keyRecord.id,
        script_id: script.id,
        script_name: script.name,
        key_label: keyRecord.notes || "Staff Review Key",
      });

      const payload = bundleModularScript({
        entryFile: script.entry_file || "init.lua",
        files: script.modules || {},
      });

      return NextResponse.json({
        success: true,
        session_token: staffReview.id,
        is_staff_review: true,
        is_admin_key: true,
        payload,
      });
    }

    // 7. Normal User Key Flow:
    // Activate key and start its expiration countdown upon first execution
    await dbService.activateKey(keyRecord.id);

    // Create active in-game session
    const session = await dbService.createSession({
      key_id: keyRecord.id,
      script_id: script.id,
      ip_address: clientIp,
      hwid: hwid || null,
      roblox_username: robloxUser,
      roblox_user_id: robloxId,
      status: "active",
      tamper_flags: [],
    });

    // Record Successful Execution & Dispatch Webhook
    await dbService.recordExecution({
      script_id: script.id,
      script_name: script.name,
      roblox_username: robloxUser,
      roblox_user_id: robloxId,
      ip_address: clientIp,
      isp,
      os: detectedOs,
      executor: detectedExecutor,
      key_last4: keyLast4,
      status: "success",
      failure_reason: null,
    });

    if (webhookEnabled && webhookUrl) {
      await sendExecutionWebhook({
        webhookUrl,
        scriptName: script.name,
        robloxUsername: robloxUser,
        robloxUserId: robloxId,
        ipAddress: clientIp,
        isp,
        os: detectedOs,
        executor: detectedExecutor,
        keyLast4,
        success: true,
      });
    }

    // Assemble protected modular virtual bundle
    const payload = bundleModularScript({
      entryFile: script.entry_file || "init.lua",
      files: script.modules || {},
    });

    return NextResponse.json({
      success: true,
      session_token: session.id,
      payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal verification error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
