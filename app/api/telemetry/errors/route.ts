// app/api/telemetry/errors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, script_id, error_message, stack_trace, executor, os } = body;

    if (!error_message) {
      return NextResponse.json({ error: "Missing error_message" }, { status: 400 });
    }

    let robloxUsername: string | null = null;
    let robloxUserId: string | null = null;
    let targetScriptId: string | null = script_id || null;
    let targetScriptName: string | null = null;

    if (session_id) {
      const sessions = await dbService.getSessions();
      const session = sessions.find((s) => s.id === session_id);
      if (session) {
        robloxUsername = session.roblox_username;
        robloxUserId = session.roblox_user_id;
        if (!targetScriptId) targetScriptId = session.script_id;
      }
    }

    if (targetScriptId) {
      const scripts = await dbService.getScripts();
      const script = scripts.find((s) => s.id === targetScriptId || s.slug === targetScriptId);
      if (script) {
        targetScriptName = script.name;
      }
    }

    const recorded = await dbService.recordClientError({
      session_id: session_id || null,
      script_id: targetScriptId,
      script_name: targetScriptName || "Universal Script",
      roblox_username: robloxUsername,
      roblox_user_id: robloxUserId,
      executor: executor || null,
      os: os || null,
      error_message: String(error_message).substring(0, 1000),
      stack_trace: stack_trace ? String(stack_trace).substring(0, 3000) : null,
    });

    return NextResponse.json({ success: true, id: recorded.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error logging client error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const errors = await dbService.getClientErrors(200);
    return NextResponse.json({ errors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error retrieving client errors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    await dbService.clearClientErrors();
    return NextResponse.json({ success: true, message: "Client error logs cleared." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error clearing client errors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
