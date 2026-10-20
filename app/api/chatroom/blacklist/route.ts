// app/api/chatroom/blacklist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const words = await dbService.getBlacklistWords();
    return NextResponse.json({ success: true, words });
  } catch (error: any) {
    console.error("Error fetching blacklist words:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const word = (body.word || "").trim();
    if (!word) {
      return NextResponse.json({ success: false, error: "Word cannot be empty" }, { status: 400 });
    }

    await dbService.addBlacklistWord(word);
    const updated = await dbService.getBlacklistWords();
    return NextResponse.json({ success: true, words: updated });
  } catch (error: any) {
    console.error("Error adding blacklist word:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get("word");
    if (!word) {
      return NextResponse.json({ success: false, error: "Word parameter is required" }, { status: 400 });
    }

    await dbService.deleteBlacklistWord(word);
    const updated = await dbService.getBlacklistWords();
    return NextResponse.json({ success: true, words: updated });
  } catch (error: any) {
    console.error("Error removing blacklist word:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
