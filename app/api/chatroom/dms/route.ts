// app/api/chatroom/dms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (userId) {
      // Return specific message history for this user
      const messages = await dbService.getDevMessages(userId);
      return NextResponse.json({ success: true, messages });
    }

    // Otherwise return list of all player conversations for the dashboard
    const conversations = await dbService.getDevConversations();
    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    console.error("Error fetching dev messages:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, username, displayName, avatarUrl, senderType, message } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message text is required" }, { status: 400 });
    }

    const type = senderType === "dev" ? "dev" : "user";
    const senderUsername = type === "dev" ? "Admin / Dev" : (username ? String(username) : "Player");
    const senderDisplayName = type === "dev" ? "Admin / Dev" : (displayName ? String(displayName) : senderUsername);

    const result = await dbService.postDevMessage({
      user_id: String(userId),
      username: senderUsername,
      display_name: senderDisplayName,
      avatar_url: avatarUrl ? String(avatarUrl) : undefined,
      sender_type: type,
      message: message.trim(),
    });

    if (result.blocked) {
      return NextResponse.json(
        { success: false, blocked: true, error: result.error || "Message contains prohibited words" },
        { status: 400 }
      );
    }

    if (!result.success || !result.data) {
      return NextResponse.json({ success: false, error: result.error || "Failed to send message" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: result.data });
  } catch (error: any) {
    console.error("Error sending dev message:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, reader } = body;
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const readerRole = reader === "player" ? "player" : (reader === "all" ? "all" : "admin");
    await dbService.markDevMessagesRead(String(userId), readerRole);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error marking messages read:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
