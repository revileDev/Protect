// app/api/loader-configs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export async function GET() {
  const configs = await dbService.getLoaderConfigs();
  return NextResponse.json({ configs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = await dbService.saveLoaderConfig(body);
    return NextResponse.json({ success: true, config });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error saving loader config";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
