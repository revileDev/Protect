// app/api/scripts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/store";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  const scripts = await dbService.getScripts();
  const authed = isAuthenticated();
  if (!authed) {
    const publicScripts = scripts
      .filter((s) => s.is_active !== false)
      .map(({ id, name, slug, is_active, use_auth, watermark_text, created_at }) => ({
        id,
        name,
        slug,
        is_active,
        use_auth,
        watermark_text,
        created_at,
      }));
    return NextResponse.json({ scripts: publicScripts });
  }
  return NextResponse.json({ scripts });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, entry_file, modules, loader_config_id, watermark_text, show_watermark } = body;

    if (!name || !entry_file) {
      return NextResponse.json({ error: "Script name and entry_file are required." }, { status: 400 });
    }

    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")).trim();

    let validConfigId = null;
    if (loader_config_id && typeof loader_config_id === "string" && loader_config_id.trim().length > 0) {
      const trimmed = loader_config_id.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      if (isUuid) validConfigId = trimmed;
    }

    const script = await dbService.saveScript({
      id: body.id || undefined,
      name,
      slug: cleanSlug,
      entry_file,
      modules: modules || {},
      loader_config_id: validConfigId,
      watermark_text: watermark_text || name,
      show_watermark: show_watermark !== false,
      is_active: true,
      use_auth: body.use_auth !== false,
    });

    return NextResponse.json({ success: true, script });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error saving script";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing script id" }, { status: 400 });

    await dbService.deleteScript(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error deleting script";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
