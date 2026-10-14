// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export async function GET() {
  const settings = await dbService.getSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await dbService.saveSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error saving settings";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
