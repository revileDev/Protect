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

    let wordsToAdd: string[] = [];
    if (Array.isArray(body.words)) {
      wordsToAdd = body.words.flatMap((w: unknown) =>
        String(w || "")
          .split(/[\r\n,]+/)
          .map((item: string) => item.trim().toLowerCase())
      );
    } else if (typeof body.words === "string") {
      wordsToAdd = body.words
        .split(/[\r\n,]+/)
        .map((item: string) => item.trim().toLowerCase());
    } else if (typeof body.word === "string") {
      wordsToAdd = body.word
        .split(/[\r\n,]+/)
        .map((item: string) => item.trim().toLowerCase());
    }

    wordsToAdd = Array.from(new Set(wordsToAdd.filter(Boolean)));

    if (!wordsToAdd.length) {
      return NextResponse.json({ success: false, error: "No valid words provided to add." }, { status: 400 });
    }

    const updated = await dbService.addBlacklistWords(wordsToAdd);
    return NextResponse.json({ success: true, count: wordsToAdd.length, words: updated });
  } catch (error: any) {
    console.error("Error adding blacklist words:", error);
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
