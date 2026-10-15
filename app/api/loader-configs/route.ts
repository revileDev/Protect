// app/api/loader-configs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { sendTestWebhook } from "@/lib/discord-webhook";

export async function GET() {
  const configs = await dbService.getLoaderConfigs();
  return NextResponse.json({ configs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "test_webhook") {
      const result = await sendTestWebhook(body.webhook_url);
      if (result.success) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: result.error || "Discord rejected webhook" }, { status: 400 });
    }

    const config = await dbService.saveLoaderConfig(body);
    return NextResponse.json({ success: true, config });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error saving loader config";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

