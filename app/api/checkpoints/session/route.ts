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

    // ACTION: VERIFY STEP
    if (action === "verify_step") {
      const { sessionId, stepIndex, stepToken, powSolution } = body;

      if (!sessionId || stepIndex === undefined || !stepToken) {
        return NextResponse.json(
          { success: false, error: "Missing required session or step parameters." },
          { status: 400 }
        );
      }

      const result = antiBypassService.verifyStep(
        sessionId,
        Number(stepIndex),
        String(stepToken),
        ip,
        String(powSolution || "")
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

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error processing checkpoint session";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
