// app/api/chatroom/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cooldown = await dbService.getChatroomCooldown();
    return NextResponse.json({
      success: true,
      cooldown_seconds: cooldown,
    });
  } catch (error: any) {
    console.error("Error fetching chatroom settings:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawVal = body.cooldown_seconds !== undefined ? body.cooldown_seconds : body.cooldown;
    const cooldown = Number(rawVal);
    if (isNaN(cooldown) || cooldown < 0) {
      return NextResponse.json({ success: false, error: "Invalid cooldown value." }, { status: 400 });
    }

    const saved = await dbService.setChatroomCooldown(cooldown);
    return NextResponse.json({
      success: true,
      cooldown_seconds: saved,
      message: `Chat cooldown set to ${saved}s.`,
    });
  } catch (error: any) {
    console.error("Error updating chatroom settings:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
