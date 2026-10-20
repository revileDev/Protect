// app/api/checkpoints/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { getClientIp } from "@/lib/ip";
import { antiBypassService } from "@/lib/anti-bypass";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";
    const body = await req.json();
    const { action } = body;

    // 1. IP Ban check
    if (await dbService.isIpBanned(ip)) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Your IP is banned from claiming keys." },
        { status: 403 }
      );
    }

    // ACTION: START SESSION
    if (action === "start") {
      const { script_slug, script_id } = body;
      let targetScriptId = script_id || "";

      if (!targetScriptId && script_slug) {
        const script = await dbService.getScriptBySlug(script_slug);
        if (script) targetScriptId = script.id;
      }

      const checkpoints = await dbService.getCheckpoints(targetScriptId || undefined);

      // If no checkpoints configured, return an internal verification step
      const effectiveCheckpoints =
        checkpoints.length > 0
          ? checkpoints
          : [
              {
                id: "default-verification",
                script_id: "all",
                title: "Security Verification",
                url: "https://discord.gg/AeCYnnQmq5",
                duration_seconds: 5,
                order: 1,
                created_at: new Date().toISOString(),
              },
            ];

      const sessionData = antiBypassService.createSession(
        ip,
        userAgent,
        targetScriptId,
        effectiveCheckpoints
      );

      // Log start checkpoint
      await dbService.recordCheckpoint("started", ip, targetScriptId);

      return NextResponse.json({
        success: true,
        ...sessionData,
      });
    }

    // ACTION: START STEP (Stamps server start clock and generates active step token)
    if (action === "start_step") {
      const { gatewayToken } = body;

      if (!gatewayToken || typeof gatewayToken !== "string") {
        return NextResponse.json(
          { success: false, error: "Missing required gatewayToken parameter." },
          { status: 400 }
        );
      }

      const result = antiBypassService.startStep(gatewayToken, ip);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || "Failed to start checkpoint step." },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    }

    // ACTION: VERIFY STEP (Enforces temporal dwell time and Proof-of-Work)
    if (action === "verify_step") {
      const { activeStepToken, stepToken, powSolution, powNonce } = body;
      const targetToken = activeStepToken || stepToken;

      if (!targetToken || typeof targetToken !== "string") {
        return NextResponse.json(
          { success: false, error: "Missing active step authorization token." },
          { status: 400 }
        );
      }

      const result = antiBypassService.verifyStep(
        targetToken,
        ip,
        String(powSolution || ""),
        powNonce
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            bypassDetected: result.bypassDetected,
            remainingSeconds: result.remainingSeconds,
          },
          { status: result.bypassDetected ? 403 : 400 }
        );
      }

      return NextResponse.json({
        ...result,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error handling checkpoint session";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
