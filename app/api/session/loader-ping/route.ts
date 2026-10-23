// app/api/session/loader-ping/route.ts
// Called the instant the loader script executes, BEFORE the user enters a key.
// Creates/refreshes a lightweight "loading" session so the admin can see who is
// sitting in the auth loader in real time.
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { getClientIp, getClientGeo } from "@/lib/ip";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const clientGeo = getClientGeo(req);
    const body = await req.json();

    const {
      loader_token,
      hwid,
      roblox_username,
      roblox_user_id,
      place_id,
      job_id,
      executor,
    } = body;

    if (!loader_token || typeof loader_token !== "string") {
      return NextResponse.json({ error: "loader_token required" }, { status: 400 });
    }

    // Check if a loader session for this token already exists
    const existing = await dbService.getSessionByToken(loader_token);

    if (existing) {
      // Refresh heartbeat on the existing loader session
      await dbService.updateHeartbeat(existing.id, clientIp, {
        roblox_username: roblox_username || undefined,
        roblox_user_id: roblox_user_id || undefined,
        place_id: place_id || undefined,
        job_id: job_id || undefined,
      });
    } else {
      // Create a new loader session
      await dbService.createSession({
        key_id: "LOADER",
        script_id: "loading",
        ip_address: clientIp,
        hwid: hwid || null,
        roblox_username: roblox_username || "Unknown",
        roblox_user_id: roblox_user_id || null,
        country: clientGeo.country,
        city: clientGeo.city,
        latitude: clientGeo.latitude,
        longitude: clientGeo.longitude,
        status: "loading",
        tamper_flags: [],
        loader_token,
        executor: executor || null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Loader ping error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
