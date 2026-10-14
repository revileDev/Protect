// app/api/keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

function generateRandomKey(prefix = "KEY"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part3 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${part1}-${part2}-${part3}`;
}

export async function GET() {
  const keys = await dbService.getKeys();
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { count = 1, prefix = "KEY", script_id = "", duration_hours = null } = body;

    const numKeys = Math.min(Math.max(1, Number(count)), 100);
    const generatedList = [];

    for (let i = 0; i < numKeys; i++) {
      generatedList.push({
        key_string: generateRandomKey(prefix),
        script_id,
        duration_hours: duration_hours ? Number(duration_hours) : null,
      });
    }

    const created = await dbService.createKeys(generatedList);
    return NextResponse.json({ success: true, count: created.length, keys: created });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error generating keys";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });

    await dbService.updateKeyStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error updating key";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await dbService.deleteKey(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error deleting key";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
