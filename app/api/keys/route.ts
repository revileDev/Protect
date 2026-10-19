// app/api/keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

import crypto from "crypto";

function generateRandomKey(prefix = "KEY"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const cleanPrefix = (prefix || "KEY").toUpperCase().trim().replace(/[^A-Z0-9_-]/g, "");
  const getChunk = (len: number) => {
    const bytes = crypto.randomBytes(len);
    let chunk = "";
    for (let i = 0; i < len; i++) {
      chunk += chars[bytes[i] % chars.length];
    }
    return chunk;
  };
  return `${cleanPrefix}-${getChunk(4)}-${getChunk(4)}-${getChunk(4)}`;
}

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }
  const keys = await dbService.getKeys();
  const bannedIps = await dbService.getBannedIps();
  return NextResponse.json({ keys, banned_ips: bannedIps });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      count = 1,
      prefix = "KEY",
      script_id = "",
      duration_hours = null,
      is_staff_review = false,
      custom_key = "",
      notes = "",
    } = body;

    if (is_staff_review) {
      const staffKeyString =
        custom_key && custom_key.trim()
          ? custom_key.trim().toUpperCase()
          : generateRandomKey(prefix && prefix !== "KEY" ? prefix : "STAFF-REV");

      const created = await dbService.createKeys([
        {
          key_string: staffKeyString,
          script_id: script_id || "all",
          duration_hours: null,
          is_staff_review: true,
          status: "active",
          claimed_discord_tag: "STAFF_REVIEW",
          claimed_discord_id: "STAFF_REVIEW",
          notes: notes && notes.trim() ? notes.trim() : "Staff Review Key",
        },
      ]);

      return NextResponse.json({ success: true, count: 1, keys: created });
    }

    const numKeys = Math.min(Math.max(1, Number(count)), 100);
    const generatedList = [];

    for (let i = 0; i < numKeys; i++) {
      generatedList.push({
        key_string: generateRandomKey(prefix),
        script_id,
        duration_hours: duration_hours ? Number(duration_hours) : null,
        notes: notes && notes.trim() ? notes.trim() : null,
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
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, status, notes } = body;
    if (!id) return NextResponse.json({ error: "Missing key id" }, { status: 400 });

    if (status) {
      await dbService.updateKeyStatus(id, status);
    }
    if (notes !== undefined) {
      await dbService.updateKeyNotes(id, notes && notes.trim() ? notes.trim() : null);
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error updating key";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

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
