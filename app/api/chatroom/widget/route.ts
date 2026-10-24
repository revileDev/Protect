// app/api/chatroom/widget/route.ts
// Serves the client-side Chatroom & Developer Direct Messages Widget.
// Automatically loaded after successful authentication for every script.

import { NextRequest, NextResponse } from "next/server";
import { getCustomizedChatroomWidget } from "@/lib/chatroom-widget-source";

export async function GET(req: NextRequest) {
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  const customizedSrc = getCustomizedChatroomWidget(baseUrl);

  return new NextResponse(customizedSrc, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
