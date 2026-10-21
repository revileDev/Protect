import { NextRequest, NextResponse } from "next/server";
import { dbService, isStaffReviewKey, type ScriptRecord } from "@/lib/store";
import { bundleModularScript } from "@/lib/module-bundler";
import { sendExecutionWebhook } from "@/lib/discord-webhook";
import { getClientIp, normalizeIp, getClientGeo } from "@/lib/ip";
import { encryptSessionPayload, isNonceReplayed, recordUsedNonce } from "@/lib/crypto-util";

function isMaliciousScraper(userAgent: string): boolean {
  const lower = userAgent.toLowerCase();
  return (
    lower.includes("python-requests") ||
    lower.includes("aiohttp") ||
    lower.includes("scrapy") ||
    lower.includes("wget") ||
    lower.includes("go-http-client") ||
    lower.includes("postmanruntime") ||
    lower.includes("insomnia") ||
    lower.includes("urllib") ||
    lower.includes("node-fetch") ||
    lower.includes("axios")
  );
}

/**
 * Validates Roblox user ID and username against Roblox's official public Users API.
 * Detects forged or spoofed user accounts, ID-username mismatches, and synthetic IDs.
 */
async function verifyRobloxIdentity(
  userId: unknown,
  username: unknown
): Promise<{ valid: boolean; reason?: string }> {
  const userIdStr = typeof userId === "string" ? userId.trim() : typeof userId === "number" ? String(userId) : "";
  const usernameStr = typeof username === "string" ? username.trim() : "";

  // 1. Format validation: Roblox User ID must be positive digits only
  if (!/^\d{1,12}$/.test(userIdStr) || Number(userIdStr) <= 0) {
    return { valid: false, reason: `Invalid non-numeric or malformed Roblox UserId '${userIdStr}'` };
  }

  // 2. Format validation: Roblox username format (3-20 chars, alphanumeric + underscore)
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameStr)) {
    return { valid: false, reason: `Invalid Roblox username format '${usernameStr}'` };
  }

  // 3. Official Roblox public users API validation with 2500ms timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://users.roblox.com/v1/users/${userIdStr}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Roblox/WinInet",
        "Accept": "application/json",
      },
      cache: "force-cache",
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return { valid: false, reason: `Roblox user ID ${userIdStr} does not exist on Roblox` };
    }
    if (res.ok) {
      const data = await res.json();
      const realName = (data.name || "").trim();
      if (!realName || realName.toLowerCase() !== usernameStr.toLowerCase()) {
        return {
          valid: false,
          reason: `Roblox User ID ${userIdStr} officially belongs to '${realName}', but request supplied username '${usernameStr}'`,
        };
      }
    }
  } catch (err: unknown) {
    // Fail-safe: if Roblox API has network timeout, allow format-checked request through so Roblox CDN hiccups don't kick users
    console.warn("Roblox public Users API verification skipped due to network timeout/error:", err);
  }

  return { valid: true };
}

