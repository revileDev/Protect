// app/api/chatroom/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || undefined;
    const limit = Math.min(Number(searchParams.get("limit") || 100), 200);

    const [messages, cooldown] = await Promise.all([
      dbService.getChatroomMessages(since, limit),
      dbService.getChatroomCooldown(),
    ]);

    return NextResponse.json({
      success: true,
      messages,
      cooldown_seconds: cooldown,
    });
  } catch (error: any) {
    console.error("Error fetching chatroom messages:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load chat messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, username, displayName, avatarUrl, message, isDev } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message text is required" }, { status: 400 });
    }

    const result = await dbService.postChatroomMessage({
      user_id: String(userId || "0"),
      username: String(username || "Anonymous"),
      display_name: displayName ? String(displayName) : undefined,
      avatar_url: avatarUrl ? String(avatarUrl) : undefined,
      message: message.trim(),
      is_dev: Boolean(isDev),
    });

    if (result.rateLimited) {
      return NextResponse.json(
        {
          success: false,
          rateLimited: true,
          remaining: result.remaining,
          error: result.error || "Chat cooldown active.",
        },
        { status: 429 }
      );
    }

    if (result.blocked) {
      return NextResponse.json(
        { success: false, blocked: true, error: result.error || "Message contains blacklisted language" },
        { status: 400 }
      );
    }

    if (!result.success || !result.data) {
      return NextResponse.json({ success: false, error: result.error || "Failed to send message" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: result.data });
  } catch (error: any) {
    console.error("Error sending chatroom message:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing message id" }, { status: 400 });
    }

    await dbService.deleteChatroomMessage(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting chat message:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
