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
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, slug, entry_file, modules, loader_config_id, watermark_text, show_watermark } = body;

    if (!name || !entry_file) {
      return NextResponse.json({ error: "Script name and entry_file are required." }, { status: 400 });
    }

    let cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")).trim();

    // If updating an existing script by id, lock the slug so loadstring NEVER resets
    if (body.id) {
      const allScripts = await dbService.getScripts();
      const existing = allScripts.find((s) => s.id === body.id);
      if (existing && existing.slug) {
        cleanSlug = existing.slug;
      }
    }

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
      is_maintenance: body.is_maintenance === true,
      maintenance_message: body.maintenance_message || null,
    });

    return NextResponse.json({ success: true, script });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error saving script";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, slug, file_path, file_content, entry_file, modules, action, delete_file } = body;

    if (!id && !slug) {
      return NextResponse.json({ error: "Missing script id or slug" }, { status: 400 });
    }

    const allScripts = await dbService.getScripts();
    const existing = allScripts.find((s) => (id && s.id === id) || (slug && s.slug === slug));

    if (!existing) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const updatedModules: Record<string, string> = { ...(existing.modules || {}) };

    // Action 1: Delete file
    if (action === "delete_file" || delete_file) {
      const toDelete = delete_file || file_path;
      if (toDelete && updatedModules[toDelete] !== undefined) {
        delete updatedModules[toDelete];
      }
    }
    // Action 2: Update single file
    else if (file_path && file_content !== undefined) {
      updatedModules[file_path] = file_content;
    }
    // Action 3: Bulk replace modules
    else if (modules && typeof modules === "object") {
      Object.assign(updatedModules, modules);
    }

    let targetEntryFile = existing.entry_file;
    if (entry_file) {
      targetEntryFile = entry_file;
    } else if (!updatedModules[targetEntryFile]) {
      targetEntryFile = Object.keys(updatedModules)[0] || "init.lua";
    }

    // Save and ALWAYS lock slug so the loadstring is never reset
    const updatedScript = await dbService.saveScript({
      ...existing,
      id: existing.id,
      slug: existing.slug, // 100% locked & preserved
      name: body.name || existing.name,
      entry_file: targetEntryFile,
      modules: updatedModules,
      loader_config_id: body.loader_config_id !== undefined ? body.loader_config_id : existing.loader_config_id,
      watermark_text: body.watermark_text !== undefined ? body.watermark_text : existing.watermark_text,
      show_watermark: body.show_watermark !== undefined ? body.show_watermark : existing.show_watermark,
      is_active: body.is_active !== undefined ? body.is_active : existing.is_active,
      use_auth: body.use_auth !== undefined ? body.use_auth : existing.use_auth,
      is_maintenance: body.is_maintenance !== undefined ? body.is_maintenance : existing.is_maintenance,
      maintenance_message: body.maintenance_message !== undefined ? body.maintenance_message : existing.maintenance_message,
    });

    return NextResponse.json({
      success: true,
      script: updatedScript,
      message: `Updated without resetting loadstring (/${updatedScript.slug}).`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error updating script";
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
    if (!id) return NextResponse.json({ error: "Missing script id" }, { status: 400 });

    await dbService.deleteScript(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error deleting script";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
