// app/api/scripts/github/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { fetchFilesFromGitHub, syncScriptFromGitHub, parseGitHubRepoSlug } from "@/lib/github-sync";
import { dbService } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Mode 1: Sync existing script by script_id or slug
    if (body.script_id || body.slug) {
      const target = body.script_id || body.slug;
      const result = await syncScriptFromGitHub(target, { force: body.force === true });
      if (!result.success) {
        return NextResponse.json({ error: result.error || "GitHub sync failed" }, { status: 400 });
      }
      const updatedScript = await dbService.getScriptBySlug(target);
      return NextResponse.json({
        success: true,
        message: `Successfully synchronized ${result.filesCount} files from GitHub.`,
        commitSha: result.commitSha,
        files: result.files,
        entryFile: result.entryFile,
        script: updatedScript,
      });
    }

    // Mode 2: Test / Preview fetch from repository parameters (before creating a script)
    const { repo, branch, directory, token } = body;
    if (!repo) {
      return NextResponse.json({ error: "GitHub repository URL or slug (owner/repo) is required." }, { status: 400 });
    }

    const pullResult = await fetchFilesFromGitHub({
      repo,
      branch: branch || "main",
      directory: directory || "",
      token: token || null,
    });

    if (!pullResult.success) {
      return NextResponse.json({ error: pullResult.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      commitSha: pullResult.commitSha,
      filesCount: pullResult.filesCount,
      files: pullResult.files,
      entryFile: pullResult.entryFile,
      modules: (pullResult as any).modules,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error executing GitHub sync";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
