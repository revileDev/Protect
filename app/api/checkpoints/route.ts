// app/api/checkpoints/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scriptSlug = searchParams.get("script_slug") || searchParams.get("script");
    let scriptId = searchParams.get("script_id") || "";

    let targetScript = null;
    if (scriptSlug) {
      targetScript = await dbService.getScriptBySlug(scriptSlug);
      if (targetScript) {
        scriptId = targetScript.id;
      }
    } else if (scriptId && scriptId !== "all") {
      const allScripts = await dbService.getScripts();
      targetScript = allScripts.find((s) => s.id === scriptId) || null;
    }

    // Auto-resolve active script if no specific script or target is identified
    if (!targetScript && (!scriptId || scriptId === "")) {
      const allScripts = await dbService.getScripts();
      const active = allScripts.filter((s) => s.is_active !== false);
      const preferred =
        active.find((s) => s.slug === "atomware-hub" || s.name.toLowerCase().includes("atom")) ||
        active[active.length - 1] ||
        active[0];
      if (preferred) {
        targetScript = preferred;
        scriptId = preferred.id;
      }
    }

    const checkpoints = await dbService.getCheckpoints(scriptId || undefined);
    const profile = await dbService.getCreatorProfile();

    return NextResponse.json({
      checkpoints,
      profile,
      script: targetScript ? { id: targetScript.id, name: targetScript.name, slug: targetScript.slug } : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching checkpoints";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, script_id, title, url, duration_seconds, order } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Checkpoint title is required." }, { status: 400 });
    }
    if (!url || !url.trim()) {
      return NextResponse.json({ error: "Checkpoint destination URL is required." }, { status: 400 });
    }

    const duration = Math.max(1, Number(duration_seconds) || 5);
    const orderNum = Number(order) || 1;

    const saved = await dbService.saveCheckpoint({
      id: id || undefined,
      script_id: script_id || "all",
      title: title.trim(),
      url: url.trim(),
      duration_seconds: duration,
      order: orderNum,
    });

    return NextResponse.json({ success: true, checkpoint: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error saving checkpoint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing checkpoint id." }, { status: 400 });
    }

    const deleted = await dbService.deleteCheckpoint(id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting checkpoint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
