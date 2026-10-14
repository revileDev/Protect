// app/api/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "all";
    const data = await dbService.getAnalytics(timeframe);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error fetching analytics";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
