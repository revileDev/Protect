// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  const settings = await dbService.getSettings();
  const authed = isAuthenticated();

  // If not authenticated admin, redact sensitive discord tokens and secrets
  if (!authed) {
    const sanitized = {
      claim_method: settings.claim_method || "checkpoints",
      checkpoint_delay_seconds: settings.checkpoint_delay_seconds ?? 5,
      discord_invite_url: settings.discord_invite_url || "https://discord.gg/AeCYnnQmq5",
      vpn_detection_enabled: Boolean(settings.vpn_detection_enabled),
      tos_content: settings.tos_content || "",
    };
    return NextResponse.json({ settings: sanitized });
  }

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = await dbService.saveSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error saving settings";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
