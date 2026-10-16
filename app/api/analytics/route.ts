// app/api/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "all";
    const scriptId = searchParams.get("script_id") || undefined;
    const data = await dbService.getAnalytics(timeframe, scriptId);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error fetching analytics";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    await dbService.clearAnalytics();
    return NextResponse.json({ success: true, message: "Analytics logs cleared successfully." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error clearing analytics";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