async function lookupIsp(ip: string): Promise<string> {
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return "Localhost / Private Network";
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=isp,org`, {
      signal: controller.signal,
      cache: "force-cache",
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return data.isp || data.org || "Generic ISP";
    }
  } catch {
    // ignore
  }
  return "Generic ISP";
}

// In-memory sliding cache tracking failed key probes per IP to prevent brute-forcing
const failedKeyAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_FAILED_KEY_PROBES = 8;
const FAILED_KEY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

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
    clientIp = getClientIp(req);
    const clientGeo = getClientGeo(req);
    const userAgent = req.headers.get("user-agent") || "";
    const body = await req.json();

    // 0. Automated Scraper / Bot Tool Blocker
    if (isMaliciousScraper(userAgent)) {
      await dbService.banIp(
        clientIp,
        `Automated Scraper Tool Detected hitting Verify API (${userAgent})`
      );
      return NextResponse.json(
        { error: "Access Denied: Automated tools, scrapers, and external HTTP clients are strictly forbidden." },
        { status: 403 }
      );
    }

    const {
      key,
      script_slug,
      hwid,
      roblox_username,
      roblox_user_id,
      executor,
      os,
      place_id,
      place_name,
      job_id,
      timestamp,
      client_nonce,
      tamper_flags,
    } = body;

    // 1. Replay & Timestamp Verification Guard
    if (timestamp === undefined || timestamp === null) {
      return NextResponse.json(
        { error: "Verification timestamp required." },
        { status: 400 }
      );
    }
    const clientTime = Number(timestamp);
    const serverTime = Math.floor(Date.now() / 1000);
    if (isNaN(clientTime) || Math.abs(serverTime - clientTime) > 90) {
      return NextResponse.json(
        { error: "Verification timestamp expired or out of sync (±90s tolerance)." },
        { status: 403 }
      );
    }

    if (!client_nonce || typeof client_nonce !== "string" || client_nonce.trim() === "") {
      return NextResponse.json(
        { error: "Verification client nonce required." },
        { status: 400 }
      );
    }
    if (isNonceReplayed(client_nonce)) {
      return NextResponse.json(
        { error: "Security Alert: Verification nonce replay detected." },
        { status: 403 }
      );
    }
    recordUsedNonce(client_nonce);

    robloxUser = roblox_username || "Unknown";
    robloxId = roblox_user_id || "N/A";
    detectedExecutor = executor || "Unknown Executor";
    detectedOs = os || "Desktop (Windows)";

    if (key && typeof key === "string") {
      keyLast4 = key.trim().slice(-4).toUpperCase();
    }

    // Resolve script and loader config early for webhook and logging
    let script: ScriptRecord | null = null;
    if (script_slug) {
      script = await dbService.getScriptBySlug(script_slug);
    }
    if (script) {
      targetScriptName = script.name;
      targetScriptId = script.id;
    }

    const resolveWebhook = async (sc?: ScriptRecord | null) => {
      if (sc?.loader_config_id) {
        const loaderConfig = await dbService.getLoaderConfigById(sc.loader_config_id);
        if (loaderConfig?.webhook_enabled && loaderConfig.webhook_url?.trim()) {
          return { enabled: true, url: loaderConfig.webhook_url.trim() };
        }
      }
      // Fallback: check all loader configs in database for an active webhook
      try {
        const allConfigs = await dbService.getLoaderConfigs();
        const activeConfig = allConfigs.find((c) => c.webhook_enabled && c.webhook_url?.trim()?.startsWith("http"));
        if (activeConfig && activeConfig.webhook_url) {
          return { enabled: true, url: activeConfig.webhook_url.trim() };
        }
      } catch (err) {
        console.error("Error looking up fallback loader webhook:", err);
      }
      return { enabled: false, url: "" };
    };

    const initialWh = await resolveWebhook(script);
    webhookEnabled = initialWh.enabled;
    webhookUrl = initialWh.url;

    const isp = await lookupIsp(clientIp);

    const logAndNotifyFailure = async (reason: string) => {
      await dbService.recordExecution({
        script_id: targetScriptId,
        script_name: targetScriptName,
        roblox_username: robloxUser,
        roblox_user_id: robloxId,
        ip_address: clientIp,
        country: clientGeo.country,
        city: clientGeo.city,
        latitude: clientGeo.latitude,
        longitude: clientGeo.longitude,
        isp,
        os: detectedOs,
        executor: detectedExecutor,
        key_last4: keyLast4,
        status: "failed",
        failure_reason: reason,
      });

      if (!webhookEnabled || !webhookUrl) {
        const wh = await resolveWebhook(script);
        webhookEnabled = wh.enabled;
        webhookUrl = wh.url;
      }

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

    // 1. Parameter Tampering & Privilege Escalation Detection:
    // 1. Parameter Tampering & Privilege Escalation Detection:
    // Clients must NEVER submit duration, expiration, or privilege fields directly
    if (
      body.duration !== undefined ||
      body.duration_hours !== undefined ||
      body.expires_at !== undefined ||
      body.is_staff !== undefined ||
      body.is_admin !== undefined ||
      body.is_staff_review !== undefined ||
      body.lifetime !== undefined ||
      body.status !== undefined
    ) {
      await dbService.banIp(
        clientIp,
        "Privilege Escalation / Parameter Tampering: Client attempted to forge duration or privilege fields"
      );
      await logAndNotifyFailure("Security Alert: Unauthorized duration/privilege parameter tampering detected.");
      return NextResponse.json(
        {
          error:
            "[AERO AUTH] Security Integrity Violation: Parameter tampering detected. Your IP has been permanently banned.",
        },
        { status: 403 }
      );
    }

    if (!key || typeof key !== "string" || key.trim() === "") {
      await logAndNotifyFailure("Missing Key: No license key provided.");
      return NextResponse.json({ error: "License key is required." }, { status: 400 });
    }

    const keyStr = key.trim();

    // Check for malformed length or invalid characters
    if (keyStr.length < 6 || keyStr.length > 64 || !/^[A-Za-z0-9_-]+$/.test(keyStr)) {
      await logAndNotifyFailure(`Malformed Key: Invalid key syntax ('${keyStr.slice(0, 20)}')`);
      return NextResponse.json({ error: "Invalid key format." }, { status: 400 });
    }

    // 2. Check IP Ban status
    const isBanned = await dbService.isIpBanned(clientIp);
    if (isBanned) {
      await logAndNotifyFailure("IP Banned: Client IP is blacklisted.");
      return NextResponse.json(
        { error: "Access Denied: Your IP address is banned from this service." },
        { status: 403 }
      );
    }

    // 3. Fetch Key Record strictly from database
    const fetchedKey = await dbService.getKeyByString(keyStr);
    if (!fetchedKey) {
      // Sliding window rate limit on failed key attempts to block brute-force / key guessing
      const now = Date.now();
      // Periodic pruning to avoid memory leak
      if (failedKeyAttempts.size > 2000) {
        const cutoff = now - FAILED_KEY_WINDOW_MS;
        failedKeyAttempts.forEach((val, k) => {
          if (val.firstAttempt < cutoff) failedKeyAttempts.delete(k);
        });
      }

      const probeRecord = failedKeyAttempts.get(clientIp);
      if (!probeRecord || now - probeRecord.firstAttempt > FAILED_KEY_WINDOW_MS) {
        failedKeyAttempts.set(clientIp, { count: 1, firstAttempt: now });
      } else {
        probeRecord.count += 1;
        // Temporary rate-limit warning before permanent blacklist
        if (probeRecord.count >= 5 && probeRecord.count < MAX_FAILED_KEY_PROBES) {
          return NextResponse.json(
            { error: "Too many failed key attempts. Please wait 5 minutes before trying again." },
            { status: 429, headers: { "Retry-After": "300" } }
          );
        }

        if (probeRecord.count >= MAX_FAILED_KEY_PROBES) {
          failedKeyAttempts.delete(clientIp);
          await dbService.banIp(
            clientIp,
            `Brute-Force Key Guessing Attack (${probeRecord.count} invalid key probes in 5 minutes)`
          );
          await logAndNotifyFailure(`Brute-Force Key Guessing Attack (${probeRecord.count} probes)`);
          return NextResponse.json(
            {
              error:
                "[AERO AUTH] Security Alert: Multiple invalid key attempts detected. Your IP address has been permanently blacklisted.",
            },
            { status: 403 }
          );
        }
      }

      await logAndNotifyFailure("Invalid Key: License key does not exist.");
      return NextResponse.json(
        { error: "Invalid Key: License key does not exist." },
        { status: 401 }
      );
    }

    // Reset failed probe attempts on successful key lookup
    failedKeyAttempts.delete(clientIp);
    const keyRecord = fetchedKey;

    const isStaff = isStaffReviewKey(keyRecord);

    if (keyRecord.status === "banned") {
      if (!isStaff) await logAndNotifyFailure("Revoked Key: License key was banned.");
      return NextResponse.json(
        { error: "Key Revoked: This license has been permanently banned." },
        { status: 403 }
      );
    }

    // 4. Critical Client Tamper Check:
    // If request originates from key's bound IP, enforce dual-IP ban; otherwise ban offending clientIp only
    if (Array.isArray(tamper_flags) && tamper_flags.some((f: unknown) => typeof f === "string" && f.startsWith("CRITICAL"))) {
      const isOwner = Boolean(keyRecord.claimed_ip && normalizeIp(keyRecord.claimed_ip) === normalizeIp(clientIp));
      if (isOwner && !isStaff) {
        await dbService.autoBanOffender(
          clientIp,
          keyRecord,
          `Critical Client Tampering Detected (Verify): ${tamper_flags.join("; ")}`,
          { banLinkedClaimedIp: true }
        );
      } else {
        await dbService.banIp(
          clientIp,
          `Critical Client Tampering Detected (Verify from unauthorized IP): ${tamper_flags.join("; ")}`
        );
      }
      await logAndNotifyFailure(`Security Integrity Violation: Tampering detected (${tamper_flags.join(", ")})`);
      return NextResponse.json(
        {
          error:
            "[AERO AUTH] Security Integrity Violation: Client environment modified or hooked. Access Denied.",
        },
        { status: 403 }
      );
    }

    // 5. Anti-Spoofing & Identity Integrity Checks (Enforced on all regular keys)
    if (!isStaff) {
      // Validate Roblox Identity against official Roblox public records
      const identityCheck = await verifyRobloxIdentity(roblox_user_id, roblox_username);
      if (!identityCheck.valid) {
        await logAndNotifyFailure(`Identity Spoofing Blocked: ${identityCheck.reason}`);
        return NextResponse.json(
          {
            error: `[AERO AUTH] Verification Error: ${identityCheck.reason}. Please make sure you are executing from your own Roblox account.`,
          },
          { status: 403 }
        );
      }

      // Validate Executor identifier sanity
      if (!executor || typeof executor !== "string" || executor.trim() === "" || executor.length > 80) {
        await logAndNotifyFailure("Security Alert: Missing or forged executor identifier.");
        return NextResponse.json(
          { error: "[AERO AUTH] Security Alert: Invalid executor environment." },
          { status: 403 }
        );
      }
    }

    if (!isStaff && keyRecord.status === "unclaimed") {
      // Paid lifetime keys are given directly to buyers and do not require claiming via the website
      if (keyRecord.duration_hours === null || keyRecord.duration_hours === undefined) {
        const nowIso = new Date().toISOString();
        keyRecord.status = "active";
        keyRecord.claimed_ip = clientIp;
        keyRecord.claimed_at = nowIso;
        keyRecord.activated_at = nowIso;
        await dbService.activateKey(keyRecord.id, clientIp);
      } else {
        await logAndNotifyFailure("Unclaimed Key: Key not claimed from website.");
        return NextResponse.json(
          { error: "Unclaimed Key: Please claim this key from the website first." },
          { status: 403 }
        );
      }
    }

    // Auto-bind IP for lifetime key if claimed_ip is not bound yet
    if (!isStaff && (keyRecord.duration_hours === null || keyRecord.duration_hours === undefined) && !keyRecord.claimed_ip) {
      keyRecord.claimed_ip = clientIp;
      keyRecord.claimed_at = new Date().toISOString();
      keyRecord.status = "active";
      await dbService.activateKey(keyRecord.id, clientIp);
    }

    // 5. Check Expiration (Skipped for staff review keys - completely lifetime)
    if (!isStaff && keyRecord.expires_at) {
      const now = new Date();
      const expires = new Date(keyRecord.expires_at);
      if (now > expires) {
        await logAndNotifyFailure("Expired Key: License expired.");
        // Immediately purge the expired key from the pool
        await dbService.deleteKey(keyRecord.id);
        return NextResponse.json(
          { error: "Expired Key: Your license key has expired and has been removed." },
          { status: 403 }
        );
      }
    }

    // 6. IP Matching: Must match claimed IP (Skipped for staff review keys - infinite users)
    if (!isStaff) {
      const normalizedClaimed = normalizeIp(keyRecord.claimed_ip);
      const normalizedClient = normalizeIp(clientIp);

      if (normalizedClaimed && normalizedClaimed !== normalizedClient) {
        const isLifetime = keyRecord.duration_hours === null || keyRecord.duration_hours === undefined;
        const reason = `IP Mismatch (Bound to ${normalizedClaimed.slice(0, 8)}..., executed from ${normalizedClient})`;
        await logAndNotifyFailure(reason);
        return NextResponse.json(
          {
            error: isLifetime
              ? `IP Mismatch! This paid lifetime key is locked to IP ${normalizedClaimed.slice(0, 7)}... but your IP is ${normalizedClient}.`
              : `IP Mismatch! This key was claimed by IP ${normalizedClaimed.slice(0, 7)}... but your IP is ${normalizedClient}. Re-claim your key on your network.`,
          },
          { status: 403 }
        );
      }
    }

    // 7. Fetch Script if not already resolved
    if (!script) {
      if (keyRecord.script_id && keyRecord.script_id !== "all") {
        const allScripts = await dbService.getScripts();
        script = allScripts.find((s) => s.id === keyRecord.script_id) || null;
      }
      if (script) {
        targetScriptName = script.name;
        targetScriptId = script.id;
        if (!webhookEnabled || !webhookUrl) {
          const wh = await resolveWebhook(script);
          webhookEnabled = wh.enabled;
          webhookUrl = wh.url;
        }
      }
    }

    if (!script) {
      if (!isStaff) await logAndNotifyFailure("Script Not Found: Missing target script.");
      return NextResponse.json({ error: "Script payload not found." }, { status: 404 });
    }

    // 7b. Script-Specific Key Isolation: Ensure key claimed for Script A cannot be used on Script B (unless assigned to "all")
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

    // 7c. Maintenance Mode Kill-Switch: Block access unless using staff review key
    if (script.is_maintenance && !isStaff) {
      const mMsg = script.maintenance_message || "This script is currently under scheduled maintenance. Please check our Discord for updates.";
      await logAndNotifyFailure(`Maintenance Mode: Blocked execution (${mMsg})`);
      return NextResponse.json({ error: mMsg }, { status: 403 });
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // 8. STAFF REVIEW KEY FAST-PATH:
    // Completely lifetime, zero user PII, anonymous staff review session tracking
    if (isStaff) {
      const staffReview = await dbService.createStaffReview({
        key_id: keyRecord.id,
        script_id: script.id,
        script_name: script.name,
        key_label: keyRecord.notes || "Staff Review Key",
      });

      const rawPayload = bundleModularScript({
        entryFile: script.entry_file || "init.lua",
        files: script.modules || {},
        dynamicStreaming: true,
        slug: script.slug,
        sessionToken: staffReview.id,
        baseUrl,
        key: (key || keyRecord.key_string || "").trim(),
        obfuscate: true,
      });

      const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const secretKey = `${staffReview.id}_${(key || "").trim()}_${nonce}`;
      const { encryptedHex, signature } = encryptSessionPayload(rawPayload, secretKey, nonce);

      return NextResponse.json({
        success: true,
        session_token: staffReview.id,
        is_staff_review: true,
        is_admin_key: true,
        expires_at: null,
        duration_hours: null,
        encrypted_payload: encryptedHex,
        payload_signature: signature,
        nonce,
      });
    }

    // 9. Normal User Key Flow:
    // Activate key and start its expiration countdown upon first execution
    const activatedKey = await dbService.activateKey(keyRecord.id, clientIp);
    const activeKey = activatedKey || keyRecord;

    // Create active in-game session
    const session = await dbService.createSession({
      key_id: keyRecord.id,
      script_id: script.id,
      ip_address: clientIp,
      hwid: hwid || null,
      roblox_username: robloxUser,
      roblox_user_id: robloxId,
      country: clientGeo.country,
      city: clientGeo.city,
      latitude: clientGeo.latitude,
      longitude: clientGeo.longitude,
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
      country: clientGeo.country,
      city: clientGeo.city,
      latitude: clientGeo.latitude,
      longitude: clientGeo.longitude,
      isp,
      os: detectedOs,
      executor: detectedExecutor,
      place_id: place_id ? String(place_id) : null,
      place_name: place_name || null,
      job_id: job_id || null,
      key_last4: keyLast4,
      status: "success",
      failure_reason: null,
    });

    if (!webhookEnabled || !webhookUrl) {
      const finalWh = await resolveWebhook(script);
      webhookEnabled = finalWh.enabled;
      webhookUrl = finalWh.url;
    }

    if (webhookEnabled && webhookUrl) {
      sendExecutionWebhook({
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
      }).catch((e) => console.error("Webhook dispatch error:", e));
    }

    // Assemble protected modular virtual bundle with Dynamic Zero-Knowledge Streaming
    const rawPayload = bundleModularScript({
      entryFile: script.entry_file || "init.lua",
      files: script.modules || {},
      dynamicStreaming: true,
      slug: script.slug,
      sessionToken: session.id,
      baseUrl,
      key: (key || keyRecord.key_string || "").trim(),
      obfuscate: true,
    });

    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const secretKey = `${session.id}_${(key || "").trim()}_${nonce}`;
    const { encryptedHex, signature } = encryptSessionPayload(rawPayload, secretKey, nonce);
    let remainingSeconds: number | null = null;
    const isLifetime = !isStaff && (activeKey.duration_hours === null || activeKey.duration_hours === undefined);

    if (activeKey.expires_at) {
      const diffMs = new Date(activeKey.expires_at).getTime() - Date.now();
      remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
    } else if (activeKey.duration_hours && activeKey.duration_hours > 0) {
      remainingSeconds = activeKey.duration_hours * 3600;
    }

    return NextResponse.json({
      success: true,
      session_token: session.id,
      expires_at: activeKey.expires_at,
      duration_hours: activeKey.duration_hours,
      remaining_seconds: remainingSeconds,
      is_lifetime: isLifetime,
      encrypted_payload: encryptedHex,
      payload_signature: signature,
      nonce,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal verification error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
